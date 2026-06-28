"""
Celery task for running due diligence reports.

Each task gets exactly ONE asyncio.run() call and a fresh SQLAlchemy engine.
Using two asyncio.run() calls (e.g. one for the happy path, one for error
marking) causes "Future attached to a different loop" because asyncpg
connections are bound to the first event loop and cannot be reused in the
second.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

from backend.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=2,
    acks_late=True,            # don't ack until task completes — requeues on worker crash
    reject_on_worker_lost=False,  # don't auto-requeue on crash — prevents ghost tasks on restart
    soft_time_limit=660,   # 11 min soft kill
    time_limit=720,        # 12 min hard kill
    name="backend.tasks.run_report",
)
def run_report(self, report_id: str, request_data: dict) -> dict:
    """Run the full orchestrator pipeline for a single report."""
    try:
        return asyncio.run(_run_task(uuid.UUID(report_id), request_data))
    except Exception as exc:
        logger.exception("Celery task failed for report %s", report_id)
        raise self.retry(exc=exc, countdown=10)


async def _run_task(report_id: uuid.UUID, request_data: dict) -> dict:
    """
    Single coroutine — handles both happy path and error marking so there is
    never more than one asyncio.run() call per Celery task invocation.

    Creates a fresh SQLAlchemy engine (not the module-level cached one) so
    asyncpg connections are always bound to the current event loop.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from backend.agents.orchestrator import Orchestrator
    from backend.core.config import get_settings
    from backend.models.db import ReportRecord
    from backend.models.report import DueDiligenceReport, ReportRequest

    # Fresh engine — the global cached engine in database.py may be tied to a
    # different (FastAPI) event loop, so we never use it inside Celery tasks.
    engine = create_async_engine(get_settings().database_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        # ── Mark running ───────────────────────────────────────────────────
        async with factory() as db:
            record = await db.get(ReportRecord, report_id)
            if record is None:
                return {"error": "report not found"}
            record.status = "running"
            workspace_id = record.workspace_id
            await db.commit()

        # ── Enable uploaded-document retrieval (RAG) only when the workspace
        #     actually has ingested documents. This avoids spawning the
        #     pgvector subprocess (and loading the embedding model) on every
        #     report for workspaces that never uploaded anything. ──────────────
        rag_workspace_id = await _workspace_id_if_has_documents(factory, workspace_id)

        # ── Run orchestrator ───────────────────────────────────────────────
        request = ReportRequest(**request_data)
        result: DueDiligenceReport = await Orchestrator(
            report_id=str(report_id),
            workspace_id=rag_workspace_id,
        ).run(request)
        result.id = report_id

        # ── Persist result ─────────────────────────────────────────────────
        async with factory() as db:
            record = await db.get(ReportRecord, report_id)
            if record:
                record.status = "complete"
                record.data = result.model_dump(mode="json")
                await db.commit()

        # ── Deep Dive auto-hook ────────────────────────────────────────────
        # If this report was launched from a Deal Pipeline card (Deep Dive),
        # auto-generate its Action Queue so the deal team lands on a ready
        # work list. Best-effort: never let this break the report itself.
        try:
            await _auto_generate_actions_if_deal(factory, report_id, result.model_dump(mode="json"))
        except Exception:
            logger.exception("Deep Dive action auto-generation failed for report %s", report_id)

        # Publish AFTER DB commit so the frontend always fetches complete data
        from backend.core.redis_events import publish as _publish, publish_workspace
        _publish(str(report_id), "complete", message="Report complete.")

        # Log activity event (sync-safe: just use the async factory we already have)
        try:
            from backend.models.db import ActivityEvent
            async with factory() as db:
                record = await db.get(ReportRecord, report_id)
                if record and record.workspace_id:
                    event = ActivityEvent(
                        workspace_id=record.workspace_id,
                        actor_user_id=record.user_id,
                        event_type="report_completed",
                        summary=f"Report on {record.company} completed",
                        details={"report_id": str(report_id), "company": record.company},
                    )
                    db.add(event)
                    await db.commit()
                    publish_workspace(
                        workspace_id=str(record.workspace_id),
                        event_type="report_completed",
                        summary=f"Report on {record.company} completed",
                    )
        except Exception:
            logger.warning("Activity log for report_completed failed (non-fatal)")

        return {"status": "complete", "report_id": str(report_id)}

    except Exception as exc:
        logger.exception("Orchestrator failed for report %s", report_id)
        # Notify SSE subscribers so their streams close cleanly
        try:
            from backend.core.redis_events import publish
            publish(str(report_id), "error", message=str(exc))
        except Exception:
            pass
        # Error marking runs in the SAME event loop — no second asyncio.run()
        try:
            async with factory() as db:
                record = await db.get(ReportRecord, report_id)
                if record:
                    record.status = "error"
                    # Store a safe reference only — full exception logged server-side above
                    record.error = f"Report generation failed (ref: {str(report_id)[:8]})"
                    await db.commit()
        except Exception:
            logger.exception("Failed to mark report %s as error", report_id)
        raise

    finally:
        try:
            await engine.dispose()
        except Exception as dispose_err:
            # anyio cancel scopes from MCP cleanup can cancel asyncpg connections
            # before dispose() runs — this is harmless, don't let it crash the worker
            logger.warning("Engine dispose error (non-fatal): %s", dispose_err)


async def _workspace_id_if_has_documents(factory, workspace_id) -> str | None:
    """Return ``str(workspace_id)`` only if the workspace has ≥1 ingested document.

    Used to decide whether to enable pgvector RAG retrieval for the run. Returns
    None (RAG disabled) when there's no workspace or no uploaded documents, so we
    never pay the embedding-model spawn cost for workspaces with an empty library.
    Best-effort: any error → None (core SEC/web analysis is unaffected).
    """
    if workspace_id is None:
        return None
    try:
        from sqlalchemy import func, select

        from backend.models.db import DocumentRecord

        async with factory() as db:
            count = await db.scalar(
                select(func.count())
                .select_from(DocumentRecord)
                .where(
                    DocumentRecord.workspace_id == workspace_id,
                    DocumentRecord.chunks_ingested > 0,
                )
            )
        return str(workspace_id) if count and count > 0 else None
    except Exception:
        logger.warning("Document-availability check failed (non-fatal); RAG disabled for this run")
        return None


async def _auto_generate_actions_if_deal(factory, report_id: uuid.UUID, report_data: dict) -> None:
    """If a Deal Pipeline card links this report (Deep Dive), build its Action Queue.

    Replaces any prior auto-generated actions for the report; manual actions are
    untouched. No-op when the report isn't linked to a deal, so ordinary reports
    don't pay the extra inference cost.
    """
    from sqlalchemy import delete, select

    from backend.models.db import Deal, DealAction
    from backend.services.action_generator import generate_actions

    async with factory() as db:
        deal = (
            await db.execute(select(Deal).where(Deal.report_id == report_id).limit(1))
        ).scalar_one_or_none()
        if deal is None:
            return  # not a Deep Dive — ordinary report, skip
        user_id = deal.user_id

    generated = await generate_actions(report_data)
    if not generated:
        logger.info("Deep Dive: no actions derived for report %s", report_id)
        return

    async with factory() as db:
        await db.execute(
            delete(DealAction).where(
                DealAction.report_id == report_id,
                DealAction.user_id == user_id,
                DealAction.origin == "auto",
            )
        )
        for g in generated:
            db.add(DealAction(
                user_id=user_id,
                report_id=report_id,
                title=g.title[:255],
                description=g.description,
                category=g.category,
                priority=g.priority,
                rationale=g.rationale,
                origin="auto",
            ))
        await db.commit()
    logger.info("Deep Dive: generated %d actions for report %s", len(generated), report_id)
