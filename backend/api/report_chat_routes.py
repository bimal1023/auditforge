"""Report chat — a streaming, multi-turn assistant grounded in a single
completed due-diligence report.

Unlike the document Q&A endpoint (`qa_routes.py`, single-shot RAG over the
uploaded corpus), this is conversational and scoped to ONE report: the full
report JSON is injected as cached context and Claude answers follow-up
questions about it, streaming tokens back over Server-Sent Events.

Phase 1 is intentionally ephemeral — the client owns the conversation history
and replays it on each turn. No DB table yet (see Phase 3 in the build plan).
"""
from __future__ import annotations

import json
import logging
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents._mcp_client import MCPClient
from backend.agents._prompt_cache import PROMPT_CACHE_HEADERS, cached_system
from backend.core.config import get_settings
from backend.core.database import get_session, get_session_factory
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import ReportChatMessage, ReportRecord

logger = logging.getLogger(__name__)
router = APIRouter(tags=["report-chat"])


def _pg_url(database_url: str) -> str:
    """Strip the +asyncpg driver prefix — the pgvector MCP wants a plain DSN."""
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if database_url.startswith(prefix):
            return "postgresql://" + database_url[len(prefix):]
    return database_url


async def _retrieve_doc_context(
    question: str, workspace_id: str, top_k: int = 6,
) -> tuple[str, list[dict]]:
    """Best-effort similarity search over the workspace's uploaded docs.

    Returns (context_block, sources). On any failure (pgvector won't spawn, no
    corpus, etc.) returns ("", []) so report-only chat is never blocked — RAG
    augments, it must not break the core feature.
    """
    settings = get_settings()
    try:
        async with MCPClient(
            settings.pgvector_mcp_script,
            extra_env={
                "DATABASE_URL": _pg_url(settings.database_url),
                "WORKSPACE_SCOPE": workspace_id,
            },
        ) as rag:
            raw = await rag.call_tool(
                "similarity_search", {"query": question, "top_k": top_k}, max_chars=0,
            )
        chunks = json.loads(raw, strict=False).get("results", [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("report chat similarity_search failed: %s", exc)
        return "", []

    MIN_SCORE = 0.08
    relevant = [c for c in chunks if c.get("score", 0) >= MIN_SCORE][:top_k]
    if not relevant:
        return "", []

    parts, sources = [], []
    for i, c in enumerate(relevant):
        parts.append(f"[Source {i + 1}: {c['source']}]\n{c['text']}")
        sources.append({"source": c["source"], "score": round(c.get("score", 0), 3)})
    block = (
        "## Relevant document excerpts\n\n"
        + "\n\n---\n\n".join(parts)
    )
    return block, sources


# ── Schemas ────────────────────────────────────────────────────────────────

class ChatTurn(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatTurn]


# Bounds — keep a single request well within Haiku's context + the token budget.
_MAX_TURNS = 24
_MAX_TURN_CHARS = 6000


_SYSTEM_PROMPT = """You are Arthvion's report analyst — a conversational assistant that answers \
questions about ONE specific due-diligence report. The full report is provided below as JSON.

You may also be given excerpts retrieved from the workspace's uploaded documents, attached to \
the user's latest message under "Relevant document excerpts". Treat those as an additional, \
equally-trustworthy source.

## Rules
- Answer ONLY from the report data below and any provided document excerpts. Never invent \
figures, dates, names, or events.
- If neither the report nor the excerpts contain the answer, say so plainly (e.g. "The report \
doesn't cover that") and, if useful, suggest running a fresh report or uploading documents.
- Cite where each claim came from: the report section in prose — Financial, Risk, Market, or \
Legal — and document excerpts as [Source N] using the numbers provided. Quote exact numbers, \
dates, and names where they appear.
- Be concise and direct. Use Markdown: short paragraphs, **bold** for key figures, bullet lists \
where it aids scanning. No preamble like "Great question".
- When asked for an opinion or recommendation, ground it in the report's findings and the \
overall_score; flag low-confidence sections (confidence_score near 0) as less reliable.

## The report (JSON)
{report_json}
"""


def _strip_to_chat_messages(turns: list[ChatTurn]) -> list[dict]:
    """Validate + coerce the client's history into Anthropic message dicts."""
    cleaned: list[dict] = []
    for t in turns:
        role = t.role.strip().lower()
        if role not in ("user", "assistant"):
            continue
        content = t.content.strip()
        if not content:
            continue
        cleaned.append({"role": role, "content": content[:_MAX_TURN_CHARS]})
    return cleaned


@router.post("/reports/{report_id}/chat")
@limiter.limit("40/minute")
async def chat_with_report(
    report_id: UUID,
    request: Request,
    body: ChatRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Stream a grounded answer about a completed report as Server-Sent Events.

    Event payloads (each line is `data: <json>`):
      {"type": "delta", "text": "..."}  — a chunk of the answer
      {"type": "done"}                   — stream finished cleanly
      {"type": "error", "message": ...}  — generation failed mid-stream
    """
    # ── Load + authorize the report (workspace-scoped) ──────────────────────
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")
    if record.status != "complete" or not record.data:
        raise HTTPException(status_code=400, detail="Report is not complete yet.")

    messages = _strip_to_chat_messages(body.messages)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided.")
    if len(messages) > _MAX_TURNS:
        messages = messages[-_MAX_TURNS:]
    if messages[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the user.")

    settings = get_settings()
    # record.data is already the serialized report dict — inject it verbatim so
    # the model sees every figure and citation. Kept in the CACHED system block
    # (stable across turns) so prompt caching stays warm; retrieved doc excerpts
    # go into the user turn instead, where they're expected to change each turn.
    report_json = json.dumps(record.data, default=str)
    system_block = cached_system(_SYSTEM_PROMPT.format(report_json=report_json))

    # Locals captured for the generator — the DB session closes once streaming starts.
    workspace_id = str(ctx.workspace.id)
    ws_uuid = ctx.workspace.id
    user_uuid = ctx.user.id
    latest_question = messages[-1]["content"]

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    async def _persist_turn(answer: str, sources: list[dict]) -> None:
        """Write the new user turn + assistant answer to their own DB session.

        Runs on its own session because the request-scoped one is gone by the
        time the stream finishes. Best-effort: a persistence failure must not
        corrupt the response the user already received.
        """
        try:
            async with get_session_factory()() as session:
                session.add(ReportChatMessage(
                    report_id=report_id, workspace_id=ws_uuid, user_id=user_uuid,
                    role="user", content=latest_question,
                ))
                session.add(ReportChatMessage(
                    report_id=report_id, workspace_id=ws_uuid, user_id=user_uuid,
                    role="assistant", content=answer,
                    sources=sources or None,
                ))
                await session.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to persist report chat turn for %s: %s", report_id, exc)

    async def event_stream():
        try:
            # ── RAG: pull relevant excerpts from uploaded docs (best-effort) ──
            yield _sse({"type": "status", "message": "Searching documents…"})
            doc_block, sources = await _retrieve_doc_context(latest_question, workspace_id)
            if sources:
                yield _sse({"type": "sources", "sources": sources})

            # Append the excerpts to the latest user turn (not the cached system).
            model_messages = list(messages)
            if doc_block:
                model_messages[-1] = {
                    "role": "user",
                    "content": f"{latest_question}\n\n{doc_block}",
                }

            answer_parts: list[str] = []
            async with client.messages.stream(
                model=settings.fast_model,
                max_tokens=1500,
                system=system_block,
                messages=model_messages,
                extra_headers=PROMPT_CACHE_HEADERS,
            ) as stream:
                async for text in stream.text_stream:
                    answer_parts.append(text)
                    yield _sse({"type": "delta", "text": text})

            answer = "".join(answer_parts).strip()
            if answer:
                await _persist_turn(answer, sources)
            yield _sse({"type": "done"})
        except Exception as exc:  # noqa: BLE001 — surface a clean error to the client
            logger.error("Report chat stream failed for %s: %s", report_id, exc)
            yield _sse({"type": "error", "message": "Failed to generate a response. Please try again."})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── History ──────────────────────────────────────────────────────────────────

class ChatHistoryItem(BaseModel):
    role: str
    content: str
    sources: list[dict] = []
    created_at: str


@router.get("/reports/{report_id}/chat", response_model=list[ChatHistoryItem])
async def get_chat_history(
    report_id: UUID,
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=200, le=500),
) -> list[ChatHistoryItem]:
    """Return the persisted conversation for a report, oldest first."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")

    rows = (await db.execute(
        select(ReportChatMessage)
        .where(ReportChatMessage.report_id == report_id)
        .order_by(ReportChatMessage.created_at.asc())
        .limit(limit)
    )).scalars().all()

    return [
        ChatHistoryItem(
            role=r.role,
            content=r.content,
            sources=r.sources or [],
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]


@router.delete("/reports/{report_id}/chat", status_code=204)
async def clear_chat_history(
    report_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Delete the entire conversation for a report (start fresh)."""
    record = await db.get(ReportRecord, report_id)
    if record is None or record.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Report not found")

    rows = (await db.execute(
        select(ReportChatMessage).where(ReportChatMessage.report_id == report_id)
    )).scalars().all()
    for r in rows:
        await db.delete(r)
    await db.commit()
