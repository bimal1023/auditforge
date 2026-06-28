"""
CourtListener MCP Server
========================
Real US federal & state litigation data from CourtListener / RECAP
(https://www.courtlistener.com), the Free Law Project's open database of court
dockets and opinions. This replaces guessing litigation from web search with
actual docket records the Legal agent can cite.

Exposes one tool:

  search_court_cases(query, max_results, date_filed_after) → matching dockets

Auth: works anonymously but is rate-limited. Set COURTLISTENER_API_TOKEN
(free, from https://www.courtlistener.com/help/api/rest/) to raise limits.

Graceful degradation: never raises at import; on any HTTP/parse failure the
tool returns an {"error": ...} dict so it can't break the Legal agent's run.

Run standalone:
  COURTLISTENER_API_TOKEN=... python mcp_servers/courtlistener/server.py
"""
from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_TOKEN = os.environ.get("COURTLISTENER_API_TOKEN", "")
BASE = "https://www.courtlistener.com"
SEARCH_URL = f"{BASE}/api/rest/v4/search/"

mcp = FastMCP("courtlistener")


def _headers() -> dict:
    h = {"User-Agent": "Arthvion/1.0 (PE due diligence)"}
    if API_TOKEN:
        h["Authorization"] = f"Token {API_TOKEN}"
    return h


def _abs(url: str | None) -> str | None:
    if not url:
        return None
    return url if url.startswith("http") else f"{BASE}{url}"


@mcp.tool()
async def search_court_cases(
    query: str,
    max_results: int = 8,
    date_filed_after: str | None = None,
) -> dict:
    """
    Search US federal court filings (RECAP/PACER dockets) for a party or topic.

    Ideal for diligence: search the company name to surface lawsuits naming it
    as plaintiff or defendant, then cite the docket number + court + filing date.

    Args:
        query            : search text — usually the company name, optionally
                           with a keyword (e.g. 'Acme Corp antitrust').
        max_results      : max dockets to return (1–20).
        date_filed_after : optional ISO date "YYYY-MM-DD" to restrict to filings
                           on or after that date (e.g. recent litigation only).

    Returns a dict with:
        query   : echoed query
        cases   : list of {case_name, court, docket_number, date_filed,
                  nature_of_suit, url}  (url links to the full docket)
    Use the returned case_name / docket_number / court as citation sources.
    """
    max_results = max(1, min(20, max_results))
    params: dict = {
        "q": query,
        "type": "r",          # RECAP — federal trial-court dockets & filings
        "order_by": "dateFiled desc",
    }
    if date_filed_after:
        params["filed_after"] = date_filed_after

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                SEARCH_URL, params=params, headers=_headers(), timeout=30.0
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:  # noqa: BLE001
        return {"error": f"CourtListener search failed: {exc}", "query": query}

    cases: list[dict] = []
    for hit in data.get("results", [])[:max_results]:
        cases.append({
            "case_name": hit.get("caseName") or hit.get("case_name"),
            "court": hit.get("court") or hit.get("court_id"),
            "docket_number": hit.get("docketNumber") or hit.get("docket_number"),
            "date_filed": hit.get("dateFiled") or hit.get("date_filed"),
            "nature_of_suit": hit.get("suitNature") or hit.get("nature_of_suit"),
            "url": _abs(hit.get("docket_absolute_url") or hit.get("absolute_url")),
        })

    return {"query": query, "count": data.get("count"), "cases": cases}


if __name__ == "__main__":
    mcp.run(transport="stdio")
