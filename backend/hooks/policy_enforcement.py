"""Enforce business rules before and after the agentic loop."""
from __future__ import annotations

import re

from .base import BaseHook, HookContext

# Companies we must not produce reports on (OFAC-style blocklist placeholder)
_BLOCKED_COMPANIES: frozenset[str] = frozenset()

# Domains the web-search agent may not query
_BLOCKED_DOMAINS: frozenset[str] = frozenset({"pastebin.com", "darkweb"})

# Regex patterns that flag PII in the context field
_PII_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),        # SSN
    re.compile(r"\b4[0-9]{12}(?:[0-9]{3})?\b"),  # Visa card
]


class PolicyEnforcementHook(BaseHook):
    """
    pre_run:  block prohibited companies; flag PII in context.
    post_run: placeholder for output-level policy checks (e.g. no insider
              trading language in report text).
    """

    async def pre_run(self, ctx: HookContext) -> HookContext:
        inp = ctx.normalized_input
        company = inp.get("company", "").upper()

        if company in {b.upper() for b in _BLOCKED_COMPANIES}:
            raise ValueError(f"Policy violation: company '{company}' is on the restricted list")

        context_text = inp.get("context") or ""
        for pattern in _PII_PATTERNS:
            if pattern.search(context_text):
                ctx.policy_violations.append("PII detected in context field; field cleared")
                inp["context"] = ""
                break

        ctx.normalized_input = inp
        return ctx

    async def post_run(self, ctx: HookContext) -> HookContext:
        if ctx.policy_violations:
            ctx.metadata["policy_violations"] = ctx.policy_violations
        return ctx
