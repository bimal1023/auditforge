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

_KEEPALIVE_INTERVAL = 8    # seconds — keep proxies/browsers from timing out long runs


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
        # Also append to a persistent list so the poll endpoint can catch up
        # even when the SSE stream has dropped.
        list_key = f"auditforge:report:{report_id}:event_log"
        client.rpush(list_key, payload)
        client.expire(list_key, 3600)   # 1-hour TTL — enough for any report run
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

    Uses pubsub.listen() (block=True under the hood) so the coroutine truly
    suspends until data arrives on the socket — avoiding the polling-loop
    behaviour of get_message(timeout>0) in redis.asyncio.

    Keepalives fire every _KEEPALIVE_INTERVAL seconds via asyncio.wait_for.
    On each keepalive the DB is re-checked: if the task completed while we
    were waiting (missed the pub/sub event), we synthesise the terminal event
    so the browser doesn't hang forever.

    catchup_check:
        Optional async callable returning the current report status string.
        Called once after the subscription is confirmed and once per keepalive.
    """
    from redis.asyncio import Redis
    from backend.core.config import get_settings

    client: Redis = Redis.from_url(get_settings().redis_url, socket_connect_timeout=3)
    pubsub = client.pubsub()
    channel = _channel(report_id)

    # Subscribe FIRST so we don't miss events published while we're setting up.
    await pubsub.subscribe(channel)

    try:
        # ── Initial catch-up ──────────────────────────────────────────────
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

        # ── Stream via listen() ───────────────────────────────────────────
        # pubsub.listen() is an async generator that calls parse_response
        # with block=True, giving us a real socket-level wait rather than a
        # polling loop.  We wrap each __anext__() call in asyncio.wait_for so
        # we can send keepalives and re-check the DB without hanging forever.
        listener = pubsub.listen()

        while True:
            try:
                message = await asyncio.wait_for(
                    listener.__anext__(),
                    timeout=_KEEPALIVE_INTERVAL,
                )
            except asyncio.TimeoutError:
                # No Redis message for _KEEPALIVE_INTERVAL seconds.
                yield ": keepalive\n\n"
                # DB fallback: if the task finished but we missed the event,
                # synthesise the terminal event now.
                if catchup_check is not None:
                    status = await catchup_check()
                    if status in ("complete", "error"):
                        logger.info(
                            "SSE fallback: report %s already %s, synthesising terminal event",
                            report_id, status,
                        )
                        payload = json.dumps({
                            "type": status,
                            "report_id": report_id,
                            "message": "Report complete.",
                            "ts": time.time(),
                        })
                        yield f"data: {payload}\n\n"
                        return
                continue
            except StopAsyncIteration:
                break

            # redis-py listen() yields subscribe-confirm messages first;
            # skip them and only forward real "message" type frames.
            if message.get("type") != "message":
                continue

            data: str = message["data"]
            if isinstance(data, bytes):
                data = data.decode()

            yield f"data: {data}\n\n"

            try:
                parsed = json.loads(data)
                if parsed.get("type") in ("complete", "error"):
                    return
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
