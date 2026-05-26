"""
File upload → RAG ingestion pipeline.

POST /documents  — upload a PDF or CSV, parse it, ingest into pgvector store.
GET  /documents  — list documents uploaded by the current user.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.models.db import DocumentRecord, User
from backend.agents._mcp_client import MCPClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/vnd.ms-excel": "csv",
    "text/plain": "csv",
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _detect_file_type(content: bytes) -> str | None:
    """Detect file type from magic bytes — not from client-supplied headers."""
    if content[:4] == b"%PDF":
        return "pdf"
    # CSV/plain text: must be valid UTF-8 with delimiter characters
    try:
        sample = content[:2048].decode("utf-8")
        if any(c in sample for c in (",", "\t")) and "\n" in sample:
            return "csv"
    except UnicodeDecodeError:
        pass
    return None


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    source_label: str
    file_type: str
    chunks_ingested: int


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DocumentResponse:
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    # Validate by actual file content (magic bytes), not client-supplied headers
    file_type = _detect_file_type(contents)
    if file_type is None:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload a PDF or CSV — content must match the file type.",
        )

    settings = get_settings()
    source_label = f"{file.filename} (uploaded by {current_user.email})"

    # Strip +asyncpg driver prefix — asyncpg uses plain postgresql:// scheme
    db_url = settings.database_url
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if db_url.startswith(prefix):
            db_url = "postgresql://" + db_url[len(prefix):]
            break

    with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    chunks_ingested = 0
    try:
        # Step 1: parse
        async with MCPClient(settings.file_ingest_mcp_script) as ingest:
            tool = "parse_pdf" if file_type == "pdf" else "parse_csv"
            raw = await ingest.call_tool(tool, {"file_path": tmp_path})

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail=f"Parse response was not JSON: {exc}")

        if "error" in parsed:
            raise HTTPException(status_code=422, detail=f"Parse error: {parsed['error']}")

        text = parsed.get("text", "") if file_type == "pdf" else "\n".join(str(r) for r in parsed.get("rows", []))
        if not text.strip():
            raise HTTPException(status_code=422, detail="No text could be extracted from the file")

        # Step 2: ingest into pgvector (best-effort — failure saves doc with 0 chunks)
        try:
            async with MCPClient(
                settings.pgvector_mcp_script,
                extra_env={"DATABASE_URL": db_url},
            ) as rag:
                ingest_raw = await rag.call_tool(
                    "ingest_document",
                    {
                        "text": text,
                        "source": source_label,
                        "metadata": {
                            "user_id": str(current_user.id),
                            "filename": file.filename,
                            "file_type": file_type,
                        },
                    },
                )
                try:
                    ingest_data = json.loads(ingest_raw)
                    chunks_ingested = ingest_data.get("chunks_ingested", 0)
                except json.JSONDecodeError:
                    logger.warning("Could not parse ingest response: %s", ingest_raw)
        except Exception as rag_exc:
            # pgvector RAG is not yet fully wired up — log and continue so the
            # document record is still saved and the file appears in the library.
            logger.warning("pgvector ingestion skipped (%s: %s)", type(rag_exc).__name__, rag_exc)

    finally:
        os.unlink(tmp_path)

    record = DocumentRecord(
        user_id=current_user.id,
        filename=file.filename or "unknown",
        source_label=source_label,
        file_type=file_type,
        chunks_ingested=chunks_ingested,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return DocumentResponse(
        id=record.id,
        filename=record.filename,
        source_label=record.source_label,
        file_type=record.file_type,
        chunks_ingested=record.chunks_ingested,
    )


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> None:
    result = await db.execute(
        select(DocumentRecord).where(
            DocumentRecord.id == doc_id,
            DocumentRecord.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(record)
    await db.commit()


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[DocumentResponse]:
    result = await db.execute(
        select(DocumentRecord)
        .where(DocumentRecord.user_id == current_user.id)
        .order_by(DocumentRecord.created_at.desc())
    )
    return [
        DocumentResponse(
            id=r.id,
            filename=r.filename,
            source_label=r.source_label,
            file_type=r.file_type,
            chunks_ingested=r.chunks_ingested,
        )
        for r in result.scalars().all()
    ]
