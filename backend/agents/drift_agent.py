"""
Drift Check Agent
=================
Lightweight Tier-1 agent that scans for material changes since a baseline
report. Uses the fast model (Haiku) and web search only — no SEC EDGAR MCP
— to keep cost under ~$0.30 per check.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import anthropic

from backend.core.config import get_settings
from backend.agents._prompt_cache import cached_system, PROMPT_CACHE_HEADERS
from backend.hooks.audit_logging import AuditLoggingHook
from backend.hooks.base import HookContext
from backend.hooks.input_normalization import InputNormalizationHook
from backend.hooks.output_validation import OutputValidationHook
from backend.hooks.policy_enforcement import PolicyEnforcementHook
from backend.models.drift import DriftCheckResult

from ._mcp_client import MCPClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are the Drift Detection Agent for Arthvion, a PE due diligence platform.

Your job is to check whether anything material has changed for a company since
the last full analysis. You will receive a baseline summary of the previous
report. Search for recent developments and compare against that baseline.

## Tools available
  - search_web(query, max_results, days_back) → web search results

## Process
Run 2-3 focused web searches:
  1. "<company> SEC 8-K filing OR press release site:sec.gov" (recent filings)
  2. "<company> earnings revenue news <current_year>" (financial news)
  3. "<company> lawsuit regulation investigation" (legal/regulatory)

Compare findings against the baseline context. Flag anything that represents
a material change: earnings surprise, M&A, executive departure, new litigation,
regulatory action, credit downgrade, or significant market shift.

## Output format — ONLY output valid JSON, no markdown fences:
{
  "company": "<string>",
  "ticker": "<string or null>",
  "has_material_change": <true or false>,
  "changes": [
    {
      "category": "<financial | regulatory | legal | market | management>",
      "title": "<short label>",
      "description": "<1-2 sentences>",
      "severity": "<low | medium | high>",
      "source": "<URL or reference>"
    }
  ],
  "summary": "<2-3 sentence overview of what changed or 'No material changes detected'>",
  "confidence_score": <0.0-1.0>
}

Rules:
- If nothing material changed, set has_material_change to false and return an
  empty changes array with a brief summary.
- Only flag genuinely material changes — routine news is not a drift event.
- confidence_score reflects how thorough your search was (1.0 = very confident
  in coverage, 0.5 = limited data available).
"""

MAX_ITERATIONS = 4


class DriftAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=settings.anthropic_max_retries,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.fast_model
        self._hooks_pre = [InputNormalizationHook(), PolicyEnforcementHook(), AuditLoggingHook()]
        self._hooks_post = [OutputValidationHook(), AuditLoggingHook(), PolicyEnforcementHook()]

    async def run(
        self,
        company: str,
        ticker: str | None = None,
        baseline_context: str | None = None,
    ) -> DriftCheckResult:
        ctx = HookContext(
            agent="drift_agent",
            raw_input={"company": company, "ticker": ticker, "context": baseline_context},
        )
        for hook in self._hooks_pre:
            ctx = await hook.pre_run(ctx)

        norm = ctx.normalized_input
        user_msg = f"Check for material changes for {norm['company']}"
        if norm.get("ticker"):
            user_msg += f" (ticker: {norm['ticker']})"
        if norm.get("context"):
            user_msg += f"\n\n<baseline_report>\n{norm['context']}\n</baseline_report>"
        else:
            user_msg += "\n\nNo baseline report available — report any notable recent developments."

        messages: list[dict[str, Any]] = [{"role": "user", "content": user_msg}]
        final_text = ""

        settings = get_settings()
        async with MCPClient(
            settings.web_search_mcp_script,
            extra_env={"TAVILY_API_KEY": settings.tavily_api_key},
        ) as mcp:
            tools = mcp.anthropic_tools()

            for _ in range(MAX_ITERATIONS):
                response = await self._client.messages.create(
                    model=self._model,
                    max_tokens=4096,
                    system=cached_system(SYSTEM_PROMPT),
                    tools=tools,
                    messages=messages,
                    extra_headers=PROMPT_CACHE_HEADERS,
                )
                for block in response.content:
                    if block.type == "text":
                        final_text = block.text

                if response.stop_reason == "end_turn":
                    break

                if response.stop_reason == "tool_use":
                    tool_results: list[dict] = []
                    for block in response.content:
                        if block.type == "tool_use":
                            ctx.tool_calls.append({"tool": block.name, "input": block.input})
                            raw = await mcp.call_tool(block.name, block.input)
                            tool_results.append(
                                {"type": "tool_result", "tool_use_id": block.id, "content": raw}
                            )
                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({"role": "user", "content": tool_results})

        try:
            _quick_json_check(final_text)
        except (json.JSONDecodeError, ValueError):
            logger.warning("DriftAgent JSON incomplete — running finalize call")
            try:
                messages.append({"role": "user", "content": "Output ONLY the complete JSON object now. No markdown, no tool calls."})
                fr = await self._client.messages.create(
                    model=self._model, max_tokens=4096,
                    system=cached_system(SYSTEM_PROMPT),
                    extra_headers=PROMPT_CACHE_HEADERS, messages=messages,
                )
                for block in fr.content:
                    if block.type == "text":
                        final_text = block.text
                        break
            except Exception as fe:
                logger.warning("DriftAgent finalize failed: %s", fe)

        ctx.raw_output = _parse_drift_result(final_text, norm["company"])
        for hook in self._hooks_post:
            ctx = await hook.post_run(ctx)
        return ctx.validated_output or ctx.raw_output  # type: ignore[return-value]


def _quick_json_check(text: str) -> None:
    if not text:
        raise ValueError("empty")
    t = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    t = re.sub(r"\s*```$", "", t.strip(), flags=re.MULTILINE)
    start = t.find("{")
    if start == -1:
        raise ValueError("no JSON object")
    json.loads(t[start:])


def _parse_drift_result(text: str, company: str) -> DriftCheckResult:
    try:
        text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)
        start = text.find("{")
        if start != -1:
            depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        text = text[start: i + 1]
                        break
        return DriftCheckResult.model_validate(json.loads(text))
    except Exception as exc:
        logger.warning("Could not parse DriftCheckResult JSON: %s", exc)
        return DriftCheckResult(
            company=company,
            has_material_change=False,
            summary=f"Drift check parsing failed: {exc}",
            confidence_score=0.0,
        )
