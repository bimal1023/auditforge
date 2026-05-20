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

USER_AGENT = os.environ.get("SEC_EDGAR_USER_AGENT", "AuditForge bimalkumal2004@gmail.com")

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
            return {
                "error": f"HTTP {exc.response.status_code}: {exc.request.url}",
                "cik": cik_padded,
                "accession_number": acc_dashed,
            }
        except Exception as exc:
            return {
                "error": str(exc),
                "cik": cik_padded,
                "accession_number": acc_dashed,
            }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
