"""Deal Room Q&A — ask questions about uploaded documents."""
from __future__ import annotations

import json
import logging
import uuid

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import DocumentRecord, QAQuery
from backend.agents._mcp_client import MCPClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["deal-room"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str


class SourceChunk(BaseModel):
    text: str
    source: str
    score: float


class QueryResponse(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    sources: list[SourceChunk]
    created_at: str


class QueryHistoryItem(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    sources: list[SourceChunk]
    created_at: str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _corpus_fingerprint(db: AsyncSession, workspace_id) -> str:
    """A cheap signature of a workspace's document corpus.

    Combines the document COUNT with the most recent document mutation time.
    Any upload bumps both; any delete drops the count. So if the fingerprint
    matches a cached answer's fingerprint, the corpus is provably unchanged and
    the cached answer is safe to reuse — we never serve an answer generated
    against a different set of documents.
    """
    count, latest = (
        await db.execute(
            select(func.count(DocumentRecord.id), func.max(DocumentRecord.created_at))
            .where(DocumentRecord.workspace_id == workspace_id)
        )
    ).one()
    return f"{count or 0}:{latest.isoformat() if latest else 'none'}"


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
@limiter.limit("20/minute")
async def query_documents(
    request: Request,
    body: QueryRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> QueryResponse:
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty.")
    if len(question) > 2000:
        raise HTTPException(400, "Question is too long (max 2000 chars).")

    settings = get_settings()

    # ── Cache lookup ──────────────────────────────────────────────────────────
    # If this exact question was already answered for this workspace AND the
    # document corpus hasn't changed since, reuse the stored answer and skip
    # both the similarity search and the (paid) LLM call entirely.
    fingerprint = await _corpus_fingerprint(db, ctx.workspace.id)
    cached = (
        await db.execute(
            select(QAQuery)
            .where(
                QAQuery.workspace_id == ctx.workspace.id,
                func.lower(QAQuery.question) == question.lower(),
                QAQuery.corpus_fingerprint == fingerprint,
            )
            .order_by(QAQuery.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if cached is not None:
        return QueryResponse(
            id=cached.id,
            question=cached.question,
            answer=cached.answer,
            sources=[SourceChunk(**s) for s in (cached.sources or [])],
            created_at=cached.created_at.isoformat(),
        )

    # Strip +asyncpg driver prefix for pgvector MCP
    db_url = settings.database_url
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if db_url.startswith(prefix):
            db_url = "postgresql://" + db_url[len(prefix):]
            break

    # Step 1: similarity search over uploaded docs — fetch more chunks (10)
    # so we have richer context, then filter by relevance.
    # WORKSPACE_SCOPE is injected as a subprocess env var so pgvector filters
    # results to THIS workspace's documents server-side — the caller can never
    # retrieve another firm's uploaded files.
    try:
        async with MCPClient(
            settings.pgvector_mcp_script,
            extra_env={
                "DATABASE_URL": db_url,
                "WORKSPACE_SCOPE": str(ctx.workspace.id),
            },
        ) as rag:
            raw = await rag.call_tool("similarity_search", {
                "query": question,
                "top_k": 10,
            }, max_chars=0)
        # strict=False allows control characters (form feeds, etc.) that
        # PDF-extracted text may contain and that survive MCP serialization.
        search_result = json.loads(raw, strict=False)
        chunks = search_result.get("results", [])
    except Exception as exc:
        logger.warning("similarity_search failed: %s", exc)
        chunks = []

    if not chunks:
        return QueryResponse(
            id=uuid.uuid4(),
            question=question,
            answer="No relevant documents found. Upload some PDFs or CSVs first, then ask your question.",
            sources=[],
            created_at="",
        )

    # Step 2: build context from top chunks — only keep chunks above a
    # minimum relevance threshold so we don't pad the source list with noise.
    MIN_SCORE = 0.08
    relevant = [c for c in chunks if c.get("score", 0) >= MIN_SCORE]
    if not relevant:
        relevant = chunks[:1]  # Always keep at least the top hit
    # Cap at 8 to stay within token budget
    relevant = relevant[:8]

    context_parts = []
    sources: list[SourceChunk] = []
    for i, chunk in enumerate(relevant):
        context_parts.append(f"[Source {i + 1}: {chunk['source']}]\n{chunk['text']}")
        sources.append(SourceChunk(
            text=chunk["text"][:500],
            source=chunk["source"],
            score=round(chunk.get("score", 0), 3),
        ))
    context_block = "\n\n---\n\n".join(context_parts)

    # Step 3: send to Claude for synthesis
    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.fast_model,
            max_tokens=2048,
            system=(
                "You are a senior deal room analyst. Your job is to give thorough, "
                "precise answers grounded in the provided document excerpts.\n\n"
                "## Rules\n"
                "- Answer based ONLY on the provided excerpts — never fabricate data.\n"
                "- **Extract and cite every specific number, date, name, and figure** "
                "that is relevant to the question. Financial questions demand exact "
                "dollar amounts, percentages, and period-over-period comparisons.\n"
                "- Use Markdown formatting: headings (##), **bold** for key figures, "
                "bullet points for lists, tables where appropriate.\n"
                "- Cite sources inline like [Source 1]. If multiple sources contribute, "
                "cite each where used.\n"
                "- When the data contains tables or structured figures, reproduce the "
                "key rows/columns in your answer so the user sees the actual numbers.\n"
                "- If information is incomplete, state clearly what is missing.\n"
                "- Be comprehensive — cover all relevant data points from the excerpts."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"## Document excerpts\n\n{context_block}\n\n"
                    f"---\n\n## Question\n\n{question}"
                ),
            }],
        )
        answer = response.content[0].text
    except Exception as exc:
        logger.error("Claude Q&A call failed: %s", exc)
        raise HTTPException(502, "Failed to generate answer. Please try again.")

    # Step 4: persist to database
    record = QAQuery(
        user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        question=question,
        answer=answer,
        sources=[s.model_dump() for s in sources],
        corpus_fingerprint=fingerprint,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return QueryResponse(
        id=record.id,
        question=record.question,
        answer=record.answer,
        sources=sources,
        created_at=record.created_at.isoformat(),
    )


@router.get("/query/history", response_model=list[QueryHistoryItem])
async def get_query_history(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100),
) -> list[QueryHistoryItem]:
    """Return past Q&A queries for the current workspace, newest first."""
    result = await db.execute(
        select(QAQuery)
        .where(QAQuery.workspace_id == ctx.workspace.id)
        .order_by(QAQuery.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        QueryHistoryItem(
            id=r.id,
            question=r.question,
            answer=r.answer,
            sources=[SourceChunk(**s) for s in (r.sources or [])],
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.delete("/query/{query_id}", status_code=204)
async def delete_query(
    query_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Delete a single Q&A query from history."""
    result = await db.execute(
        select(QAQuery).where(
            QAQuery.id == query_id,
            QAQuery.workspace_id == ctx.workspace.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Query not found")
    await db.delete(record)
    await db.commit()
