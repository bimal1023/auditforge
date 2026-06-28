"""
Market Agent
============
Researches total addressable market, competitive landscape, and growth
drivers via web search (and optionally the pgvector RAG store for any
uploaded analyst reports).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import anthropic

from backend.core.config import get_settings
from backend.agents._prompt_cache import cached_system, PROMPT_CACHE_HEADERS
from backend.hooks.audit_logging import AuditLoggingHook
from backend.hooks.base import HookContext
from backend.hooks.input_normalization import InputNormalizationHook
from backend.hooks.output_validation import OutputValidationHook
from backend.hooks.policy_enforcement import PolicyEnforcementHook
from backend.models.report import Citation, Competitor, MarketSection

from ._rag import agent_mcp, rag_hint, visible_tools

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are the Market Analysis Agent for Arthvion, a PE due diligence platform.

## Tools available
  - search_web(query, max_results, days_back)         → web search results
  - search_economic_series(query, limit)              → find FRED macro series IDs
  - get_series_observations(series_id, limit)         → recent values for a FRED series

## Process
Run focused web searches to answer these questions:
  1. What is the total addressable market (TAM) size and growth rate for the
     company's primary market(s)?
  2. Who are the top 3–5 competitors and what are their estimated market shares?
  3. What are the main growth drivers (tailwinds) over the next 3–5 years?
  4. What are the main headwinds (threats, substitutes, regulatory pressure)?

Then GROUND your demand/tailwind/headwind assessment in real macro data from
FRED. Use search_economic_series to find an indicator relevant to the company's
sector (e.g. "retail sales", "semiconductor production", "30-year mortgage
rate", "real GDP", "industrial production", "CPI"), then get_series_observations
to read its recent trend. Cite the FRED series in your reasoning — this turns a
qualitative guess into an evidence-backed signal. If FRED is unavailable (its
tools return an "error"), proceed with web data only.

Suggested queries:
  - "<company> total addressable market size <year>"
  - "<company> competitors market share analysis"
  - "<industry> market growth forecast"
  - "<company> industry tailwinds headwinds"

## Output format — ONLY output valid JSON, no markdown fences:
{
  "company": "<string>",
  "market_size_usd": <raw float in USD or null>,
  "market_share": <0.0–1.0 or null>,
  "competitors": [
    {"name": "<string>", "estimated_market_share": <float or null>, "notes": "<string or null>"}
  ],
  "growth_drivers": ["<string>", ...],
  "headwinds": ["<string>", ...],
  "summary": "<3–4 sentence executive market overview>",
  "citations": [{"source": "<string>", "url": "<string or null>", "filing_date": null, "accession_number": null, "excerpt": "<string or null>"}],
  "confidence_score": <0.0–1.0>
}

Rules: market_size_usd must be a raw float (1_200_000_000.0, not "1.2B");
citations must be non-empty.
"""

MAX_ITERATIONS = 8    # safety cap — most runs converge in 2-4


class MarketAgent:
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
        context: str | None = None,
        workspace_id: str | None = None,
    ) -> MarketSection:
        ctx = HookContext(
            agent="market_agent",
            raw_input={"company": company, "ticker": ticker, "context": context},
        )
        for hook in self._hooks_pre:
            ctx = await hook.pre_run(ctx)

        norm = ctx.normalized_input
        user_msg = f"Analyse the market landscape for {norm['company']}"
        if norm.get("ticker"):
            user_msg += f" (ticker: {norm['ticker']})"
        if norm.get("context"):
            user_msg += f"\n\n<analyst_context>\n{norm['context']}\n</analyst_context>"

        final_text = ""

        settings = get_settings()
        async with agent_mcp(
            [settings.web_search_mcp_script, settings.fred_mcp_script],
            {
                "TAVILY_API_KEY": settings.tavily_api_key,
                "FRED_API_KEY": settings.fred_api_key,
            },
            workspace_id=workspace_id,
            settings=settings,
        ) as (mcp, rag_on):
            user_msg += rag_hint(rag_on)
            messages: list[dict[str, Any]] = [{"role": "user", "content": user_msg}]
            tools = visible_tools(mcp, rag_on)

            for _ in range(MAX_ITERATIONS):
                response = await self._client.messages.create(
                    model=self._model,
                    max_tokens=8192,
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
            logger.warning("MarketAgent JSON incomplete — running finalize call")
            try:
                messages.append({"role": "user", "content": "Output ONLY the complete JSON object now. No markdown, no tool calls."})
                fr = await self._client.messages.create(model=self._model, max_tokens=8192, system=cached_system(SYSTEM_PROMPT), extra_headers=PROMPT_CACHE_HEADERS, messages=messages)
                for block in fr.content:
                    if block.type == "text":
                        final_text = block.text; break
            except Exception as fe:
                logger.warning("MarketAgent finalize failed: %s", fe)

        ctx.raw_output = _parse_market_section(final_text, norm["company"])
        for hook in self._hooks_post:
            ctx = await hook.post_run(ctx)
        return ctx.validated_output  # type: ignore[return-value]


def _quick_json_check(text: str) -> None:
    if not text:
        raise ValueError("empty")
    t = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    t = re.sub(r"\s*```$", "", t.strip(), flags=re.MULTILINE)
    start = t.find("{")
    if start == -1:
        raise ValueError("no JSON object")
    json.loads(t[start:])


def _parse_market_section(text: str, company: str) -> MarketSection:
    try:
        text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)
        start = text.find("{")
        if start != -1:
            depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        text = text[start: i + 1]
                        break
        return MarketSection.model_validate(json.loads(text))
    except Exception as exc:
        logger.warning("Could not parse MarketSection JSON: %s", exc)
        return MarketSection(
            company=company,
            summary=f"Market data extraction failed: {exc}",
            citations=[Citation(source=f"{company} — parsing failed", excerpt=text[:500])],
            confidence_score=0.0,
        )
