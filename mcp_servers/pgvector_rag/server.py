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

import hashlib
import json
import os
from typing import Any

import asyncpg
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("pgvector-rag")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/auditforge",
).replace("postgresql+asyncpg://", "postgresql://")  # asyncpg uses plain scheme

EMBEDDING_DIM = 384
CHUNK_SIZE = 500      # characters
CHUNK_OVERLAP = 50    # characters

_embedder = None  # lazy-loaded so server starts fast


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise RuntimeError(
                "sentence-transformers is not installed — run: "
                "pip install sentence-transformers"
            )
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def _embed(texts: list[str]) -> list[list[float]]:
    model = _get_embedder()
    vectors = model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()


def _chunk_text(text: str) -> list[str]:
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
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
        ON document_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
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
    """
    top_k = max(1, min(20, top_k))
    query_vec = _embed([query])[0]
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    conn = await _get_conn()
    try:
        await _ensure_table(conn)
        rows = await conn.fetch(
            f"""
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
                "text": r["text"],
                "source": r["source"],
                "score": float(r["score"]),
                "metadata": json.loads(r["metadata"]) if r["metadata"] else {},
            }
            for r in rows
        ],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
