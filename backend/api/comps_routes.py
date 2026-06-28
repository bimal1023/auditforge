"""Comparable companies analysis — fetch multiples for peers, synthesize with Claude."""
from __future__ import annotations

import asyncio
import json
import logging
import statistics
import uuid

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import CompsAnalysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/comps", tags=["comps"])

FMP_BASE = "https://financialmodelingprep.com/stable"


def _compute_comps_math(
    company_data: dict[str, dict], target: str, peers: list[str],
) -> tuple[dict | None, dict | None]:
    """Deterministically compute peer-median multiples + implied valuations.

    The LLM reliably *transcribes* the per-company table but is unreliable at
    *arithmetic* — it has mis-multiplied implied valuations (e.g. reporting a
    P/E-implied equity value that doesn't equal `median P/E × net income`) and
    miscomputed the premium-vs-peers figure. So we recompute these derived
    numbers in Python from the raw FMP data and overwrite whatever the model
    returned, guaranteeing the implied boxes always reconcile with the
    displayed multiples.

    Returns ``(median_multiples, implied_valuation)`` ready to drop into the
    parsed ``analysis`` dict. ``implied_valuation`` is None when the target
    lacks the data needed to value it on any method.
    """
    def _row(ticker: str) -> dict:
        d = company_data.get(ticker, {})
        p = d.get("profile", {})
        m = d.get("metrics", {})
        r = d.get("ratios", {})
        ttm = d.get("ttm", {})
        gro = d.get("growth", {})
        ev = m.get("enterpriseValue")
        mc = p.get("marketCap") or m.get("marketCap")
        revenue = ttm.get("revenue")
        ebitda = ttm.get("ebitda")
        net_income = ttm.get("netIncome")
        gross_profit = ttm.get("grossProfit")
        eps = ttm.get("epsDiluted")
        price = p.get("price")
        pe = round(price / eps, 2) if price and eps and eps > 0 else None
        ev_ebitda = round(ev / ebitda, 2) if ev and ebitda and ebitda > 0 else None
        ev_rev = round(ev / revenue, 2) if ev and revenue and revenue > 0 else None
        gross_margin = (
            round(gross_profit / revenue, 4)
            if gross_profit and revenue and revenue > 0
            else r.get("grossProfitMargin")
        )
        return {
            "ev": ev, "market_cap": mc, "revenue": revenue, "ebitda": ebitda,
            "net_income": net_income, "pe": pe, "ev_ebitda": ev_ebitda,
            "ev_rev": ev_rev, "gross_margin": gross_margin,
            "rev_growth": gro.get("growthRevenue"),
        }

    def _median(vals: list) -> float | None:
        clean = [v for v in vals if v is not None]
        return round(statistics.median(clean), 4) if clean else None

    def _b(v: float | None) -> str:
        return f"${v / 1e9:.1f}B" if v is not None else "N/A"

    peer_rows = [_row(t) for t in peers]
    med_pe = _median([r["pe"] for r in peer_rows])
    med_ev_ebitda = _median([r["ev_ebitda"] for r in peer_rows])
    med_ev_rev = _median([r["ev_rev"] for r in peer_rows])

    median_multiples = {
        "pe_ratio": med_pe,
        "ev_ebitda": med_ev_ebitda,
        "ev_revenue": med_ev_rev,
        "gross_margin": _median([r["gross_margin"] for r in peer_rows]),
        "revenue_growth": _median([r["rev_growth"] for r in peer_rows]),
    }

    tgt = _row(target)
    if not tgt["ev"] and not tgt["market_cap"]:
        return median_multiples, None

    implied: dict = {}
    # Per-method premiums in ratio form (0.5 = +50%). EV-based methods imply an
    # enterprise value (compare to current EV); P/E implies an equity value
    # (compare to market cap). We blend them with a *median* below so a single
    # method blowing up — common when net income is near zero — can't distort
    # the headline. These bases aren't perfectly comparable (debt aside), so the
    # number is a directional "premium/discount vs peers" gauge, not a target price.
    premiums: list[float] = []

    if med_ev_ebitda and tgt["ebitda"] and tgt["ebitda"] > 0:
        iv = med_ev_ebitda * tgt["ebitda"]
        implied["based_on_ev_ebitda"] = (
            f"{_b(iv)} (using peer median EV/EBITDA of {med_ev_ebitda:.2f}x "
            f"on {target} EBITDA of {_b(tgt['ebitda'])})"
        )
        if tgt["ev"]:
            premiums.append(tgt["ev"] / iv - 1)
    else:
        implied["based_on_ev_ebitda"] = "Not meaningful (target EBITDA unavailable or negative)"

    if med_ev_rev and tgt["revenue"] and tgt["revenue"] > 0:
        iv = med_ev_rev * tgt["revenue"]
        implied["based_on_ev_revenue"] = (
            f"{_b(iv)} (using peer median EV/Revenue of {med_ev_rev:.2f}x "
            f"on {target} revenue of {_b(tgt['revenue'])})"
        )
        if tgt["ev"]:
            premiums.append(tgt["ev"] / iv - 1)
    else:
        implied["based_on_ev_revenue"] = "Not meaningful (target revenue unavailable)"

    if med_pe and tgt["net_income"] and tgt["net_income"] > 0:
        iv = med_pe * tgt["net_income"]
        implied["based_on_pe"] = (
            f"{_b(iv)} (using peer median P/E of {med_pe:.2f}x "
            f"on {target} net income of {_b(tgt['net_income'])})"
        )
        if tgt["market_cap"]:
            premiums.append(tgt["market_cap"] / iv - 1)
    else:
        implied["based_on_pe"] = "Not meaningful (target has negative or zero net income)"

    if premiums:
        med_prem = statistics.median(premiums)
        implied["premium_discount_pct"] = round(med_prem * 100, 1)
        if med_prem > 0.10:
            implied["current_vs_implied"] = "premium"
        elif med_prem < -0.10:
            implied["current_vs_implied"] = "discount"
        else:
            implied["current_vs_implied"] = "inline"
    else:
        implied["premium_discount_pct"] = None
        implied["current_vs_implied"] = "inline"

    return median_multiples, implied


# ── Schemas ──────────────────────────────────────────────────────────────────

class CompsRequest(BaseModel):
    target_ticker: str
    peer_tickers: list[str]  # 2–6 peer tickers


class CompsResponse(BaseModel):
    id: uuid.UUID
    target_ticker: str
    peer_tickers: list[str]
    analysis: dict | None
    created_at: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=CompsResponse)
@limiter.limit("10/minute")
async def analyze_comps(
    request: Request,
    body: CompsRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> CompsResponse:
    """Build a comparable companies analysis for the target vs peers."""
    settings = get_settings()
    target = body.target_ticker.upper().strip()
    peers = list({t.upper().strip() for t in body.peer_tickers if t.strip()})

    if not target:
        raise HTTPException(400, "Target ticker is required.")
    if len(peers) < 1:
        raise HTTPException(400, "At least 1 peer ticker is required.")
    if len(peers) > 8:
        raise HTTPException(400, "Maximum 8 peer tickers.")
    if not settings.fmp_api_key:
        raise HTTPException(
            503,
            "Comps analysis requires an FMP API key. "
            "Add FMP_API_KEY to your infra/.env file.",
        )

    all_tickers = [target] + peers
    api_key = settings.fmp_api_key

    # ── Helper: fetch one FMP endpoint for one ticker ──────────────────────
    async def _fmp(
        client: httpx.AsyncClient, path: str, ticker: str, limit: int = 2,
    ) -> list | dict:
        try:
            r = await client.get(
                f"{FMP_BASE}/{path}",
                params={"symbol": ticker, "limit": limit, "apikey": api_key},
            )
            ct = r.headers.get("content-type", "")
            if r.status_code != 200 or "application/json" not in ct:
                return []
            return r.json()
        except Exception:
            return []

    # ── Helper: build TTM from last 4 quarters ───────────────────────────
    def _ttm(quarters: list[dict], field: str) -> float | None:
        """Sum a field across up to 4 quarters. Returns None if < 2 valid."""
        vals = [q.get(field) for q in quarters[:4] if q.get(field) is not None]
        return sum(vals) if len(vals) >= 2 else None

    # ── Step 1: Fetch ALL data for ALL tickers concurrently ────────────────
    # 4 endpoints × N tickers, all in parallel
    company_data: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        for ticker in all_tickers:
            # Fire all requests concurrently per ticker
            profile_t, metrics_t, ratios_t, qtrs_t, growth_t = await asyncio.gather(
                _fmp(client, "profile", ticker, 1),
                _fmp(client, "key-metrics", ticker, 1),
                _fmp(client, "ratios", ticker, 1),
                # Quarterly income — last 4 quarters for TTM
                _fmp(client, "income-statement", ticker, 4),
                _fmp(client, "income-statement-growth", ticker, 1),
            )
            # Add period=quarter param for quarterly data
            qtrs_q = []
            try:
                r = await client.get(
                    f"{FMP_BASE}/income-statement",
                    params={"symbol": ticker, "period": "quarter", "limit": 4, "apikey": api_key},
                    timeout=30.0,
                )
                if r.status_code == 200 and "application/json" in r.headers.get("content-type", ""):
                    qtrs_q = r.json() if isinstance(r.json(), list) else []
            except Exception:
                pass

            profile = profile_t[0] if isinstance(profile_t, list) and profile_t else {}
            met = metrics_t[0] if isinstance(metrics_t, list) and metrics_t else {}
            rat = ratios_t[0] if isinstance(ratios_t, list) and ratios_t else {}
            gro = growth_t[0] if isinstance(growth_t, list) and growth_t else {}

            # Build TTM from quarterly data (most current), fall back to annual
            annual = qtrs_t[0] if isinstance(qtrs_t, list) and qtrs_t else {}
            if qtrs_q and len(qtrs_q) >= 2:
                ttm = {
                    "revenue": _ttm(qtrs_q, "revenue"),
                    "ebitda": _ttm(qtrs_q, "ebitda"),
                    "netIncome": _ttm(qtrs_q, "netIncome"),
                    "epsDiluted": _ttm(qtrs_q, "epsDiluted"),
                    "grossProfit": _ttm(qtrs_q, "grossProfit"),
                    "operatingIncome": _ttm(qtrs_q, "operatingIncome"),
                    "period": "TTM",
                    "latest_quarter": qtrs_q[0].get("date", ""),
                }
            else:
                ttm = {
                    "revenue": annual.get("revenue"),
                    "ebitda": annual.get("ebitda"),
                    "netIncome": annual.get("netIncome"),
                    "epsDiluted": annual.get("epsDiluted") or annual.get("eps"),
                    "grossProfit": annual.get("grossProfit"),
                    "operatingIncome": annual.get("operatingIncome"),
                    "period": "Annual",
                    "latest_quarter": annual.get("date", ""),
                }

            company_data[ticker] = {
                "profile": profile,
                "metrics": met,
                "ratios": rat,
                "ttm": ttm,
                "growth": gro,
            }

    # ── Step 2: Build rich context block for Claude ────────────────────────
    context_parts = []
    for ticker in all_tickers:
        role = "TARGET" if ticker == target else "PEER"
        d = company_data.get(ticker, {})
        p = d.get("profile", {})
        m = d.get("metrics", {})
        r = d.get("ratios", {})
        inc = d.get("income", {})
        gro = d.get("growth", {})

        ttm = d.get("ttm", {})
        mc = p.get("marketCap") or m.get("marketCap")
        ev = m.get("enterpriseValue")
        revenue = ttm.get("revenue")
        ebitda = ttm.get("ebitda")
        net_income = ttm.get("netIncome")
        gross_profit = ttm.get("grossProfit")
        operating_income = ttm.get("operatingIncome")
        eps = ttm.get("epsDiluted")
        price = p.get("price")
        data_period = ttm.get("period", "Annual")
        latest_q = ttm.get("latest_quarter", "N/A")

        # Calculate valuation ratios from TTM data + current price/EV
        pe = None
        if price and eps and eps > 0:
            pe = round(price / eps, 2)

        ev_ebitda = None
        if ev and ebitda and ebitda > 0:
            ev_ebitda = round(ev / ebitda, 2)

        ev_rev = None
        if ev and revenue and revenue > 0:
            ev_rev = round(ev / revenue, 2)

        # Margins from TTM data (more current than ratios endpoint)
        gross_margin = round(gross_profit / revenue, 4) if gross_profit and revenue and revenue > 0 else r.get("grossProfitMargin")
        op_margin = round(operating_income / revenue, 4) if operating_income and revenue and revenue > 0 else r.get("operatingProfitMargin")
        net_margin = round(net_income / revenue, 4) if net_income and revenue and revenue > 0 else r.get("netProfitMargin")

        roe = m.get("roe") or r.get("returnOnEquity")

        def _b(v: float | int | None) -> str:
            if v is None:
                return "N/A"
            return f"${v / 1e9:.1f}B"

        def _pct(v: float | None) -> str:
            if v is None:
                return "N/A"
            return f"{v * 100:.1f}%" if abs(v) < 10 else f"{v:.1f}%"

        def _x(v: float | None) -> str:
            if v is None:
                return "N/A"
            return f"{v:.2f}x"

        rev_growth = gro.get("growthRevenue")
        ni_growth = gro.get("growthNetIncome")
        eps_growth = gro.get("growthEPS")

        context_parts.append(
            f"## [{role}] {ticker} — {p.get('companyName', ticker)}\n"
            f"Sector: {p.get('sector', 'N/A')} | Industry: {p.get('industry', 'N/A')}\n"
            f"Data basis: {data_period} (through {latest_q}) | Current price: ${price}\n"
            f"Market Cap: {_b(mc)} | Enterprise Value: {_b(ev)}\n"
            f"Revenue ({data_period}): {_b(revenue)} | EBITDA: {_b(ebitda)} | Net Income: {_b(net_income)}\n"
            f"EPS (diluted, {data_period}): {eps}\n\n"
            f"Valuation Multiples (current price vs {data_period} earnings):\n"
            f"  P/E: {_x(pe)}\n"
            f"  EV/EBITDA: {_x(ev_ebitda)}\n"
            f"  EV/Revenue: {_x(ev_rev)}\n"
            f"  P/B: {m.get('pbRatio') or r.get('priceToBookRatio') or 'N/A'}\n"
            f"  P/S: {r.get('priceToSalesRatio') or 'N/A'}\n\n"
            f"Margins ({data_period}):\n"
            f"  Gross: {_pct(gross_margin)}\n"
            f"  Operating: {_pct(op_margin)}\n"
            f"  Net: {_pct(net_margin)}\n\n"
            f"Returns & Leverage:\n"
            f"  ROE: {_pct(roe)}\n"
            f"  ROA: {_pct(r.get('returnOnAssets'))}\n"
            f"  Debt/Equity: {r.get('debtEquityRatio') or m.get('debtToEquity') or 'N/A'}\n\n"
            f"Growth (YoY, most recent annual):\n"
            f"  Revenue growth: {_pct(rev_growth)}\n"
            f"  Net income growth: {_pct(ni_growth)}\n"
            f"  EPS growth: {_pct(eps_growth)}\n"
        )
    context = "\n---\n\n".join(context_parts)

    # Step 2: Claude synthesis
    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.fast_model,
            max_tokens=3000,
            system=(
                "You are a senior equity research analyst building a comparable "
                "companies analysis. Given the target company and its peers, "
                "produce a structured comps table and analysis.\n\n"
                "## Output format\n"
                "Return ONLY a valid JSON object:\n"
                "{\n"
                '  "target": {\n'
                '    "ticker": "string", "company_name": "string",\n'
                '    "market_cap_b": number (in billions),\n'
                '    "ev_b": number (enterprise value in billions),\n'
                '    "revenue_b": number, "ebitda_b": number,\n'
                '    "pe_ratio": number, "ev_ebitda": number, "ev_revenue": number,\n'
                '    "gross_margin": number (0-1), "operating_margin": number,\n'
                '    "net_margin": number, "roe": number, "debt_to_equity": number,\n'
                '    "revenue_growth": number (0.15 = 15%)\n'
                "  },\n"
                '  "peers": [same shape as target, one per peer],\n'
                '  "median_multiples": {\n'
                '    "pe_ratio": number, "ev_ebitda": number, "ev_revenue": number,\n'
                '    "gross_margin": number, "revenue_growth": number\n'
                "  },\n"
                '  "implied_valuation": {\n'
                '    "based_on_ev_ebitda": "string ($XB — the implied EV using peer median EV/EBITDA)",\n'
                '    "based_on_ev_revenue": "string ($XB)",\n'
                '    "based_on_pe": "string ($XB)",\n'
                '    "current_vs_implied": "premium|discount|inline",\n'
                '    "premium_discount_pct": number\n'
                "  },\n"
                '  "analysis": "3-5 sentence takeaway: is the target cheap/expensive vs peers? Why?",\n'
                '  "key_differences": ["string — notable differences between target and peer group"]\n'
                "}\n\n"
                "## Rules\n"
                "- Use the actual numbers from the data provided\n"
                "- If a metric is missing for a company, use null\n"
                "- Calculate medians from available peer data\n"
                "- All dollar values in billions (e.g. 2.5 not 2500000000)\n"
                "- Margins and growth as decimals (0.15 not 15%)\n"
                "- The `median_multiples` and `implied_valuation` blocks are\n"
                "  recomputed by the system after you respond — still fill them in\n"
                "  with your best estimate, but do NOT rely on them being shown\n"
                "  verbatim, and never let the prose contradict them.\n"
                "- In the prose, express margin/ratio gaps in percentage POINTS\n"
                "  (e.g. 'an 8.2 pt gap'), not basis points — do not multiply by\n"
                "  10,000. Keep all arithmetic in the narrative simple and verifiable.\n"
                "- Output ONLY the JSON object, no markdown fences"
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Build a comps analysis for {target} vs peers: "
                    f"{', '.join(peers)}\n\n{context}"
                ),
            }],
        )
        answer_text = response.content[0].text
    except Exception as exc:
        logger.error("Claude comps analysis failed: %s", exc)
        raise HTTPException(502, "Failed to generate comps analysis.")

    # Parse
    analysis: dict = {}
    try:
        clean = answer_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        analysis = json.loads(clean.strip(), strict=False)
    except json.JSONDecodeError:
        logger.warning("Could not parse comps analysis as JSON")
        analysis = {"raw_analysis": answer_text, "parse_error": True}

    # ── Overwrite the model's derived figures with deterministic Python math ──
    # Claude transcribes the per-company table well but mis-computes the implied
    # valuations and the premium-vs-peers number. Recompute both (plus the peer
    # medians) from the raw FMP data so the implied boxes always reconcile with
    # the displayed multiples. Leaves the narrative + per-company rows untouched.
    if isinstance(analysis, dict) and not analysis.get("parse_error"):
        try:
            med_mult, implied_val = _compute_comps_math(company_data, target, peers)
            if med_mult is not None:
                analysis["median_multiples"] = med_mult
            if implied_val is not None:
                analysis["implied_valuation"] = implied_val
        except Exception as exc:
            logger.warning("Comps math recompute failed, keeping model output: %s", exc)

    # Persist
    record = CompsAnalysis(
        user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        target_ticker=target,
        peer_tickers=peers,
        analysis=analysis,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return CompsResponse(
        id=record.id,
        target_ticker=record.target_ticker,
        peer_tickers=record.peer_tickers or [],
        analysis=record.analysis,
        created_at=record.created_at.isoformat(),
    )


@router.get("/history", response_model=list[CompsResponse])
async def get_comps_history(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=20, le=50),
) -> list[CompsResponse]:
    result = await db.execute(
        select(CompsAnalysis)
        .where(CompsAnalysis.workspace_id == ctx.workspace.id)
        .order_by(CompsAnalysis.created_at.desc())
        .limit(limit)
    )
    return [
        CompsResponse(
            id=r.id,
            target_ticker=r.target_ticker,
            peer_tickers=r.peer_tickers or [],
            analysis=r.analysis,
            created_at=r.created_at.isoformat(),
        )
        for r in result.scalars().all()
    ]


@router.delete("/{analysis_id}", status_code=204)
async def delete_comps(
    analysis_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    result = await db.execute(
        select(CompsAnalysis).where(
            CompsAnalysis.id == analysis_id,
            CompsAnalysis.workspace_id == ctx.workspace.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Comps analysis not found")
    await db.delete(record)
    await db.commit()
