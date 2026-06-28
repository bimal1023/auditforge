"""Stock screener — filter companies by fundamentals, analyze with Claude."""
from __future__ import annotations

import json
import logging

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.models.db import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/screener", tags=["screener"])

FMP_BASE = "https://financialmodelingprep.com/stable"


# ── Schemas ──────────────────────────────────────────────────────────────────

class ScreenRequest(BaseModel):
    sector: str | None = None
    industry: str | None = None
    market_cap_min: int | None = None  # in USD
    market_cap_max: int | None = None
    exchange: str | None = None
    limit: int = 20


class ScreenResult(BaseModel):
    ticker: str
    company: str
    market_cap: float | None = None
    price: float | None = None
    sector: str = ""
    industry: str = ""
    exchange: str = ""


class ScreenResponse(BaseModel):
    results: list[ScreenResult]
    ai_summary: str | None = None
    filters_used: dict


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/search", response_model=ScreenResponse)
@limiter.limit("20/minute")
async def screen_stocks(
    request: Request,
    body: ScreenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ScreenResponse:
    """Screen stocks by fundamental criteria."""
    settings = get_settings()

    if not settings.fmp_api_key:
        raise HTTPException(
            503,
            "Screener requires an FMP API key. Add FMP_API_KEY to infra/.env.",
        )

    # Step 1: Build candidate list from curated universe, then fetch profiles
    if body.sector and body.sector in SECTOR_TICKERS:
        candidates = SECTOR_TICKERS[body.sector]
    else:
        candidates = ALL_TICKERS

    limit = min(body.limit, 50)
    screen_results: list[dict] = []

    async def _fetch_profile(client: httpx.AsyncClient, ticker: str) -> dict | None:
        """Fetch a single profile from FMP stable API."""
        try:
            r = await client.get(
                f"{FMP_BASE}/profile",
                params={"symbol": ticker, "apikey": settings.fmp_api_key},
            )
            if r.status_code != 200:
                return None
            ct = r.headers.get("content-type", "")
            if "application/json" not in ct:
                return None
            data = r.json()
            return data[0] if isinstance(data, list) and data else None
        except Exception:
            return None

    try:
        import asyncio
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch profiles concurrently in batches of 15
            for i in range(0, len(candidates), 15):
                batch = candidates[i : i + 15]
                tasks = [_fetch_profile(client, t) for t in batch]
                profiles = await asyncio.gather(*tasks)

                for p in profiles:
                    if not p:
                        continue
                    mc = p.get("marketCap") or 0
                    exch = p.get("exchange", "")

                    if body.market_cap_min and mc < body.market_cap_min:
                        continue
                    if body.market_cap_max and mc > body.market_cap_max:
                        continue
                    if body.exchange and body.exchange.upper() not in exch.upper():
                        continue

                    screen_results.append({
                        "ticker": p.get("symbol", ""),
                        "company": p.get("companyName", ""),
                        "market_cap": p.get("marketCap"),
                        "price": p.get("price"),
                        "sector": p.get("sector", ""),
                        "industry": p.get("industry", ""),
                        "exchange": exch,
                    })

                if len(screen_results) >= limit:
                    break

    except Exception as exc:
        logger.error("Stock screener failed: %s", exc)
        raise HTTPException(502, "Screener query failed. Please try again.")

    # Sort by market cap descending
    screen_results.sort(key=lambda r: r.get("market_cap") or 0, reverse=True)
    screen_results = screen_results[:limit]
    if not screen_results:
        return ScreenResponse(
            results=[],
            ai_summary="No companies matched the given criteria. Try broadening your filters.",
            filters_used=body.model_dump(exclude_none=True),
        )

    results = [
        ScreenResult(
            ticker=r.get("ticker", ""),
            company=r.get("company", ""),
            market_cap=r.get("market_cap"),
            price=r.get("price"),
            sector=r.get("sector", ""),
            industry=r.get("industry", ""),
            exchange=r.get("exchange", ""),
        )
        for r in screen_results
    ]

    # Step 2: AI summary (best-effort)
    ai_summary = None
    try:
        summary_lines = []
        for r in screen_results[:20]:
            mc = r.get("market_cap")
            mc_str = f"${mc / 1e9:.1f}B" if mc and mc > 1e9 else f"${mc / 1e6:.0f}M" if mc else "N/A"
            summary_lines.append(
                f"- {r.get('ticker', '?')} ({r.get('company', '?')}): "
                f"mkt cap {mc_str}, price ${r.get('price', '?')}, "
                f"{r.get('sector', '')}/{r.get('industry', '')}"
            )
        context = "\n".join(summary_lines)

        filter_desc = []
        if body.sector:
            filter_desc.append(f"Sector: {body.sector}")
        if body.industry:
            filter_desc.append(f"Industry: {body.industry}")
        if body.market_cap_min:
            filter_desc.append(f"Min cap: ${body.market_cap_min / 1e9:.1f}B")
        if body.market_cap_max:
            filter_desc.append(f"Max cap: ${body.market_cap_max / 1e9:.1f}B")
        filter_str = ", ".join(filter_desc) if filter_desc else "No specific filters"

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.fast_model,
            max_tokens=500,
            system=(
                "You are an equity research analyst. Given a list of screener results, "
                "write a concise 2-3 sentence plain-text summary of what this group of companies "
                "represents. Note any standout names, sector themes, or valuation patterns. "
                "Be specific and reference actual company names. "
                "Do NOT use markdown formatting — no headings, no bullets, no bold. Just plain sentences."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Screening criteria: {filter_str}\n"
                    f"Found {len(screen_results)} companies:\n\n{context}"
                ),
            }],
        )
        text = response.content[0].text.strip()
        # Strip markdown headings if model ignores the instruction
        while text.startswith("#"):
            text = text.lstrip("#").strip()
        ai_summary = text
    except Exception as exc:
        logger.warning("AI summary for screener failed (non-fatal): %s", exc)

    return ScreenResponse(
        results=results,
        ai_summary=ai_summary,
        filters_used=body.model_dump(exclude_none=True),
    )


# ── Curated stock universe (FMP stock-screener is restricted on most plans) ──

SECTOR_TICKERS: dict[str, list[str]] = {
    "Technology": [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSM", "AVGO",
        "ORCL", "CRM", "ADBE", "CSCO", "INTC", "AMD", "QCOM", "TXN",
        "IBM", "NOW", "INTU", "AMAT", "MU", "LRCX", "KLAC", "SNPS",
        "CDNS", "PANW", "CRWD", "FTNT", "ZS", "NET", "SHOP", "SQ",
    ],
    "Healthcare": [
        "UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT",
        "DHR", "BMY", "AMGN", "GILD", "ISRG", "MDT", "CVS", "CI",
        "ELV", "ZTS", "VRTX", "REGN", "MRNA", "BIIB", "ILMN", "DXCM",
    ],
    "Financial Services": [
        "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS",
        "SPGI", "BLK", "C", "AXP", "SCHW", "CME", "ICE", "MCO",
        "CB", "PGR", "MMC", "AON", "MET", "AIG", "PRU", "TRV",
    ],
    "Consumer Cyclical": [
        "TSLA", "HD", "NKE", "MCD", "SBUX", "LOW", "TJX",
        "BKNG", "CMG", "ABNB", "MAR", "GM", "F", "ORLY", "ROST",
        "DHI", "LEN", "LULU", "YUM", "DPZ", "DKNG", "ETSY", "W",
    ],
    "Communication Services": [
        "GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS",
        "CHTR", "EA", "TTWO", "RBLX", "SPOT", "SNAP", "PINS",
    ],
    "Industrials": [
        "UNP", "HON", "UPS", "BA", "CAT", "RTX", "DE", "LMT",
        "GE", "MMM", "FDX", "WM", "ETN", "ITW", "EMR", "NSC",
        "CSX", "TT", "PH", "ROK", "GD", "NOC",
    ],
    "Consumer Defensive": [
        "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ",
        "CL", "GIS", "KMB", "SYY", "HSY", "STZ", "TSN",
    ],
    "Energy": [
        "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO",
        "OXY", "HAL", "DVN", "FANG", "HES", "BKR", "KMI",
    ],
    "Basic Materials": [
        "LIN", "APD", "SHW", "FCX", "NEM", "ECL", "DD", "NUE",
        "VMC", "MLM", "PPG", "DOW", "CF", "CTVA",
    ],
    "Real Estate": [
        "PLD", "AMT", "CCI", "EQIX", "PSA", "O", "SPG", "WELL",
        "DLR", "VICI", "AVB", "EQR", "ARE", "MAA", "INVH",
    ],
    "Utilities": [
        "NEE", "DUK", "SO", "D", "AEP", "SRE", "XEL", "ED",
        "EXC", "WEC", "ES", "AWK", "CMS", "DTE", "PPL",
    ],
}

ALL_TICKERS = sorted({t for tickers in SECTOR_TICKERS.values() for t in tickers})

SECTORS = list(SECTOR_TICKERS.keys())
EXCHANGES = ["NYSE", "NASDAQ", "AMEX"]

CAP_RANGES = [
    {"label": "Mega (>$200B)", "min": 200_000_000_000, "max": None},
    {"label": "Large ($10B–$200B)", "min": 10_000_000_000, "max": 200_000_000_000},
    {"label": "Mid ($2B–$10B)", "min": 2_000_000_000, "max": 10_000_000_000},
    {"label": "Small ($300M–$2B)", "min": 300_000_000, "max": 2_000_000_000},
    {"label": "Micro (<$300M)", "min": None, "max": 300_000_000},
]


@router.get("/filters")
async def get_screener_filters(
    user: User = Depends(get_current_user),
) -> dict:
    """Return available filter options for the screener UI."""
    return {
        "sectors": SECTORS,
        "exchanges": EXCHANGES,
        "cap_ranges": CAP_RANGES,
    }
