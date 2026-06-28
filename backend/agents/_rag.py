"""
Shared RAG (uploaded-document retrieval) wiring for specialist agents.

Each specialist agent normally talks to SEC EDGAR / web-search MCP servers.
When a report is run inside a workspace that has uploaded due-diligence
documents, we *additionally* bolt the pgvector RAG server onto the agent's MCP
client so the agent can `similarity_search` the firm's private data-room files
and cite them alongside public filings.

Two hard requirements shaped this module:

1. **Tenant isolation.** Retrieval MUST be scoped to the calling workspace so
   one firm's documents never surface in another's report. We enforce this by
   injecting ``WORKSPACE_SCOPE`` as a *subprocess* environment variable; the
   pgvector server filters on it server-side, so the LLM has no way to widen
   the scope (it never sees or controls the value).

2. **Fault tolerance.** The pgvector server lazy-loads sentence-transformers,
   which is known to occasionally segfault on spawn (see CLAUDE.md). RAG is a
   *nice-to-have* enrichment — it must never take down an agent's core SEC/web
   analysis. ``agent_mcp`` therefore tries to bring pgvector up and silently
   falls back to the base servers if it can't.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator
from uuid import UUID

from ._mcp_client import MultiMCPClient

logger = logging.getLogger(__name__)

# pgvector exposes write/delete tools we never want an analysis agent to call.
# Only `similarity_search` is read-only and safe to expose.
_HIDDEN_RAG_TOOLS = {"ingest_document", "delete_by_source"}

_RAG_HINT = (
    "\n\nThe deal team has uploaded private due-diligence documents for this "
    "company (data-room PDFs, internal financials, analyst memos, CIMs). "
    "Use the `similarity_search` tool to query them for material facts relevant "
    "to your analysis — run it with focused questions, not just the company name. "
    "When you rely on a retrieved passage, cite it: set the citation `source` to "
    "the document's source label (returned alongside each result) so the analyst "
    "can trace the claim back to the uploaded file."
)


def _plain_db_url(database_url: str) -> str:
    """Strip the +asyncpg driver prefix — asyncpg uses the plain scheme."""
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if database_url.startswith(prefix):
            return "postgresql://" + database_url[len(prefix):]
    return database_url


def rag_hint(rag_on: bool) -> str:
    """Prompt fragment appended to the user message when RAG is live."""
    return _RAG_HINT if rag_on else ""


def visible_tools(mcp: MultiMCPClient, rag_on: bool) -> list[dict]:
    """Anthropic tool list with pgvector's write/delete tools removed."""
    tools = mcp.anthropic_tools()
    if rag_on:
        tools = [t for t in tools if t["name"] not in _HIDDEN_RAG_TOOLS]
    return tools


@asynccontextmanager
async def agent_mcp(
    base_scripts: list[str],
    base_env: dict[str, str],
    *,
    workspace_id: str | UUID | None,
    settings,
) -> AsyncIterator[tuple[MultiMCPClient, bool]]:
    """
    Open an MCP client for an agent, optionally augmented with pgvector RAG.

    Yields ``(client, rag_on)`` where ``rag_on`` is True only if the pgvector
    server was successfully spawned and scoped to ``workspace_id``.

    Falls back to a base-servers-only client when ``workspace_id`` is None or
    when pgvector fails to come up, so RAG can never break core analysis.
    """
    # No workspace context → plain base client, no RAG.
    if not workspace_id:
        async with MultiMCPClient(*base_scripts, extra_env=base_env) as mcp:
            yield mcp, False
        return

    # Try the RAG-augmented client first.
    rag_env = dict(base_env)
    rag_env["DATABASE_URL"] = _plain_db_url(settings.database_url)
    rag_env["WORKSPACE_SCOPE"] = str(workspace_id)

    client = MultiMCPClient(
        *base_scripts,
        settings.pgvector_mcp_script,
        extra_env=rag_env,
    )
    try:
        await client.__aenter__()
    except Exception as exc:
        # pgvector failed to spawn (segfault, missing model, DB down, …).
        # Clean up any partially-entered subprocesses, then fall back.
        logger.warning(
            "RAG pgvector server unavailable (%s: %s) — running without uploaded-doc retrieval",
            type(exc).__name__, exc,
        )
        try:
            await client.__aexit__(None, None, None)
        except Exception:
            pass
        async with MultiMCPClient(*base_scripts, extra_env=base_env) as mcp:
            yield mcp, False
        return

    try:
        yield client, True
    finally:
        try:
            await client.__aexit__(None, None, None)
        except Exception:
            pass
