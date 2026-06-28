"""
pgvector RAG MCP Server
=======================
Stores and retrieves document chunks using PostgreSQL + pgvector.
Embeddings are generated locally via sentence-transformers (no external API).

Model: all-MiniLM-L6-v2 → 384-dimensional vectors
Similarity: cosine distance via pgvector <=> operator

Tools:
  ingest_document(text, source, metadata)  → chunk + embed + upsert
  similarity_search(query, top_k)          → ranked chunks

Run standalone:
  DATABASE_URL=postgresql://... python mcp_servers/pgvector_rag/server.py
"""
from __future__ import annotations

# Prevent transformers from importing tensorflow — the protobuf version
# conflict between tf 5.28.x and the system protobuf 6.x causes a segfault.
import os as _os
_os.environ.setdefault("USE_TF", "0")
_os.environ.setdefault("TRANSFORMERS_NO_TF", "1")

import hashlib
import json
import os
from typing import Any

import asyncpg
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("pgvector-rag")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/arthvion",
).replace("postgresql+asyncpg://", "postgresql://")  # asyncpg uses plain scheme

EMBEDDING_DIM = 384
CHUNK_SIZE = 1200     # characters — larger chunks preserve tables and context
CHUNK_OVERLAP = 150   # characters — overlap keeps cross-boundary info intact

_tokenizer = None
_model = None


def _load_model():
    """Lazy-load using transformers + torch directly.

    Avoids importing sentence-transformers which drags in a tensorflow
    dependency whose protobuf version can conflict with the system install
    and cause a subprocess segfault (exit code 139).
    """
    global _tokenizer, _model
    if _model is None:
        import torch
        from transformers import AutoTokenizer, AutoModel

        model_name = "sentence-transformers/all-MiniLM-L6-v2"
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModel.from_pretrained(model_name)
        _model.eval()
    return _tokenizer, _model


def _embed(texts: list[str]) -> list[list[float]]:
    import torch

    tokenizer, model = _load_model()
    encoded = tokenizer(
        texts, padding=True, truncation=True, max_length=256, return_tensors="pt"
    )
    with torch.no_grad():
        output = model(**encoded)
    # Mean pooling over token embeddings, respecting the attention mask
    mask = encoded["attention_mask"].unsqueeze(-1).float()
    summed = (output.last_hidden_state * mask).sum(dim=1)
    counts = mask.sum(dim=1).clamp(min=1e-9)
    embeddings = summed / counts
    # L2 normalize
    embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
    return embeddings.tolist()


def _sanitize(text: str) -> str:
    """Strip control characters that break JSON serialization (form feeds,
    null bytes, etc.) while preserving normal whitespace."""
    import re
    # Remove all C0/C1 control chars except \n \r \t
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)


def _chunk_text(text: str) -> list[str]:
    text = _sanitize(text)
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c.strip()]


async def _get_conn() -> asyncpg.Connection:
    return await asyncpg.connect(DATABASE_URL)


async def _ensure_table(conn: asyncpg.Connection) -> None:
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    await conn.execute(f"""
        CREATE TABLE IF NOT EXISTS document_chunks (
            id          TEXT PRIMARY KEY,
            source      TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            text        TEXT NOT NULL,
            embedding   vector({EMBEDDING_DIM}),
            metadata    JSONB,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    # Drop the old IVFFlat index — it requires many rows (>> lists count)
    # to work correctly. With fewer rows than lists, probes return 0 results.
    await conn.execute(
        "DROP INDEX IF EXISTS document_chunks_embedding_idx"
    )
    # HNSW works correctly at any table size and doesn't need training data.
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
    """)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def ingest_document(
    text: str,
    source: str,
    metadata: dict[str, Any] | None = None,
) -> dict:
    """
    Chunk, embed, and upsert a document into the pgvector store.

    Args:
        text     : raw document text
        source   : human-readable label (e.g. "AAPL 10-K 2024")
        metadata : optional key-value pairs stored alongside each chunk

    Returns:
        chunks_ingested : number of chunks stored
        source          : echoed source label
    """
    chunks = _chunk_text(text)
    if not chunks:
        return {"chunks_ingested": 0, "source": source}

    embeddings = _embed(chunks)

    conn = await _get_conn()
    try:
        await _ensure_table(conn)
        async with conn.transaction():
            for i, (chunk, vec) in enumerate(zip(chunks, embeddings)):
                chunk_id = hashlib.sha256(f"{source}:{i}:{chunk[:64]}".encode()).hexdigest()[:32]
                vec_str = "[" + ",".join(str(v) for v in vec) + "]"
                await conn.execute(
                    """
                    INSERT INTO document_chunks (id, source, chunk_index, text, embedding, metadata)
                    VALUES ($1, $2, $3, $4, $5::vector, $6)
                    ON CONFLICT (id) DO UPDATE
                        SET text = EXCLUDED.text,
                            embedding = EXCLUDED.embedding,
                            metadata = EXCLUDED.metadata
                    """,
                    chunk_id,
                    source,
                    i,
                    chunk,
                    vec_str,
                    json.dumps(metadata or {}),
                )
    finally:
        await conn.close()

    return {"chunks_ingested": len(chunks), "source": source}


@mcp.tool()
async def similarity_search(query: str, top_k: int = 5) -> dict:
    """
    Embed *query* and return the top-k most similar document chunks.

    Args:
        query : the search query
        top_k : number of results (1–20)

    Returns:
        results : list of {text, source, score, metadata}

    Security note:
        If the WORKSPACE_SCOPE environment variable is set (injected by the
        agent pipeline as a subprocess env var), results are HARD-filtered to
        chunks whose metadata.workspace_id matches that value. This is a
        server-side guarantee the calling LLM cannot override or escape, which
        prevents one firm's uploaded documents from leaking into another's
        report. When unset (e.g. local debugging), no filter is applied.
    """
    top_k = max(1, min(20, top_k))
    query_vec = _embed([query])[0]
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    workspace_scope = os.environ.get("WORKSPACE_SCOPE")

    conn = await _get_conn()
    try:
        await _ensure_table(conn)
        if workspace_scope:
            rows = await conn.fetch(
                """
                SELECT text, source, metadata,
                       1 - (embedding <=> $1::vector) AS score
                FROM document_chunks
                WHERE metadata->>'workspace_id' = $3
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                vec_str,
                top_k,
                workspace_scope,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT text, source, metadata,
                       1 - (embedding <=> $1::vector) AS score
                FROM document_chunks
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                vec_str,
                top_k,
            )
    finally:
        await conn.close()

    return {
        "query": query,
        "results": [
            {
                "text": _sanitize(r["text"]),
                "source": r["source"],
                "score": float(r["score"]),
                "metadata": json.loads(r["metadata"]) if r["metadata"] else {},
            }
            for r in rows
        ],
    }


@mcp.tool()
async def delete_by_source(source: str) -> dict:
    """
    Delete all chunks that match the given *source* label.

    Args:
        source : the exact source string used at ingest time

    Returns:
        deleted : number of rows removed
    """
    conn = await _get_conn()
    try:
        result = await conn.execute(
            "DELETE FROM document_chunks WHERE source = $1", source
        )
        # result is "DELETE <n>"
        count = int(result.split()[-1])
    finally:
        await conn.close()
    return {"deleted": count, "source": source}


if __name__ == "__main__":
    mcp.run(transport="stdio")
