"""
Celery tasks for watchlist drift scanning.

Two tasks:
  - run_drift_check: Tier-1 lightweight check for a single watchlist item
  - run_watchlist_scan: Periodic task that dispatches drift checks for all due items
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from backend.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=1,
    soft_time_limit=150,
    time_limit=180,
    name="backend.tasks.run_drift_check",
)
def run_drift_check(self, watchlist_item_id: str) -> dict:
    try:
        return asyncio.run(_run_drift(uuid.UUID(watchlist_item_id)))
    except Exception as exc:
        logger.exception("Drift check failed for item %s", watchlist_item_id)
        raise self.retry(exc=exc, countdown=30)


async def _run_drift(item_id: uuid.UUID) -> dict:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload

    from backend.agents.drift_agent import DriftAgent
    from backend.core.config import get_settings
    from backend.models.db import DriftEvent, ReportRecord, WatchlistItem

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with factory() as db:
            item = await db.get(WatchlistItem, item_id)
            if item is None:
                return {"error": "watchlist item not found"}

            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            cache_key = f"{item.company.upper()}:{(item.ticker or '').upper()}:{today_str}"

            cached = await db.execute(
                select(DriftEvent)
                .where(DriftEvent.scan_cache_key == cache_key)
                .limit(1)
            )
            cached_event = cached.scalar_one_or_none()

            if cached_event:
                clone = DriftEvent(
                    watchlist_item_id=item.id,
                    event_type=cached_event.event_type,
                    severity=cached_event.severity,
                    summary=cached_event.summary,
                    details=cached_event.details,
                    scan_cache_key=cache_key,
                )
                db.add(clone)
                item.last_scan_at = datetime.now(timezone.utc)
                if cached_event.event_type == "material_change":
                    item.last_drift_at = datetime.now(timezone.utc)
                await db.commit()
                return {"status": "cache_hit", "item_id": str(item_id)}

            baseline_context = None
            if item.baseline_report_id:
                report = await db.get(ReportRecord, item.baseline_report_id)
                if report and report.data:
                    baseline_context = _extract_baseline(report.data)

        result = await DriftAgent().run(
            company=item.company,
            ticker=item.ticker,
            baseline_context=baseline_context,
        )

        if result.has_material_change:
            event_type = "material_change"
            severity = max(
                (c.severity for c in result.changes),
                key=lambda s: {"low": 0, "medium": 1, "high": 2}.get(s, 0),
                default="medium",
            )
        elif result.changes:
            event_type = "minor_change"
            severity = "low"
        else:
            event_type = "no_change"
            severity = "none"

        async with factory() as db:
            item = await db.get(WatchlistItem, item_id)
            if item is None:
                return {"error": "item disappeared during scan"}

            event = DriftEvent(
                watchlist_item_id=item.id,
                event_type=event_type,
                severity=severity,
                summary=result.summary,
                details={
                    "changes": [c.model_dump() for c in result.changes],
                    "confidence_score": result.confidence_score,
                },
                scan_cache_key=cache_key,
            )
            db.add(event)
            item.last_scan_at = datetime.now(timezone.utc)
            if event_type == "material_change":
                item.last_drift_at = datetime.now(timezone.utc)
            await db.commit()

        return {"status": event_type, "item_id": str(item_id)}

    except Exception as exc:
        logger.exception("Drift check error for item %s", item_id)
        try:
            async with factory() as db:
                item = await db.get(WatchlistItem, item_id)
                if item:
                    event = DriftEvent(
                        watchlist_item_id=item.id,
                        event_type="no_change",
                        severity="none",
                        summary=f"Drift check failed: {type(exc).__name__}",
                        details={"error": str(exc)},
                    )
                    db.add(event)
                    item.last_scan_at = datetime.now(timezone.utc)
                    await db.commit()
        except Exception:
            logger.exception("Failed to record drift error for item %s", item_id)
        raise

    finally:
        try:
            await engine.dispose()
        except Exception as e:
            logger.warning("Engine dispose error (non-fatal): %s", e)


def _extract_baseline(data: dict) -> str:
    parts: list[str] = []
    if data.get("executive_summary"):
        parts.append(f"Executive Summary: {data['executive_summary']}")
    if data.get("overall_score") is not None:
        parts.append(f"Overall Score: {data['overall_score']}/10")
    for section in ("financial", "risk", "market", "legal"):
        sec = data.get(section)
        if sec and isinstance(sec, dict) and sec.get("summary"):
            parts.append(f"{section.title()}: {sec['summary']}")
    return "\n\n".join(parts)[:2000]


@celery_app.task(
    bind=True,
    soft_time_limit=120,
    time_limit=150,
    name="backend.tasks.run_watchlist_scan",
)
def run_watchlist_scan(self) -> dict:
    return asyncio.run(_scan_due_items())


async def _scan_due_items() -> dict:
    from sqlalchemy import and_, or_, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from backend.core.config import get_settings
    from backend.models.db import User, WatchlistItem

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        now = datetime.now(timezone.utc)
        async with factory() as db:
            stmt = (
                select(WatchlistItem)
                .join(User, WatchlistItem.user_id == User.id)
                .where(
                    WatchlistItem.status == "active",
                    User.plan_tier.in_(["desk", "firm"]),
                    or_(
                        WatchlistItem.last_scan_at.is_(None),
                        and_(
                            WatchlistItem.scan_frequency == "daily",
                            WatchlistItem.last_scan_at < now - timedelta(hours=24),
                        ),
                        and_(
                            WatchlistItem.scan_frequency == "weekly",
                            WatchlistItem.last_scan_at < now - timedelta(days=7),
                        ),
                    ),
                )
            )
            result = await db.execute(stmt)
            items = result.scalars().all()

        dispatched = 0
        for item in items:
            run_drift_check.delay(str(item.id))
            dispatched += 1

        logger.info("Watchlist scan dispatched %d drift checks", dispatched)
        return {"dispatched": dispatched}

    finally:
        try:
            await engine.dispose()
        except Exception as e:
            logger.warning("Engine dispose error (non-fatal): %s", e)
