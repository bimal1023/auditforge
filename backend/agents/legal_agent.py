"""
Legal Agent
===========
Surfaces material litigation, regulatory proceedings, and IP disputes.
Uses two MCP servers:
  - SEC EDGAR  → Item 3 (Legal Proceedings) from the latest 10-K
  - web-search → recent court filings, DOJ/FTC/SEC enforcement actions
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
from backend.models.report import Citation, LegalSection

from ._mcp_client import MultiMCPClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are the Legal Analysis Agent for AuditForge, a PE due diligence platform.

## Tools available
  - search_company(name)                              → find CIK
  - get_filing_list(cik, form_type)                   → recent filings
  - get_filing_text(cik, accession_number, section)   → filing text
  - search_web(query, max_results, days_back)         → recent news

## Process
1. Find CIK via search_company.
2. Get the latest 10-K via get_filing_list.
3. Extract Item 3 (Legal Proceedings) via get_filing_text with section="Item 3".
4. Run targeted web searches for recent developments:
   - "<company> lawsuit settlement <current year>"
   - "<company> DOJ FTC SEC investigation"
   - "<company> regulatory fine penalty"
5. Identify all material litigations and regulatory issues.

## Output format — ONLY output valid JSON, no markdown fences:
{
  "company": "<string>",
  "litigations": [
    {
      "case_name": "<string>",
      "status": "pending|settled|dismissed|ongoing",
      "potential_liability_usd": <raw float or null>,
      "description": "<1–2 sentences>",
      "citation": {
        "source": "<string>",
        "url": "<string or null>",
        "filing_date": "<string or null>",
        "accession_number": "<string or null>",
        "excerpt": "<string or null>"
      }
    }
  ],
  "regulatory_issues": [
    {
      "agency": "<string>",
      "description": "<string>",
      "status": "<string>",
      "potential_fine_usd": <raw float or null>
    }
  ],
  "summary": "<3–4 sentence executive legal overview>",
  "citations": [{"source": "...", "url": "...", "filing_date": "...", "accession_number": "...", "excerpt": "..."}],
  "confidence_score": <0.0–1.0>
}

Rules: potential_liability_usd must be a raw float in USD or null;
citations must be non-empty; never fabricate case names.
"""

MAX_ITERATIONS = 14


class LegalAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=settings.anthropic_max_retries,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.specialist_model
        self._hooks_pre = [InputNormalizationHook(), PolicyEnforcementHook(), AuditLoggingHook()]
        self._hooks_post = [OutputValidationHook(), AuditLoggingHook(), PolicyEnforcementHook()]

    async def run(
        self,
        company: str,
        ticker: str | None = None,
        context: str | None = None,
    ) -> LegalSection:
        ctx = HookContext(
            agent="legal_agent",
            raw_input={"company": company, "ticker": ticker, "context": context},
        )
        for hook in self._hooks_pre:
            ctx = await hook.pre_run(ctx)

        norm = ctx.normalized_input
        user_msg = f"Analyse the legal and regulatory exposure for {norm['company']}"
        if norm.get("ticker"):
            user_msg += f" (ticker: {norm['ticker']})"
        if norm.get("context"):
            user_msg += f"\n\n<analyst_context>\n{norm['context']}\n</analyst_context>"

        messages: list[dict[str, Any]] = [{"role": "user", "content": user_msg}]
        final_text = ""

        settings = get_settings()
        async with MultiMCPClient(
            settings.sec_edgar_mcp_script,
            settings.web_search_mcp_script,
            extra_env={
                "SEC_EDGAR_USER_AGENT": settings.sec_edgar_user_agent,
                "TAVILY_API_KEY": settings.tavily_api_key,
            },
        ) as mcp:
            tools = mcp.anthropic_tools()

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
            logger.warning("LegalAgent JSON incomplete — running finalize call")
            try:
                messages.append({"role": "user", "content": "Output ONLY the complete JSON object now. No markdown, no tool calls."})
                fr = await self._client.messages.create(model=self._model, max_tokens=8192, system=cached_system(SYSTEM_PROMPT), messages=messages)
                for block in fr.content:
                    if block.type == "text":
                        final_text = block.text; break
            except Exception as fe:
                logger.warning("LegalAgent finalize failed: %s", fe)

        ctx.raw_output = _parse_legal_section(final_text, norm["company"])
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


def _parse_legal_section(text: str, company: str) -> LegalSection:
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
        return LegalSection.model_validate(json.loads(text))
    except Exception as exc:
        logger.warning("Could not parse LegalSection JSON: %s", exc)
        return LegalSection(
            company=company,
            summary=f"Legal data extraction failed: {exc}",
            citations=[Citation(source=f"{company} — parsing failed", excerpt=text[:500])],
            confidence_score=0.0,
        )
