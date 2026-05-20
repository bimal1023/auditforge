"""
Web Search MCP Server (Tavily)
==============================
Exposes one tool:

  search_web(query, max_results, days_back) → Tavily search results

Run standalone:
  TAVILY_API_KEY=tvly-... python mcp_servers/web_search/server.py
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
TAVILY_URL = "https://api.tavily.com/search"

mcp = FastMCP("web-search")


@mcp.tool()
async def search_web(
    query: str,
    max_results: int = 10,
    days_back: Optional[int] = None,
) -> dict:
    """
    Search the web via the Tavily API.

    Args:
        query       : the search query
        max_results : max number of results to return (1–20)
        days_back   : restrict results to the last N days (optional)

    Returns a dict with:
        answer      : Tavily's synthesised answer (string or None)
        results     : list of {title, url, content, score, published_date}
        query       : echoed query
    """
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY environment variable is not set")

    max_results = max(1, min(20, max_results))

    payload: dict = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "max_results": max_results,
        "search_depth": "advanced",
        "include_answer": True,
        "include_raw_content": False,
        "include_images": False,
    }

    if days_back is not None and days_back > 0:
        cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=days_back)).strftime(
            "%Y-%m-%d"
        )
        payload["published_after"] = cutoff

    async with httpx.AsyncClient() as client:
        r = await client.post(TAVILY_URL, json=payload, timeout=30.0)
        r.raise_for_status()
        data = r.json()

    results = [
        {
            "title": hit.get("title", ""),
            "url": hit.get("url", ""),
            "content": hit.get("content", "")[:1_000],  # cap per-result text
            "score": hit.get("score", 0.0),
            "published_date": hit.get("published_date"),
        }
        for hit in data.get("results", [])
    ]

    return {
        "query": query,
        "answer": data.get("answer"),
        "results": results,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
