"""
Structured audit log for every agent invocation.

Each call is written to the Python logger as a JSON-serialisable dict so it
can be shipped to any log aggregator (CloudWatch, Datadog, etc.).
"""
from __future__ import annotations

import json
import logging
import time

from .base import BaseHook, HookContext

logger = logging.getLogger("arthvion.audit")


class AuditLoggingHook(BaseHook):
    """
    pre_run:  record invocation start.
    post_run: record completion with duration, tool-call count, and any
              policy violations.
    """

    async def pre_run(self, ctx: HookContext) -> HookContext:
        logger.info(
            json.dumps({
                "event": "agent_start",
                "request_id": str(ctx.request_id),
                "agent": ctx.agent,
                "company": ctx.normalized_input.get("company", ""),
                "ticker": ctx.normalized_input.get("ticker", ""),
                "ts": ctx.started_at,
            })
        )
        return ctx

    async def post_run(self, ctx: HookContext) -> HookContext:
        duration = time.time() - ctx.started_at
        output = ctx.validated_output or ctx.raw_output
        confidence = getattr(output, "confidence_score", None)

        logger.info(
            json.dumps({
                "event": "agent_complete",
                "request_id": str(ctx.request_id),
                "agent": ctx.agent,
                "company": ctx.normalized_input.get("company", ""),
                "duration_s": round(duration, 3),
                "tool_calls": len(ctx.tool_calls),
                "confidence_score": confidence,
                "policy_violations": ctx.policy_violations,
            })
        )
        return ctx
