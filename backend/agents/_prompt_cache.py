"""
Prompt caching helpers for Anthropic API calls.

Marking the system prompt with cache_control=ephemeral tells Anthropic to
cache it for 5 minutes. Within a single agent run (10-14 API calls), all
calls after the first reuse the cached prompt — saving ~90% of system-prompt
token costs.

Minimum cacheable size: 1024 tokens (Sonnet/Opus), 2048 tokens (Haiku).
The system prompts + tool schemas in every agent exceed these thresholds.
"""
from __future__ import annotations


def cached_system(prompt: str) -> list[dict]:
    """Wrap a system prompt string for Anthropic prompt caching."""
    return [{"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}}]


# Beta header required to enable prompt caching
PROMPT_CACHE_HEADERS = {"anthropic-beta": "prompt-caching-2024-07-31"}
