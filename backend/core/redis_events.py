"""
Structured event bus over Redis pub/sub.

Celery tasks publish events synchronously; FastAPI SSE endpoints
subscribe asynchronously and relay them to the browser.

Event schema:
    type        : "agent_start" | "agent_done" | "agent_fail"
                  | "status" | "complete" | "error"
    report_id   : str
    agent       : str | None
    message     : str
    confidence  : float | None   (agent_done only)
    ts          : float
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import AsyncIterator, Awaitable, Callable

logger = logging.getLogger(__name__)

_KEEPALIVE_INTERVAL = 20   # seconds between keepalive pings


def _channel(report_id: str) -> str:
    return f"auditforge:report:{report_id}:events"


# ---------------------------------------------------------------------------
# Publish (synchronous — called from Celery worker)
# ---------------------------------------------------------------------------

def publish(report_id: str, event_type: str, message: str = "", **extra) -> None:
    """Fire-and-forget publish from sync context. Swallows errors."""
    try:
        import redis as _redis
        from backend.core.config import get_settings
        client = _redis.from_url(get_settings().redis_url, socket_connect_timeout=2)
        payload = json.dumps({
            "type": event_type,
            "report_id": report_id,
            "message": message,
            "ts": time.time(),
            **extra,
        })
        client.publish(_channel(report_id), payload)
        client.close()
    except Exception as exc:
        logger.warning("redis_events.publish failed (non-fatal): %s", exc)


# ---------------------------------------------------------------------------
# Subscribe (async — called from FastAPI SSE endpoint)
# ---------------------------------------------------------------------------

async def subscribe(
    report_id: str,
    catchup_check: Callable[[], Awaitable[str | None]] | None = None,
) -> AsyncIterator[str]:
    """
    Async generator yielding raw SSE-formatted strings.

    catchup_check:
        Optional async callable that returns the current report status string
        (e.g. "complete", "error", "running").  Called AFTER the Redis
        subscription is set up to eliminate the race where the task finishes
        between the route handler's DB check and this subscription starting.
        If it returns "complete" or "error", a terminal event is emitted
        immediately without waiting for a Redis message.
    """
    from redis.asyncio import Redis
    from backend.core.config import get_settings

    client: Redis = Redis.from_url(get_settings().redis_url, socket_connect_timeout=3)
    pubsub = client.pubsub()
    channel = _channel(report_id)

    # Subscribe FIRST — before any DB checks — so we don't miss events
    # published between a DB status check and this subscription being ready.
    await pubsub.subscribe(channel)

    try:
        # Catch-up check: if the task already finished while we were setting up
        if catchup_check is not None:
            status = await catchup_check()
            if status in ("complete", "error"):
                payload = json.dumps({
                    "type": status,
                    "report_id": report_id,
                    "message": "Report already complete.",
                    "ts": time.time(),
                })
                yield f"data: {payload}\n\n"
                return

        while True:
            try:
                # get_message(timeout=0) is non-blocking in redis-py async.
                # We wrap it in asyncio.wait_for so we can send keepalives
                # and yield control to other coroutines while waiting.
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=0),
                    timeout=_KEEPALIVE_INTERVAL,
                )
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            if message is None:
                await asyncio.sleep(0.05)
                continue

            data: str = message["data"]
            if isinstance(data, bytes):
                data = data.decode()

            yield f"data: {data}\n\n"

            try:
                parsed = json.loads(data)
                if parsed.get("type") in ("complete", "error"):
                    break
            except json.JSONDecodeError:
                pass

    finally:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await client.aclose()
        except Exception:
            pass
