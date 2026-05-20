"""Sanitise and normalise agent inputs before the agentic loop runs."""
from __future__ import annotations

import re
import unicodedata

from .base import BaseHook, HookContext


class InputNormalizationHook(BaseHook):
    """
    - Strip leading/trailing whitespace from all string fields.
    - Normalise unicode to NFC (handles curly quotes, em-dashes, etc.).
    - Upper-case ticker symbols.
    - Truncate oversized context strings to 4 000 chars.
    - Copy cleaned values into ctx.normalized_input.
    """

    MAX_CONTEXT_LEN = 4_000

    async def pre_run(self, ctx: HookContext) -> HookContext:
        raw = ctx.raw_input
        norm: dict = {}

        for key, val in raw.items():
            if isinstance(val, str):
                val = unicodedata.normalize("NFC", val).strip()
                val = re.sub(r"\s+", " ", val)

                if key == "ticker":
                    val = val.upper()

                if key == "context" and len(val) > self.MAX_CONTEXT_LEN:
                    val = val[: self.MAX_CONTEXT_LEN]

                norm[key] = val
            else:
                norm[key] = val

        ctx.normalized_input = norm
        return ctx
