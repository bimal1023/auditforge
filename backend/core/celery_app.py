"""Celery application factory."""
from __future__ import annotations

from celery import Celery

from backend.core.config import get_settings


def make_celery() -> Celery:
    settings = get_settings()
    app = Celery(
        "auditforge",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["backend.tasks.report_task"],  # force-import so task name is registered
    )
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,          # only ack after task completes
        worker_prefetch_multiplier=1,  # one task at a time per worker
    )
    return app


celery_app = make_celery()
