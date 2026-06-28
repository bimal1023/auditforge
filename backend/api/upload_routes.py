"""
File upload → RAG ingestion pipeline.

POST /documents  — upload a deal-room file (PDF / CSV / XLSX / DOCX / TXT),
                   parse it, and ingest into the pgvector store.
GET  /documents  — list documents uploaded by the current user.
"""
from __future__ import annotations

import io
import json
import logging
import os
import tempfile
import uuid
import zipfile

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.activity import log_activity
from backend.core.auth import get_current_user
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import DocumentRecord, User
from backend.agents._mcp_client import MCPClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# file_type → MCP parser tool. The key is also used as the temp-file suffix.
PARSER_BY_TYPE = {
    "pdf": "parse_pdf",
    "csv": "parse_csv",
    "xlsx": "parse_xlsx",
    "docx": "parse_docx",
    "pptx": "parse_pptx",
    "txt": "parse_txt",
}

# Human-readable list for error messages.
SUPPORTED_LABEL = "PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, or text (.txt)"


def _ooxml_kind(content: bytes) -> str | None:
    """Disambiguate a ZIP-based OOXML file into 'docx' or 'xlsx'.

    All OOXML files are ZIP archives (magic bytes `PK\\x03\\x04`). We peek at the
    archive's member names: Word docs carry a `word/` part, Excel workbooks an
    `xl/` part, PowerPoint decks a `ppt/` part. Anything else is unsupported → None.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile:
        return None
    if any(n.startswith("word/") for n in names):
        return "docx"
    if any(n.startswith("xl/") for n in names):
        return "xlsx"
    if any(n.startswith("ppt/") for n in names):
        return "pptx"
    return None


def _detect_file_type(content: bytes) -> str | None:
    """Detect file type from content (magic bytes), not client-supplied headers.

    Returns one of PARSER_BY_TYPE's keys, or None if unsupported.
    """
    if content[:4] == b"%PDF":
        return "pdf"
    # OOXML (docx/xlsx) — ZIP local-file-header signature.
    if content[:4] == b"PK\x03\x04":
        return _ooxml_kind(content)
    # Text-based: must be valid UTF-8. CSV if it has delimiters, else plain text.
    try:
        sample = content[:2048].decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not sample.strip():
        return None
    if any(c in sample for c in (",", "\t")) and "\n" in sample:
        return "csv"
    return "txt"


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    source_label: str
    file_type: str
    chunks_ingested: int


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
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
            detail=f"Unsupported file type. Upload a {SUPPORTED_LABEL} — content must match the file type.",
        )

    settings = get_settings()
    current_user = ctx.user
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
        # Step 1: parse. max_chars=0 so the parser's full output (capped at the
        # server's MAX_TEXT_CHARS=100k) survives the MCP boundary intact —
        # otherwise large docs would be silently truncated to ~12k chars before
        # ingestion and most of the document would never be searchable.
        async with MCPClient(settings.file_ingest_mcp_script) as ingest:
            tool = PARSER_BY_TYPE[file_type]
            raw = await ingest.call_tool(tool, {"file_path": tmp_path}, max_chars=0)

        try:
            parsed = json.loads(raw, strict=False)
        except json.JSONDecodeError as exc:
            logger.warning("Parse response was not valid JSON: %s", exc)
            raise HTTPException(status_code=422, detail="Failed to parse document — the file may be corrupted or encrypted")

        if "error" in parsed:
            raise HTTPException(status_code=422, detail=f"Parse error: {parsed['error']}")

        # CSV returns structured rows; everything else returns a "text" field.
        if file_type == "csv":
            text = "\n".join(str(r) for r in parsed.get("rows", []))
        else:
            text = parsed.get("text", "")
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
                            # workspace_id is the scoping key the agent pipeline
                            # filters on (WORKSPACE_SCOPE) so a firm only ever
                            # retrieves its own uploaded documents.
                            "workspace_id": str(ctx.workspace.id),
                            "filename": file.filename,
                            "file_type": file_type,
                        },
                    },
                    max_chars=0,
                )
                try:
                    ingest_data = json.loads(ingest_raw, strict=False)
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
        workspace_id=ctx.workspace.id,
        filename=file.filename or "unknown",
        source_label=source_label,
        file_type=file_type,
        chunks_ingested=chunks_ingested,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Log activity
    await log_activity(
        db=db,
        workspace_id=ctx.workspace.id,
        actor_user_id=ctx.user.id,
        event_type="document_uploaded",
        summary=f"{ctx.user.full_name or ctx.user.email} uploaded {record.filename}",
        details={"document_id": str(record.id), "filename": record.filename},
    )
    await db.commit()

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
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    result = await db.execute(
        select(DocumentRecord).where(
            DocumentRecord.id == doc_id,
            DocumentRecord.workspace_id == ctx.workspace.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Also purge vector chunks from pgvector (best-effort — don't block delete)
    if record.chunks_ingested > 0:
        settings = get_settings()
        db_url = settings.database_url
        for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
            if db_url.startswith(prefix):
                db_url = "postgresql://" + db_url[len(prefix):]
                break
        try:
            async with MCPClient(
                settings.pgvector_mcp_script,
                extra_env={"DATABASE_URL": db_url},
            ) as rag:
                await rag.call_tool("delete_by_source", {"source": record.source_label})
        except Exception as exc:
            logger.warning("pgvector chunk cleanup failed (%s: %s)", type(exc).__name__, exc)

    await db.delete(record)
    await db.commit()


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> list[DocumentResponse]:
    result = await db.execute(
        select(DocumentRecord)
        .where(DocumentRecord.workspace_id == ctx.workspace.id)
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
