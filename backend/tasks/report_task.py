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
    max_retries=1,
    soft_time_limit=600,   # 10 min soft kill
    time_limit=660,        # 11 min hard kill
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
            await db.commit()

        # ── Run orchestrator ───────────────────────────────────────────────
        request = ReportRequest(**request_data)
        result: DueDiligenceReport = await Orchestrator(report_id=str(report_id)).run(request)
        result.id = report_id

        # ── Persist result ─────────────────────────────────────────────────
        async with factory() as db:
            record = await db.get(ReportRecord, report_id)
            if record:
                record.status = "complete"
                record.data = result.model_dump(mode="json")
                await db.commit()

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
                    record.error = str(exc)
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
