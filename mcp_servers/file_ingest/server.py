"""
File Ingest MCP Server
======================
Exposes two tools:

  parse_pdf(file_path)  → extracted text + page count
  parse_csv(file_path)  → rows as list of dicts + row count

Run standalone:
  python mcp_servers/file_ingest/server.py
"""
from __future__ import annotations

import csv
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("file-ingest")

MAX_TEXT_CHARS = 100_000   # cap PDF text to avoid flooding context


@mcp.tool()
async def parse_pdf(file_path: str) -> dict:
    """
    Extract text from a PDF file using pypdf.

    Args:
        file_path : absolute or relative path to the .pdf file

    Returns:
        text      : concatenated text from all pages
        pages     : total page count
        file      : echoed file path
    """
    try:
        import pypdf  # lazy import so the server starts even without pypdf
    except ImportError:
        raise RuntimeError("pypdf is not installed — run: pip install pypdf")

    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}
    if path.suffix.lower() != ".pdf":
        return {"error": f"Not a PDF file: {file_path}"}

    reader = pypdf.PdfReader(str(path))
    pages_text: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            pages_text.append(extracted)

    full_text = "\n\n".join(pages_text)
    if len(full_text) > MAX_TEXT_CHARS:
        full_text = full_text[:MAX_TEXT_CHARS]

    return {
        "text": full_text,
        "pages": len(reader.pages),
        "file": str(path),
    }


@mcp.tool()
async def parse_csv(file_path: str) -> dict:
    """
    Parse a CSV file using the stdlib csv module.

    Args:
        file_path : absolute or relative path to the .csv file

    Returns:
        headers   : list of column names
        rows      : list of row dicts (column → value)
        count     : total row count
        file      : echoed file path
    """
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    rows: list[dict] = []
    headers: list[str] = []

    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        headers = list(reader.fieldnames or [])
        for row in reader:
            rows.append(dict(row))

    return {
        "headers": headers,
        "rows": rows,
        "count": len(rows),
        "file": str(path),
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
