"""
Earnings MCP Server (Financial Modeling Prep — Stable API)
==========================================================
Tools for fetching financial data from FMP's /stable/ endpoints.

  get_earnings_transcript   → full transcript (requires paid plan)
  get_earnings_surprise     → EPS actuals vs estimates
  get_earnings_calendar     → upcoming earnings dates
  get_company_profile       → company info, sector, market cap
  get_key_metrics           → P/E, EV/EBITDA, ROE, margins
  get_financial_ratios      → margin trends and efficiency
  get_income_growth         → revenue/earnings growth rates
  get_company_quote         → real-time price + change
  get_income_statement      → revenue, EBITDA, net income
  screen_stocks             → filter by sector/exchange/cap (curated universe)

Run standalone:
  FMP_API_KEY=... python mcp_servers/earnings/server.py
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

FMP_API_KEY = os.environ.get("FMP_API_KEY", "")
FMP_BASE = "https://financialmodelingprep.com/stable"

mcp = FastMCP("earnings")


def _check_key() -> None:
    if not FMP_API_KEY:
        raise RuntimeError(
            "FMP_API_KEY environment variable is not set. "
            "Get a key at https://financialmodelingprep.com/developer"
        )


async def _fmp_get(path: str, params: dict | None = None, timeout: float = 30.0) -> list | dict:
    """Call an FMP /stable/ endpoint. Returns parsed JSON or raises."""
    p = {"apikey": FMP_API_KEY, **(params or {})}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{FMP_BASE}/{path}", params=p, timeout=timeout)

        # Handle non-JSON "Restricted Endpoint" text responses
        ct = r.headers.get("content-type", "")
        if "application/json" not in ct and "text" in ct:
            body = r.text.strip()
            if "Restricted" in body or "Legacy" in body:
                return {"error": body, "restricted": True}
            return {"error": f"Unexpected response: {body[:200]}"}

        r.raise_for_status()
        data = r.json()

        # FMP returns {"Error Message": "..."} on some errors
        if isinstance(data, dict) and "Error Message" in data:
            return {"error": data["Error Message"]}

        return data


# ─── Earnings Transcript ─────────────────────────────────────────────────────

@mcp.tool()
async def get_earnings_transcript(
    ticker: str,
    year: int = 2024,
    quarter: int = 4,
) -> dict:
    """
    Fetch an earnings call transcript for a given company.
    NOTE: Requires a paid FMP plan. Returns a clear error if restricted.

    Args:
        ticker  : stock ticker symbol (e.g. "AAPL")
        year    : fiscal year (e.g. 2024)
        quarter : fiscal quarter (1-4)
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("earning-call-transcript", {
        "symbol": ticker, "year": year, "quarter": quarter,
    })

    if isinstance(data, dict) and data.get("restricted"):
        return {
            "ticker": ticker, "year": year, "quarter": quarter,
            "error": "Earnings transcripts require a paid FMP plan. "
                     "Using financial data analysis as fallback.",
            "restricted": True,
        }
    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "year": year, "quarter": quarter, "error": data["error"]}

    if not data or (isinstance(data, list) and len(data) == 0):
        return {
            "ticker": ticker, "year": year, "quarter": quarter,
            "error": f"No transcript found for {ticker} Q{quarter} {year}",
        }

    transcript = data[0] if isinstance(data, list) else data
    content = transcript.get("content", "")

    return {
        "ticker": ticker,
        "year": transcript.get("year", year),
        "quarter": transcript.get("quarter", quarter),
        "date": transcript.get("date", ""),
        "content": content,
        "length": len(content),
    }


# ─── Earnings Surprise ───────────────────────────────────────────────────────

@mcp.tool()
async def get_earnings_surprise(ticker: str, limit: int = 8) -> dict:
    """
    Fetch historical earnings surprises (EPS actual vs estimate).

    Args:
        ticker : stock ticker symbol
        limit  : number of quarters to return (default 8)
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("earnings-surprises", {"symbol": ticker})

    if isinstance(data, dict) and (data.get("error") or data.get("restricted")):
        return {"ticker": ticker, "surprises": [], "note": "EPS surprise data not available on current plan"}

    if not data or not isinstance(data, list):
        return {"ticker": ticker, "surprises": []}

    surprises = []
    for item in data[:limit]:
        actual = item.get("actualEarningResult")
        estimated = item.get("estimatedEarning")
        surprise = None
        surprise_pct = None
        if actual is not None and estimated is not None and estimated != 0:
            surprise = round(actual - estimated, 4)
            surprise_pct = round((surprise / abs(estimated)) * 100, 2)
        surprises.append({
            "date": item.get("date", ""),
            "actual_eps": actual,
            "estimated_eps": estimated,
            "surprise": surprise,
            "surprise_pct": surprise_pct,
        })

    return {"ticker": ticker, "surprises": surprises}


# ─── Earnings Calendar ────────────────────────────────────────────────────────

@mcp.tool()
async def get_earnings_calendar(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> dict:
    """
    Fetch upcoming earnings dates for companies.

    Args:
        from_date : start date in YYYY-MM-DD format (optional)
        to_date   : end date in YYYY-MM-DD format (optional)
    """
    _check_key()

    params: dict = {}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date

    data = await _fmp_get("earning-calendar", params)

    if isinstance(data, dict) and (data.get("error") or data.get("restricted")):
        return {"events": [], "count": 0, "note": "Earnings calendar not available"}

    events = []
    for item in (data if isinstance(data, list) else [])[:50]:
        events.append({
            "ticker": item.get("symbol", ""),
            "company": item.get("companyName", ""),
            "date": item.get("date", ""),
            "eps_estimated": item.get("epsEstimated"),
            "revenue_estimated": item.get("revenueEstimated"),
            "fiscal_quarter": item.get("fiscalDateEnding", ""),
        })

    return {"events": events, "count": len(events)}


# ─── Company Profile ──────────────────────────────────────────────────────────

@mcp.tool()
async def get_company_profile(ticker: str) -> dict:
    """
    Fetch a company's profile: name, market cap, sector, price, beta, etc.

    Args:
        ticker : stock ticker symbol (e.g. "AAPL")
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("profile", {"symbol": ticker})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "error": data["error"]}
    if not data:
        return {"ticker": ticker, "error": f"No profile found for {ticker}"}

    p = data[0] if isinstance(data, list) else data
    return {
        "ticker": p.get("symbol", ticker),
        "company_name": p.get("companyName", ""),
        "sector": p.get("sector", ""),
        "industry": p.get("industry", ""),
        "market_cap": p.get("marketCap"),
        "price": p.get("price"),
        "beta": p.get("beta"),
        "vol_avg": p.get("averageVolume"),
        "last_dividend": p.get("lastDividend"),
        "exchange": p.get("exchange", ""),
        "country": p.get("country", ""),
        "employees": p.get("fullTimeEmployees"),
        "description": (p.get("description", "") or "")[:500],
    }


# ─── Real-time Quote ─────────────────────────────────────────────────────────

@mcp.tool()
async def get_company_quote(ticker: str) -> dict:
    """
    Fetch a real-time stock quote: price, change, volume, market cap.

    Args:
        ticker : stock ticker symbol (e.g. "AAPL")
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("quote", {"symbol": ticker})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "error": data["error"]}
    if not data:
        return {"ticker": ticker, "error": f"No quote found for {ticker}"}

    q = data[0] if isinstance(data, list) else data
    return {
        "ticker": q.get("symbol", ticker),
        "name": q.get("name", ""),
        "price": q.get("price"),
        "change": q.get("change"),
        "change_pct": q.get("changePercentage"),
        "volume": q.get("volume"),
        "market_cap": q.get("marketCap"),
        "day_low": q.get("dayLow"),
        "day_high": q.get("dayHigh"),
        "year_low": q.get("yearLow"),
        "year_high": q.get("yearHigh"),
        "pe": q.get("pe"),
        "eps": q.get("eps"),
        "avg_volume": q.get("avgVolume"),
        "open": q.get("open"),
        "previous_close": q.get("previousClose"),
    }


# ─── Key Metrics ──────────────────────────────────────────────────────────────

@mcp.tool()
async def get_key_metrics(ticker: str, limit: int = 4) -> dict:
    """
    Fetch key financial metrics (EV/EBITDA, P/E, ROE, margins, etc.).

    Args:
        ticker : stock ticker symbol
        limit  : number of annual periods (default 4)
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("key-metrics", {"symbol": ticker, "limit": limit})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "metrics": [], "error": data["error"]}
    if not data or not isinstance(data, list):
        return {"ticker": ticker, "metrics": []}

    metrics = []
    for item in data[:limit]:
        metrics.append({
            "date": item.get("date", ""),
            "period": item.get("period", ""),
            "revenue_per_share": item.get("revenuePerShare"),
            "net_income_per_share": item.get("netIncomePerShare"),
            "pe_ratio": item.get("peRatio"),
            "ev_to_ebitda": item.get("enterpriseValueOverEBITDA"),
            "ev_to_revenue": item.get("evToOperatingCashFlow"),
            "price_to_book": item.get("pbRatio"),
            "roe": item.get("roe"),
            "roa": item.get("returnOnTangibleAssets"),
            "debt_to_equity": item.get("debtToEquity"),
            "current_ratio": item.get("currentRatio"),
            "dividend_yield": item.get("dividendYield"),
            "market_cap": item.get("marketCap"),
            "enterprise_value": item.get("enterpriseValue"),
        })

    return {"ticker": ticker, "metrics": metrics}


# ─── Financial Ratios ─────────────────────────────────────────────────────────

@mcp.tool()
async def get_financial_ratios(ticker: str, limit: int = 4) -> dict:
    """
    Fetch financial ratios (margins, growth rates, efficiency metrics).

    Args:
        ticker : stock ticker symbol
        limit  : number of annual periods (default 4)
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("ratios", {"symbol": ticker, "limit": limit})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "ratios": [], "error": data["error"]}
    if not data or not isinstance(data, list):
        return {"ticker": ticker, "ratios": []}

    ratios = []
    for item in data[:limit]:
        ratios.append({
            "date": item.get("date", ""),
            "period": item.get("period", ""),
            "gross_margin": item.get("grossProfitMargin"),
            "operating_margin": item.get("operatingProfitMargin"),
            "net_margin": item.get("netProfitMargin"),
            "roe": item.get("returnOnEquity"),
            "roa": item.get("returnOnAssets"),
            "debt_to_equity": item.get("debtEquityRatio"),
            "current_ratio": item.get("currentRatio"),
            "pe_ratio": item.get("priceEarningsRatio"),
            "price_to_sales": item.get("priceToSalesRatio"),
            "price_to_book": item.get("priceToBookRatio"),
            "ev_to_ebitda": item.get("enterpriseValueMultiple"),
            "revenue_growth": item.get("revenueGrowth"),
        })

    return {"ticker": ticker, "ratios": ratios}


# ─── Income Statement ────────────────────────────────────────────────────────

@mcp.tool()
async def get_income_statement(ticker: str, limit: int = 4) -> dict:
    """
    Fetch income statement data (revenue, EBITDA, net income, EPS).

    Args:
        ticker : stock ticker symbol
        limit  : number of annual periods (default 4)
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("income-statement", {"symbol": ticker, "limit": limit})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "statements": [], "error": data["error"]}
    if not data or not isinstance(data, list):
        return {"ticker": ticker, "statements": []}

    statements = []
    for item in data[:limit]:
        statements.append({
            "date": item.get("date", ""),
            "fiscal_year": item.get("calendarYear", ""),
            "revenue": item.get("revenue"),
            "cost_of_revenue": item.get("costOfRevenue"),
            "gross_profit": item.get("grossProfit"),
            "operating_income": item.get("operatingIncome"),
            "net_income": item.get("netIncome"),
            "ebitda": item.get("ebitda"),
            "eps": item.get("eps"),
            "eps_diluted": item.get("epsDiluted"),
            "weighted_avg_shares": item.get("weightedAverageShsOutDil"),
        })

    return {"ticker": ticker, "statements": statements}


# ─── Income Growth ────────────────────────────────────────────────────────────

@mcp.tool()
async def get_income_growth(ticker: str, limit: int = 4) -> dict:
    """
    Fetch income statement growth rates for a company.

    Args:
        ticker : stock ticker symbol
        limit  : number of annual periods
    """
    _check_key()
    ticker = ticker.upper().strip()

    data = await _fmp_get("income-statement-growth", {"symbol": ticker, "limit": limit})

    if isinstance(data, dict) and data.get("error"):
        return {"ticker": ticker, "growth": []}
    if not data or not isinstance(data, list):
        return {"ticker": ticker, "growth": []}

    growth = []
    for item in data[:limit]:
        growth.append({
            "date": item.get("date", ""),
            "revenue_growth": item.get("growthRevenue"),
            "gross_profit_growth": item.get("growthGrossProfit"),
            "ebitda_growth": item.get("growthEBITDA"),
            "net_income_growth": item.get("growthNetIncome"),
            "eps_growth": item.get("growthEPS"),
            "operating_income_growth": item.get("growthOperatingIncome"),
        })

    return {"ticker": ticker, "growth": growth}


# ─── Stock Screener ───────────────────────────────────────────────────────────

# Curated universe of well-known tickers per sector — FMP's stock-screener
# endpoint is restricted on most plans, so we build screening from
# profile + quote lookups on a known universe instead.

SCREENER_UNIVERSE: dict[str, list[str]] = {
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
        "AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "LOW", "TJX",
        "BKNG", "CMG", "ABNB", "MAR", "GM", "F", "ORLY", "ROST",
        "DHI", "LEN", "LULU", "YUM", "DPZ", "DKNG", "ETSY", "W",
    ],
    "Communication Services": [
        "GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS",
        "CHTR", "EA", "ATVI", "TTWO", "RBLX", "SPOT", "SNAP", "PINS",
    ],
    "Industrials": [
        "UNP", "HON", "UPS", "BA", "CAT", "RTX", "DE", "LMT",
        "GE", "MMM", "FDX", "WM", "ETN", "ITW", "EMR", "NSC",
        "CSX", "TT", "PH", "ROK", "SWK", "GD", "NOC", "HII",
    ],
    "Consumer Defensive": [
        "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ",
        "CL", "GIS", "KMB", "SYY", "HSY", "K", "STZ", "TSN",
    ],
    "Energy": [
        "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO",
        "PXD", "OXY", "HAL", "DVN", "FANG", "HES", "BKR", "KMI",
    ],
    "Basic Materials": [
        "LIN", "APD", "SHW", "FCX", "NEM", "ECL", "DD", "NUE",
        "VMC", "MLM", "ALB", "PPG", "DOW", "IP", "CF", "CTVA",
    ],
    "Real Estate": [
        "PLD", "AMT", "CCI", "EQIX", "PSA", "O", "SPG", "WELL",
        "DLR", "VICI", "AVB", "EQR", "ARE", "MAA", "INVH", "ESS",
    ],
    "Utilities": [
        "NEE", "DUK", "SO", "D", "AEP", "SRE", "XEL", "ED",
        "EXC", "WEC", "ES", "AWK", "AEE", "CMS", "DTE", "PPL",
    ],
}

ALL_TICKERS = sorted({t for tickers in SCREENER_UNIVERSE.values() for t in tickers})


@mcp.tool()
async def screen_stocks(
    market_cap_min: Optional[int] = None,
    market_cap_max: Optional[int] = None,
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    exchange: Optional[str] = None,
    limit: int = 20,
) -> dict:
    """
    Screen stocks by fundamental criteria from a curated universe of ~300 major US stocks.

    Args:
        market_cap_min : minimum market cap in USD (e.g. 1000000000 for $1B)
        market_cap_max : maximum market cap in USD
        sector         : e.g. "Technology", "Healthcare", "Financial Services"
        exchange       : e.g. "NYSE", "NASDAQ"
        limit          : max results (default 20, max 50)
    """
    _check_key()
    limit = max(1, min(50, limit))

    # Build candidate list
    if sector and sector in SCREENER_UNIVERSE:
        candidates = SCREENER_UNIVERSE[sector]
    else:
        candidates = ALL_TICKERS

    # Fetch profiles one at a time (stable API does not support batch symbols)
    results = []
    for ticker in candidates:
        try:
            data = await _fmp_get("profile", {"symbol": ticker})
            if not isinstance(data, list) or not data:
                continue
            p = data[0]
            mc = p.get("marketCap") or 0
            exch = p.get("exchange", "")

            # Apply filters
            if market_cap_min and mc < market_cap_min:
                continue
            if market_cap_max and mc > market_cap_max:
                continue
            if exchange and exchange.upper() not in exch.upper():
                continue

            results.append({
                "ticker": p.get("symbol", ""),
                "company": p.get("companyName", ""),
                "market_cap": p.get("marketCap"),
                "price": p.get("price"),
                "beta": p.get("beta"),
                "volume": p.get("averageVolume"),
                "sector": p.get("sector", ""),
                "industry": p.get("industry", ""),
                "exchange": exch,
                "country": p.get("country", ""),
            })
        except Exception:
            continue

        if len(results) >= limit:
            break

    # Sort by market cap descending
    results.sort(key=lambda r: r.get("market_cap") or 0, reverse=True)
    results = results[:limit]

    return {"results": results, "count": len(results)}


if __name__ == "__main__":
    mcp.run(transport="stdio")
