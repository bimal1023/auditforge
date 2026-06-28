"""
OpenSanctions MCP Server
========================
Sanctions / PEP / watchlist screening via OpenSanctions
(https://www.opensanctions.org) — a consolidated database of sanctioned
entities, politically-exposed persons (PEPs), and criminal/regulatory watchlists
drawn from OFAC, EU, UN, Interpol, and many national sources.

This is a compliance/KYC primitive most AI memo tools skip: screening a target
company (or its key people) against sanctions and PEP lists is table-stakes for
real PE due diligence.

Exposes one tool:

  screen_sanctions(name, schema, limit) → matching watchlist entities

Auth: the hosted API requires an API key (Authorization: ApiKey <key>). Get one
at https://www.opensanctions.org/api/ — there is a free tier for low volume.

Graceful degradation: never raises at import; if OPENSANCTIONS_API_KEY is unset
or any request fails, the tool returns an {"error": ...} dict so it can't break
the Legal agent's run.

Run standalone:
  OPENSANCTIONS_API_KEY=... python mcp_servers/opensanctions/server.py
"""
from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_KEY = os.environ.get("OPENSANCTIONS_API_KEY", "")
BASE = "https://api.opensanctions.org"

mcp = FastMCP("opensanctions")

_NOT_CONFIGURED = {
    "error": "OpenSanctions not configured — set OPENSANCTIONS_API_KEY "
    "(https://www.opensanctions.org/api/). Skipping sanctions/PEP screening."
}


@mcp.tool()
async def screen_sanctions(name: str, schema: str = "Company", limit: int = 5) -> dict:
    """
    Screen a name against global sanctions, PEP, and watchlist data.

    Run this on the target company and, where known, its principals/owners to
    flag sanctions exposure, politically-exposed-person ties, or criminal
    watchlist hits — a key compliance step in PE diligence.

    Args:
        name   : entity name to screen (company or person).
        schema : entity type — "Company", "Organization", or "Person".
                 Use "Person" when screening an individual (CEO, owner, UBO).
        limit  : max matches to return (1–10).

    Returns a dict with:
        query   : echoed name
        matches : list of {caption, schema, score, topics, datasets,
                  countries}  — `topics` flags WHY it matched (e.g. "sanction",
                  "role.pep", "crime"); `score` is match confidence 0–1.
        clear   : True when there are no matches (clean screen).
    A non-empty `matches` list with sanction/crime topics is a material red flag.
    """
    if not API_KEY:
        return _NOT_CONFIGURED
    limit = max(1, min(10, limit))

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{BASE}/search/default",
                params={"q": name, "schema": schema, "limit": limit},
                headers={"Authorization": f"ApiKey {API_KEY}"},
                timeout=30.0,
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:  # noqa: BLE001
        return {"error": f"OpenSanctions screen failed: {exc}", "query": name}

    matches: list[dict] = []
    for ent in data.get("results", [])[:limit]:
        props = ent.get("properties", {}) or {}
        matches.append({
            "caption": ent.get("caption"),
            "schema": ent.get("schema"),
            "score": ent.get("score"),
            "topics": ent.get("topics") or props.get("topics", []),
            "datasets": ent.get("datasets", []),
            "countries": props.get("country", []),
        })

    return {"query": name, "matches": matches, "clear": len(matches) == 0}


if __name__ == "__main__":
    mcp.run(transport="stdio")
