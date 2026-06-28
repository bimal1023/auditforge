"""
SEC EDGAR MCP Server
====================
Exposes three tools to any MCP client (e.g. the FinancialAgent):

  search_company(name)                     → CIK + metadata
  get_filing_list(cik, form_type)          → list of recent filings
  get_filing_text(cik, accession_number)   → extracted filing text

Rate-limit: SEC asks for max 10 req/s; we stay conservative with an
asyncio.Semaphore(8) across all concurrent requests.

Run standalone:
  python mcp_servers/sec_edgar/server.py
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

USER_AGENT = os.environ.get("SEC_EDGAR_USER_AGENT", "")
if not USER_AGENT:
    raise RuntimeError(
        "SEC_EDGAR_USER_AGENT env var is required (e.g. 'CompanyName contact@example.com'). "
        "SEC EDGAR requires a valid contact in the User-Agent header."
    )

_sem = asyncio.Semaphore(8)

mcp = FastMCP("sec-edgar")

BASE_DATA = "https://data.sec.gov"
BASE_EFTS = "https://efts.sec.gov"
BASE_WWW = "https://www.sec.gov"

_HEADERS = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    params: Optional[dict] = None,
    retries: int = 4,
) -> dict:
    """GET with exponential back-off on 429 and transient errors."""
    async with _sem:
        for attempt in range(retries):
            try:
                r = await client.get(url, params=params, headers=_HEADERS, timeout=30.0)
                if r.status_code == 429:
                    wait = 2 ** attempt
                    await asyncio.sleep(wait)
                    continue
                r.raise_for_status()
                return r.json()
            except httpx.HTTPStatusError:
                if attempt == retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
            except httpx.RequestError:
                if attempt == retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
    return {}


def _pad_cik(cik: str | int) -> str:
    return str(int(cik)).zfill(10)


def _acc_no_nodash(acc: str) -> str:
    return acc.replace("-", "")


def _acc_no_dashed(acc: str) -> str:
    clean = _acc_no_nodash(acc)
    return f"{clean[:10]}-{clean[10:12]}-{clean[12:]}"


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_company(name: str) -> dict:
    """
    Search SEC EDGAR for a company by name or ticker.

    Returns up to 10 matches, each with:
      - cik         (10-digit zero-padded string)
      - name        (official company name)
      - ticker      (exchange ticker if available)

    Uses the bulk company_tickers.json for fast matching.
    """
    async with httpx.AsyncClient() as client:
        tickers_data: dict = await _get_json(
            client, f"{BASE_WWW}/files/company_tickers.json"
        )

    name_lower = name.lower().strip()
    matches: list[dict] = []

    for entry in tickers_data.values():
        title: str = entry.get("title", "")
        ticker: str = entry.get("ticker", "")
        if name_lower in title.lower() or name_lower == ticker.lower():
            matches.append({
                "cik": _pad_cik(entry["cik_str"]),
                "name": title,
                "ticker": ticker,
            })
        if len(matches) >= 10:
            break

    # If no fuzzy match, try EFTS full-text search as fallback
    if not matches:
        async with httpx.AsyncClient() as client:
            efts = await _get_json(
                client,
                f"{BASE_EFTS}/LATEST/search-index",
                params={"q": f'"{name}"', "forms": "10-K"},
            )
        hits = efts.get("hits", {}).get("hits", [])
        for hit in hits[:10]:
            src = hit.get("_source", {})
            matches.append({
                "cik": _pad_cik(src.get("entity_id", "0")),
                "name": src.get("display_names", [name])[0],
                "ticker": src.get("file_num", ""),
            })

    return {"query": name, "matches": matches}


@mcp.tool()
async def get_filing_list(cik: str, form_type: str = "10-K") -> dict:
    """
    Return recent filings of *form_type* for the company identified by *cik*.

    Each filing record includes:
      - form              (e.g. "10-K")
      - accession_number  (dashed, e.g. "0000320193-24-000123")
      - filing_date       (ISO string)
      - primary_document  (filename of the primary document)
      - cik               (zero-padded)

    Returns up to 10 most recent filings of the requested type.
    """
    cik_padded = _pad_cik(cik)

    async with httpx.AsyncClient() as client:
        data = await _get_json(
            client, f"{BASE_DATA}/submissions/CIK{cik_padded}.json"
        )

    recent = data.get("filings", {}).get("recent", {})
    forms: list[str] = recent.get("form", [])
    acc_nos: list[str] = recent.get("accessionNumber", [])
    dates: list[str] = recent.get("filingDate", [])
    docs: list[str] = recent.get("primaryDocument", [])

    filings: list[dict] = []
    for i, form in enumerate(forms):
        if form == form_type:
            filings.append({
                "form": form,
                "accession_number": acc_nos[i] if i < len(acc_nos) else "",
                "filing_date": dates[i] if i < len(dates) else "",
                "primary_document": docs[i] if i < len(docs) else "",
                "cik": cik_padded,
            })
        if len(filings) >= 10:
            break

    return {
        "cik": cik_padded,
        "company_name": data.get("name", ""),
        "form_type": form_type,
        "filings": filings,
    }


@mcp.tool()
async def get_latest_filing(cik: str, prefer_quarterly: bool = True) -> dict:
    """
    Return the single most-recent SEC filing for a company, checking both
    10-K (annual) and 10-Q (quarterly) form types and picking the one with
    the latest filing_date.

    Args:
        cik              : company CIK (will be zero-padded)
        prefer_quarterly : if True (default), prefer a 10-Q filed after the
                           most recent 10-K (i.e. return the freshest data).
                           Set False to always return the latest 10-K.

    Returns:
        form            : "10-K" or "10-Q"
        accession_number: dashed format
        filing_date     : ISO date string
        period_of_report: end-of-period date (e.g. "2026-03-31" for Q2 FY2026)
        primary_document: filename
        cik             : zero-padded
        company_name    : official SEC name
    """
    cik_padded = _pad_cik(cik)

    async with httpx.AsyncClient() as client:
        data = await _get_json(
            client, f"{BASE_DATA}/submissions/CIK{cik_padded}.json"
        )

    recent = data.get("filings", {}).get("recent", {})
    forms: list[str] = recent.get("form", [])
    acc_nos: list[str] = recent.get("accessionNumber", [])
    dates: list[str] = recent.get("filingDate", [])
    docs: list[str] = recent.get("primaryDocument", [])
    periods: list[str] = recent.get("reportDate", [])

    best_10k: dict | None = None
    best_10q: dict | None = None

    for i, form in enumerate(forms):
        if form not in ("10-K", "10-Q"):
            continue
        entry = {
            "form": form,
            "accession_number": acc_nos[i] if i < len(acc_nos) else "",
            "filing_date": dates[i] if i < len(dates) else "",
            "period_of_report": periods[i] if i < len(periods) else "",
            "primary_document": docs[i] if i < len(docs) else "",
            "cik": cik_padded,
            "company_name": data.get("name", ""),
        }
        if form == "10-K" and best_10k is None:
            best_10k = entry
        elif form == "10-Q" and best_10q is None:
            best_10q = entry
        if best_10k and best_10q:
            break

    if not best_10k and not best_10q:
        return {"error": "No 10-K or 10-Q filings found", "cik": cik_padded}

    if not prefer_quarterly or best_10q is None:
        return best_10k or best_10q  # type: ignore[return-value]

    if best_10k is None:
        return best_10q

    # Return whichever was filed more recently
    return best_10q if best_10q["filing_date"] > best_10k["filing_date"] else best_10k


@mcp.tool()
async def get_recent_8k_filings(cik: str, max_results: int = 5) -> dict:
    """
    Return recent 8-K filings (material events) for a company.

    8-Ks disclose material events between quarterly reports: M&A, leadership
    changes, restructurings, guidance revisions, debt offerings, buyback
    authorisations, etc. PE analysts read these to understand what happened
    since the last 10-Q.

    Returns up to *max_results* 8-K filings with:
      - form, accession_number, filing_date, primary_document, description, cik

    Use get_filing_text(cik, accession_number) to read the full text of any 8-K.
    """
    cik_padded = _pad_cik(cik)
    max_results = min(max_results, 10)

    async with httpx.AsyncClient() as client:
        data = await _get_json(
            client, f"{BASE_DATA}/submissions/CIK{cik_padded}.json"
        )

    recent = data.get("filings", {}).get("recent", {})
    forms: list[str] = recent.get("form", [])
    acc_nos: list[str] = recent.get("accessionNumber", [])
    dates: list[str] = recent.get("filingDate", [])
    docs: list[str] = recent.get("primaryDocument", [])
    descs: list[str] = recent.get("primaryDocDescription", [])

    filings: list[dict] = []
    for i, form in enumerate(forms):
        if form in ("8-K", "8-K/A"):
            filings.append({
                "form": form,
                "accession_number": acc_nos[i] if i < len(acc_nos) else "",
                "filing_date": dates[i] if i < len(dates) else "",
                "primary_document": docs[i] if i < len(docs) else "",
                "description": descs[i] if i < len(descs) else "",
                "cik": cik_padded,
            })
        if len(filings) >= max_results:
            break

    return {
        "cik": cik_padded,
        "company_name": data.get("name", ""),
        "filings": filings,
    }


# ---------------------------------------------------------------------------
# Structured XBRL financial facts
# ---------------------------------------------------------------------------

# Curated us-gaap tags per metric. First candidate that returns data wins.
# kind="flow" → measured over a period (revenue, income); compare same quarter
# year-over-year. kind="instant" → balance-sheet snapshot; compare same
# quarter-end balance year-over-year.
# ── Income statement ──────────────────────────────────────────────────────
_FACT_TAGS: dict[str, tuple[list[str], str]] = {
    "revenue": (
        ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
         "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
        "flow",
    ),
    "cost_of_revenue": (
        ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold"],
        "flow",
    ),
    "gross_profit": (["GrossProfit"], "flow"),
    "operating_income": (["OperatingIncomeLoss"], "flow"),
    "sga_expense": (
        ["SellingGeneralAndAdministrativeExpense",
         "GeneralAndAdministrativeExpense"],
        "flow",
    ),
    "rnd_expense": (
        ["ResearchAndDevelopmentExpense",
         "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
        "flow",
    ),
    "depreciation_amortization": (
        ["DepreciationDepletionAndAmortization",
         "DepreciationAmortizationAndAccretionNet",
         "DepreciationAndAmortization"],
        "flow",
    ),
    "net_income": (["NetIncomeLoss", "ProfitLoss"], "flow"),
    "eps_diluted": (
        ["EarningsPerShareDiluted", "IncomeLossFromContinuingOperationsPerDilutedShare"],
        "flow",
    ),
    # ── Cash flow ─────────────────────────────────────────────────────────
    "operating_cash_flow": (
        ["NetCashProvidedByUsedInOperatingActivities",
         "NetCashProvidedByOperatingActivities",
         "CashFlowsFromUsedInOperatingActivities"],
        "flow",
    ),
    "capital_expenditure": (
        ["PaymentsToAcquirePropertyPlantAndEquipment",
         "CapitalExpenditureDiscontinuedOperations",
         "PaymentsToAcquireProductiveAssets"],
        "flow",
    ),
    "dividends_paid": (
        ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends",
         "PaymentsOfOrdinaryDividends"],
        "flow",
    ),
    "share_repurchases": (
        ["PaymentsForRepurchaseOfCommonStock",
         "StockRepurchasedAndRetiredDuringPeriodValue",
         "PaymentsForRepurchaseOfEquity"],
        "flow",
    ),
    # ── Balance sheet ─────────────────────────────────────────────────────
    "cash_and_equivalents": (
        ["CashAndCashEquivalentsAtCarryingValue",
         "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
        "instant",
    ),
    "total_assets": (["Assets"], "instant"),
    "total_current_assets": (["AssetsCurrent"], "instant"),
    "total_current_liabilities": (["LiabilitiesCurrent"], "instant"),
    "stockholders_equity": (
        ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
        "instant",
    ),
    "long_term_debt": (["LongTermDebtNoncurrent", "LongTermDebt"], "instant"),
    "current_debt": (["LongTermDebtCurrent", "DebtCurrent"], "instant"),
}

# ── Output metrics (map to FinancialSection fields + new sub-sections) ──
_OUTPUT_METRICS = (
    # Core income statement
    "revenue", "cost_of_revenue", "gross_profit", "operating_income",
    "sga_expense", "rnd_expense", "ebitda", "net_income", "eps_diluted",
    # Cash flow
    "operating_cash_flow", "capital_expenditure", "free_cash_flow",
    "dividends_paid", "share_repurchases",
    # Balance sheet
    "total_debt", "cash_and_equivalents",
    "total_assets", "total_current_assets", "total_current_liabilities",
    "stockholders_equity",
)


def _days_between(start: str | None, end: str) -> Optional[int]:
    if not start:
        return None
    from datetime import date as _date
    sy, sm, sd = map(int, start.split("-"))
    ey, em, ed = map(int, end.split("-"))
    return (_date(ey, em, ed) - _date(sy, sm, sd)).days


_MONTHS = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
           7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}


def _period_label(kind: str, start: Optional[str], end: str) -> str:
    """
    Human label derived from the period-END date (XBRL fp/fy fields are
    unreliable for comparatives — they carry the filing's context, not the
    data point's own period). Examples:
      flow quarter → "Qtr ended Mar 2026"
      flow year    → "FY2025"
      instant      → "As of Mar 2026"
    """
    year = end[:4]
    mon = _MONTHS[int(end[5:7])]
    if kind == "instant":
        return f"As of {mon} {year}"
    days = _days_between(start, end)
    if days and days > 300:
        return f"FY{year}"
    return f"Qtr ended {mon} {year}"


def _point(u: dict, kind: str) -> dict:
    end = u["end"]
    return {
        "label": _period_label(kind, u.get("start"), end),
        "year": int(end[:4]),          # calendar year of period end (for trend ordering)
        "end": end,
        "value": float(u["val"]),
    }


def _end_close(a: str, b: str, tol: int = 20) -> bool:
    """True if two period-end dates fall on roughly the same month/day."""
    from datetime import date as _date
    am, ad = int(a[5:7]), int(a[8:10])
    bm, bd = int(b[5:7]), int(b[8:10])
    da = _date(2001, am, min(ad, 28))
    db = _date(2001, bm, min(bd, 28))
    diff = abs((da - db).days)
    return min(diff, 365 - diff) <= tol


def _same_period_series(units: list[dict], kind: str, max_points: int = 5) -> list[dict]:
    """
    Build a period-consistent series across years from raw XBRL units.

    For flow metrics: keep only single-quarter (≈3-month) periods, then the
    same calendar quarter-end across years. For instant metrics: keep balance
    snapshots at the same quarter-end across years. Matching is by period-END
    date (not fp), so a quarter is never mixed with a full-year or TTM figure.
    """
    if kind == "flow":
        candidates = [
            u for u in units
            if u.get("end") and (d := _days_between(u.get("start"), u["end"])) is not None
            and 50 <= d <= 120
        ]
    else:  # instant
        candidates = [u for u in units if u.get("end") and not u.get("start")]

    if not candidates:
        return []

    by_end: dict[str, dict] = {u["end"]: u for u in candidates}
    ends = sorted(by_end)
    latest_end = ends[-1]

    selected = [by_end[e] for e in ends if _end_close(e, latest_end)]
    selected.sort(key=lambda u: u["end"])

    return [_point(u, kind) for u in selected[-max_points:]]


async def _fetch_concept(
    client: httpx.AsyncClient, cik_padded: str, tags: list[str]
) -> list[dict]:
    """
    Fetch all candidate tags and return the units list with the FRESHEST data.

    Companies sometimes switch XBRL tags over time (e.g. Alphabet moved off
    RevenueFromContractWithCustomerExcludingAssessedTax), so picking the first
    tag that merely has *any* data can return a stale series. 404s mean the tag
    was never used — skip without retrying.
    """
    best: list[dict] = []
    best_end = ""
    for tag in tags:
        url = f"{BASE_DATA}/api/xbrl/companyconcept/CIK{cik_padded}/us-gaap/{tag}.json"
        try:
            async with _sem:
                r = await client.get(url, headers=_HEADERS, timeout=30.0)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            units = (r.json().get("units", {}) or {}).get("USD", [])
        except Exception:
            continue
        if not units:
            continue
        mx = max((u.get("end", "") for u in units), default="")
        if mx > best_end:
            best_end, best = mx, units
    return best


def _yoy(series: list[dict]) -> Optional[float]:
    if len(series) >= 2 and series[-2]["value"]:
        return round((series[-1]["value"] - series[-2]["value"]) / abs(series[-2]["value"]), 4)
    return None


@mcp.tool()
async def get_company_facts(cik: str) -> dict:
    """
    Return STRUCTURED, period-tagged financial metrics from SEC XBRL data.

    This is the preferred source for public-company financials — it pulls exact
    values straight from the company's XBRL filings (no HTML scraping), each
    tagged with its precise period, so quarterly and annual figures are never
    confused.

    For every metric it returns a `series` of the SAME period across recent
    years (e.g. Q1 FY2026, Q1 FY2025, Q1 FY2024 …) plus a pre-computed
    year-over-year growth rate. Use these directly — do not pair a quarter with
    a full-year value.

    Returns:
        cik, company_name, unit ("USD"), as_of (latest period-end date), and
        metrics: a dict of {revenue, gross_profit, ebitda, net_income,
        total_debt, cash_and_equivalents}. Each metric has:
          - kind: "flow" (period total) or "instant" (balance snapshot)
          - source_tag: the XBRL tag (or "computed: …" for derived metrics)
          - latest / prior_year: {label, year, end, value}
          - yoy_growth: decimal (0.22 = +22%) between latest and prior_year
          - series: list of {label, year, end, value} for trend charts
    """
    cik_padded = _pad_cik(cik)
    raw: dict[str, dict] = {}

    async with httpx.AsyncClient() as client:
        sub = await _get_json(client, f"{BASE_DATA}/submissions/CIK{cik_padded}.json")
        company_name = sub.get("name", "")

        # Fetch all metric concepts concurrently — was sequential (~50 HTTP calls one-by-one);
        # now runs in parallel gated by the existing Semaphore(8). ~5× faster.
        items = list(_FACT_TAGS.items())
        concept_results = await asyncio.gather(
            *[_fetch_concept(client, cik_padded, tags) for _, (tags, _) in items],
            return_exceptions=True,
        )
        for (key, (_, kind)), units in zip(items, concept_results):
            if isinstance(units, Exception) or not units:
                continue
            series = _same_period_series(units, kind)
            if series:
                raw[key] = {"kind": kind, "series": series}

    # ── Derived metrics ────────────────────────────────────────────────────

    def _align_sum(a_key: str, b_key: str, out_key: str, kind: str, tag: str) -> None:
        if a_key not in raw:
            return
        a = {p["end"]: p for p in raw[a_key]["series"]}
        b = {p["end"]: p for p in raw.get(b_key, {}).get("series", [])}
        pts = [
            {"label": a[e]["label"], "year": a[e]["year"], "end": e,
             "value": a[e]["value"] + (b[e]["value"] if e in b else 0.0)}
            for e in sorted(a)
        ]
        if pts:
            raw[out_key] = {"kind": kind, "series": pts[-5:], "source_tag": tag}

    def _align_diff(a_key: str, b_key: str, out_key: str, kind: str, tag: str) -> None:
        if a_key not in raw or b_key not in raw:
            return
        a = {p["end"]: p for p in raw[a_key]["series"]}
        b = {p["end"]: p for p in raw[b_key]["series"]}
        pts = [
            {"label": a[e]["label"], "year": a[e]["year"], "end": e,
             "value": a[e]["value"] - b[e]["value"]}
            for e in sorted(set(a) & set(b))
        ]
        if pts:
            raw[out_key] = {"kind": kind, "series": pts[-5:], "source_tag": tag}

    # EBITDA ≈ operating income + depreciation & amortization.
    _align_sum("operating_income", "depreciation_amortization", "ebitda",
               "flow", "computed: OperatingIncome + D&A")

    # Total debt = long-term + current portion.
    _align_sum("long_term_debt", "current_debt", "total_debt",
               "instant", "computed: LongTermDebt + CurrentDebt")

    # Free cash flow = operating cash flow − capital expenditure.
    _align_diff("operating_cash_flow", "capital_expenditure", "free_cash_flow",
                "flow", "computed: OperatingCF − CapEx")

    # ── Assemble output (only the FinancialSection-mapped metrics) ──────────
    metrics: dict[str, dict] = {}
    for key in _OUTPUT_METRICS:
        if key not in raw:
            continue
        m = raw[key]
        s = m["series"]
        metrics[key] = {
            "kind": m["kind"],
            "source_tag": m.get("source_tag", "XBRL"),
            "latest": s[-1] if s else None,
            "prior_year": s[-2] if len(s) >= 2 else None,
            "yoy_growth": _yoy(s),
            "series": s,
        }

    as_of = None
    if metrics.get("revenue", {}).get("latest"):
        as_of = metrics["revenue"]["latest"]["end"]

    return {
        "cik": cik_padded,
        "company_name": company_name,
        "unit": "USD",
        "as_of": as_of,
        "metrics": metrics,
    }


@mcp.tool()
async def get_filing_text(
    cik: str,
    accession_number: str,
    section: Optional[str] = None,
) -> dict:
    """
    Fetch the text of a specific SEC filing.

    Args:
        cik               : company CIK (will be zero-padded automatically)
        accession_number  : dashed or plain (e.g. "0000320193-24-000123")
        section           : optional Item name to extract, e.g. "Item 7" or
                            "Item 1A" (risk factors). If None, returns the
                            first 15 000 chars of the full filing.

    Returns:
        text        : extracted text (capped at 15 000 chars)
        source_url  : canonical EDGAR URL of the document
        section     : the requested section (or None)
    """
    cik_padded = _pad_cik(cik)
    cik_int = int(cik_padded)
    acc_clean = _acc_no_nodash(accession_number)
    acc_dashed = _acc_no_dashed(accession_number)

    # Build the filing index URL
    index_url = (
        f"{BASE_WWW}/Archives/edgar/data/{cik_int}/{acc_clean}/{acc_dashed}-index.htm"
    )

    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(index_url, headers=_HEADERS, timeout=30.0)
            r.raise_for_status()
            index_html = r.text

            # Pull first .htm document link that isn't the index itself
            doc_links = re.findall(
                rf'/Archives/edgar/data/{cik_int}/{acc_clean}/[^"]+\.htm',
                index_html,
                re.IGNORECASE,
            )
            doc_links = [l for l in doc_links if "index" not in l.lower()]

            if not doc_links:
                # Fallback: try the viewer API
                viewer_url = (
                    f"{BASE_WWW}/cgi-bin/browse-edgar"
                    f"?action=getcompany&CIK={cik_padded}&type=10-K"
                    f"&dateb=&owner=include&count=1"
                )
                return {
                    "error": "Could not locate primary document in filing index",
                    "index_url": index_url,
                    "source_url": viewer_url,
                }

            doc_url = f"{BASE_WWW}{doc_links[0]}"
            doc_r = await client.get(doc_url, headers=_HEADERS, timeout=60.0)
            doc_r.raise_for_status()

            # Strip HTML
            raw = doc_r.text
            text = re.sub(r"<[^>]+>", " ", raw)
            text = re.sub(r"&[a-zA-Z]+;", " ", text)
            text = re.sub(r"\s{2,}", " ", text).strip()

            # Extract section if requested
            if section:
                # Matches "Item 7." or "ITEM 7A." etc.
                pattern = re.compile(
                    rf"({re.escape(section)}[A-Za-z.\s]{{0,20}})(.+?)(?=Item\s+\d|ITEM\s+\d|\Z)",
                    re.IGNORECASE | re.DOTALL,
                )
                m = pattern.search(text)
                if m:
                    text = m.group(0)[:12_000]
                else:
                    text = text[:15_000]
            else:
                text = text[:15_000]

            return {
                "cik": cik_padded,
                "accession_number": acc_dashed,
                "section": section,
                "text": text,
                "source_url": doc_url,
            }

        except httpx.HTTPStatusError as exc:
            import logging as _log
            _log.getLogger(__name__).warning(
                "SEC EDGAR HTTP %s fetching %s/%s",
                exc.response.status_code, cik_padded, acc_dashed,
            )
            return {
                "error": f"SEC EDGAR returned HTTP {exc.response.status_code}",
                "cik": cik_padded,
                "accession_number": acc_dashed,
            }
        except Exception as exc:
            import logging as _log
            _log.getLogger(__name__).exception(
                "SEC EDGAR unexpected error for %s/%s", cik_padded, acc_dashed,
            )
            return {
                "error": "Failed to retrieve filing — see server logs",
                "cik": cik_padded,
                "accession_number": acc_dashed,
            }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
