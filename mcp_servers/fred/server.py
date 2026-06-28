"""
FRED (Federal Reserve Economic Data) MCP Server
================================================
Exposes two tools for grounding market/macro analysis in real economic data
from the St. Louis Fed (https://fred.stlouisfed.org):

  search_economic_series(query, limit)         → find relevant series IDs
  get_series_observations(series_id, limit)    → recent values for a series

Use case: the Market agent can pull real macro context (GDP, sector indices,
interest rates, CPI, unemployment, housing starts, etc.) instead of guessing
TAM/demand signals from web search alone.

Graceful degradation: if FRED_API_KEY is unset, the server still starts and
every tool returns an {"error": ...} dict — it never raises at import time, so
it can be safely attached to an agent's MCP client without a key.

Get a free key (instant) at: https://fredaccount.stlouisfed.org/apikey

Run standalone:
  FRED_API_KEY=... python mcp_servers/fred/server.py
"""
from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
BASE = "https://api.stlouisfed.org/fred"

mcp = FastMCP("fred")

_NOT_CONFIGURED = {
    "error": "FRED not configured — set FRED_API_KEY (free key: "
    "https://fredaccount.stlouisfed.org/apikey). Skipping macro data."
}


async def _get(path: str, params: dict) -> dict:
    """GET a FRED JSON endpoint, injecting the api_key + json file_type."""
    params = {**params, "api_key": FRED_API_KEY, "file_type": "json"}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/{path}", params=params, timeout=30.0)
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def search_economic_series(query: str, limit: int = 8) -> dict:
    """
    Search FRED for economic data series matching *query*.

    Use this to discover the right series ID for a macro indicator relevant to
    the company's sector — e.g. "semiconductor production", "retail sales",
    "30-year mortgage rate", "real GDP", "CPI", "unemployment rate".

    Args:
        query : free-text search (indicator name, sector, concept)
        limit : max series to return (1–25)

    Returns a dict with:
        query   : echoed query
        series  : list of {id, title, frequency, units, seasonal_adjustment,
                  observation_start, observation_end, popularity}
        Pick a series `id` and pass it to get_series_observations().
    """
    if not FRED_API_KEY:
        return _NOT_CONFIGURED
    limit = max(1, min(25, limit))
    try:
        data = await _get(
            "series/search",
            {
                "search_text": query,
                "limit": limit,
                "order_by": "popularity",
                "sort_order": "desc",
            },
        )
    except Exception as exc:  # noqa: BLE001
        return {"error": f"FRED search failed: {exc}", "query": query}

    series = [
        {
            "id": s.get("id"),
            "title": s.get("title"),
            "frequency": s.get("frequency_short"),
            "units": s.get("units_short"),
            "seasonal_adjustment": s.get("seasonal_adjustment_short"),
            "observation_start": s.get("observation_start"),
            "observation_end": s.get("observation_end"),
            "popularity": s.get("popularity"),
        }
        for s in data.get("seriess", [])
    ]
    return {"query": query, "series": series}


@mcp.tool()
async def get_series_observations(series_id: str, limit: int = 12) -> dict:
    """
    Return the most-recent observations (data points) for a FRED series.

    Args:
        series_id : a FRED series ID (e.g. "GDPC1", "CPIAUCSL", "UNRATE",
                    "MORTGAGE30US"), typically from search_economic_series().
        limit     : number of most-recent observations (1–60)

    Returns a dict with:
        series_id    : echoed ID
        title, units : series metadata (when available)
        observations : list of {date, value} ordered newest-first
        latest       : the most recent {date, value} for quick reference
    Values are returned as floats; missing points (FRED uses ".") are skipped.
    """
    if not FRED_API_KEY:
        return _NOT_CONFIGURED
    limit = max(1, min(60, limit))

    # Series metadata (best-effort — observations are the important part).
    title, units = None, None
    try:
        meta = await _get("series", {"series_id": series_id})
        info = (meta.get("seriess") or [{}])[0]
        title, units = info.get("title"), info.get("units_short")
    except Exception:  # noqa: BLE001
        pass

    try:
        data = await _get(
            "series/observations",
            {"series_id": series_id, "limit": limit, "sort_order": "desc"},
        )
    except Exception as exc:  # noqa: BLE001
        return {"error": f"FRED observations failed: {exc}", "series_id": series_id}

    obs: list[dict] = []
    for o in data.get("observations", []):
        raw = o.get("value")
        if raw in (None, ".", ""):
            continue
        try:
            obs.append({"date": o.get("date"), "value": float(raw)})
        except (TypeError, ValueError):
            continue

    return {
        "series_id": series_id,
        "title": title,
        "units": units,
        "observations": obs,
        "latest": obs[0] if obs else None,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
