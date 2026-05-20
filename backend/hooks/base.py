"""Base hook interface and shared HookContext dataclass."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4


@dataclass
class HookContext:
    """Mutable bag of state passed through every hook in the chain."""
    request_id: UUID = field(default_factory=uuid4)
    agent: str = ""
    raw_input: dict[str, Any] = field(default_factory=dict)
    normalized_input: dict[str, Any] = field(default_factory=dict)
    raw_output: Any = None
    validated_output: Any = None
    policy_violations: list[str] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    tool_calls: list[dict] = field(default_factory=list)   # recorded by audit hook
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseHook:
    """
    Lifecycle:
      pre_run(ctx)  → called before the agent loop starts
      post_run(ctx) → called after the agent loop finishes
    Raise ValueError to abort; return ctx to continue.
    """

    async def pre_run(self, ctx: HookContext) -> HookContext:
        return ctx

    async def post_run(self, ctx: HookContext) -> HookContext:
        return ctx
