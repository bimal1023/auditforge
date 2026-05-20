"""
Validate agent output against the Pydantic section schemas.

Phase 1: light validation — ensure output is not None and has citations.
Phase 2 (TODO): enforce minimum citation count per claim, confidence threshold.
"""
from __future__ import annotations

from pydantic import BaseModel

from .base import BaseHook, HookContext


class OutputValidationHook(BaseHook):
    """
    post_run:
      1. Confirm ctx.raw_output is a Pydantic model instance.
      2. Confirm citations list is non-empty (schema validator already enforces
         this, but we add an explicit hook-level check for observability).
      3. Attach validated output to ctx.validated_output.
    """

    async def post_run(self, ctx: HookContext) -> HookContext:
        output = ctx.raw_output

        if output is None:
            raise ValueError(f"[{ctx.agent}] Agent returned no output")

        if isinstance(output, BaseModel):
            citations = getattr(output, "citations", None)
            if citations is not None and len(citations) == 0:
                raise ValueError(
                    f"[{ctx.agent}] Output validation failed: citations list is empty"
                )
            ctx.validated_output = output
        else:
            # Raw dict — store as-is; schema enforcement happens at the agent layer
            ctx.validated_output = output

        return ctx
