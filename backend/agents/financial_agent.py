"""
Financial Agent
===============
Uses the SEC EDGAR MCP server to pull 10-K filings and extract structured
financial data (revenue, EBITDA, net income, debt, cash, key ratios).

Hook lifecycle (executed in order):
  InputNormalizationHook.pre_run  → normalise inputs
  PolicyEnforcementHook.pre_run   → block prohibited companies, strip PII
  AuditLoggingHook.pre_run        → log invocation start
  ──── agentic loop ────
  OutputValidationHook.post_run   → verify citations non-empty
  AuditLoggingHook.post_run       → log completion + duration
  PolicyEnforcementHook.post_run  → output-level policy checks
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from typing import Any

import anthropic

from backend.core.config import get_settings
from backend.hooks.base import HookContext
from backend.hooks.audit_logging import AuditLoggingHook
from backend.hooks.input_normalization import InputNormalizationHook
from backend.hooks.output_validation import OutputValidationHook
from backend.hooks.policy_enforcement import PolicyEnforcementHook
from backend.models.report import Citation, FinancialMetric, FinancialSection

from ._mcp_client import MCPClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are the Financial Analysis Agent for AuditForge, a PE due diligence platform.

Your task: analyse a company's SEC filings to extract structured financial data.

## Tools available
You have access to the SEC EDGAR MCP tools:
  - search_company(name)               → find the CIK for a company
  - get_filing_list(cik, form_type)    → list recent 10-K filings
  - get_filing_text(cik, accession_number, section) → extract filing text

## Process
1. Call search_company to find the CIK.
2. Call get_filing_list to get the 3 most recent 10-K filings.
3. For each filing, call get_filing_text with section="Item 7" (MD&A) and
   section="Item 8" (Financial Statements) to extract financial data.
4. Extract: revenue, gross profit, EBITDA, net income, total debt,
   cash & equivalents, and key ratios (P/E, EV/EBITDA, debt/equity, etc.)
   for each available year.
5. All monetary values must be raw floats in USD — never strings like "$1.2B".
6. Every data point must include a citation with the accession_number and
   filing_date from the SEC filing you found it in.

## Output format
When you have collected enough data, output ONLY a valid JSON object matching
this exact schema (no markdown fences, no commentary):

{
  "company": "<string>",
  "ticker": "<string or null>",
  "revenue": [{"value": <float>, "year": <int>, "growth_rate": <float or null>, "citation": {"source": "<string>", "url": "<string>", "filing_date": "<string>", "accession_number": "<string>", "excerpt": "<string>"}}],
  "gross_profit": [...same structure...],
  "ebitda": [...],
  "net_income": [...],
  "total_debt": [...],
  "cash_and_equivalents": [...],
  "key_ratios": {"<ratio_name>": <float>},
  "summary": "<2–3 sentence executive summary of the financial health>",
  "citations": [{"source": "<string>", "url": "<string>", "filing_date": "<string>", "accession_number": "<string>", "excerpt": "<string>"}],
  "confidence_score": <float between 0.0 and 1.0>
}

## Rules
- NEVER fabricate data. If a value is not found in the filing, omit it.
- Monetary values are always raw USD floats (1_200_000_000.0 not "1.2B").
- citations list must not be empty.
- confidence_score: 1.0 = all data found from filings; lower if incomplete.
"""

MAX_ITERATIONS = 12   # safety cap on the agentic loop


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class FinancialAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=settings.anthropic_max_retries,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.specialist_model
        self._mcp_script = settings.sec_edgar_mcp_script

        self._hooks_pre = [
            InputNormalizationHook(),
            PolicyEnforcementHook(),
            AuditLoggingHook(),
        ]
        self._hooks_post = [
            OutputValidationHook(),
            AuditLoggingHook(),
            PolicyEnforcementHook(),
        ]

    async def run(
        self,
        company: str,
        ticker: str | None = None,
        context: str | None = None,
    ) -> FinancialSection:
        """
        Run the financial analysis agentic loop for *company*.

        Returns a validated FinancialSection Pydantic model.
        """
        ctx = HookContext(
            agent="financial_agent",
            raw_input={"company": company, "ticker": ticker, "context": context},
        )

        # ── Pre-run hooks ──────────────────────────────────────────────────
        for hook in self._hooks_pre:
            ctx = await hook.pre_run(ctx)

        norm = ctx.normalized_input
        company_norm: str = norm["company"]
        ticker_norm: str | None = norm.get("ticker")
        context_norm: str | None = norm.get("context")

        # ── Agentic loop ───────────────────────────────────────────────────
        user_msg = f"Analyse the financials for {company_norm}"
        if ticker_norm:
            user_msg += f" (ticker: {ticker_norm})"
        if context_norm:
            user_msg += f"\n\nAdditional context: {context_norm}"

        messages: list[dict[str, Any]] = [{"role": "user", "content": user_msg}]
        final_text: str = ""

        async with MCPClient(
            self._mcp_script,
            extra_env={"SEC_EDGAR_USER_AGENT": get_settings().sec_edgar_user_agent},
        ) as mcp:
            tools = mcp.anthropic_tools()

            for iteration in range(MAX_ITERATIONS):
                response = await self._client.messages.create(
                    model=self._model,
                    max_tokens=8192,
                    system=SYSTEM_PROMPT,
                    tools=tools,
                    messages=messages,
                )

                # Collect any text content
                for block in response.content:
                    if block.type == "text":
                        final_text = block.text

                if response.stop_reason == "end_turn":
                    break

                if response.stop_reason == "tool_use":
                    # Execute every tool call and collect results
                    tool_results: list[dict] = []
                    for block in response.content:
                        if block.type == "tool_use":
                            logger.debug(
                                "Tool call: %s(%s)", block.name, json.dumps(block.input)
                            )
                            ctx.tool_calls.append(
                                {"tool": block.name, "input": block.input}
                            )
                            raw_result = await mcp.call_tool(block.name, block.input)
                            tool_results.append(
                                {
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": raw_result,
                                }
                            )

                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({"role": "user", "content": tool_results})

            else:
                logger.warning(
                    "Financial agent hit MAX_ITERATIONS=%d for %s",
                    MAX_ITERATIONS,
                    company_norm,
                )

        # ── Finalize: force JSON output if loop ended without clean output ──
        raw_json = _extract_json(final_text) if final_text else ""
        try:
            json.loads(raw_json)
        except (json.JSONDecodeError, ValueError):
            logger.warning("JSON incomplete after main loop — running finalize call")
            try:
                messages.append({
                    "role": "user",
                    "content": (
                        "You have gathered enough data. "
                        "Now output ONLY the complete JSON object matching the schema. "
                        "No markdown fences, no commentary, no tool calls."
                    ),
                })
                finalize_resp = await self._client.messages.create(
                    model=self._model,
                    max_tokens=8192,
                    system=SYSTEM_PROMPT,
                    messages=messages,
                )
                for block in finalize_resp.content:
                    if block.type == "text":
                        final_text = block.text
                        break
            except Exception as fe:
                logger.warning("Finalize call failed: %s", fe)

        # ── Parse output ───────────────────────────────────────────────────
        section = _parse_financial_section(final_text, company_norm, ticker_norm)
        ctx.raw_output = section

        # ── Post-run hooks ─────────────────────────────────────────────────
        for hook in self._hooks_post:
            ctx = await hook.post_run(ctx)

        return ctx.validated_output  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Output parser
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> str:
    """Strip markdown fences and extract the first {...} block."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)
    # Find the outermost JSON object
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


def _parse_financial_section(
    text: str,
    company: str,
    ticker: str | None,
) -> FinancialSection:
    """
    Parse the agent's JSON output into a FinancialSection.

    Falls back to a minimal section with a low confidence score if parsing
    fails, so the pipeline never crashes outright.
    """
    try:
        raw_json = _extract_json(text)
        data = json.loads(raw_json)
        return FinancialSection.model_validate(data)
    except Exception as exc:
        logger.warning("Could not parse FinancialSection JSON: %s", exc)
        fallback_citation = Citation(
            source=f"{company} — parsing failed",
            excerpt=text[:500] if text else "No output from agent",
        )
        return FinancialSection(
            company=company,
            ticker=ticker,
            summary=f"Financial data extraction failed: {exc}",
            citations=[fallback_citation],
            confidence_score=0.0,
        )
