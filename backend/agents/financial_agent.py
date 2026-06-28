"""
Financial Agent
===============
Extracts structured financial data (revenue, EBITDA, net income, debt, cash,
key ratios) for a company.

Sources, in order of preference:
  1. SEC EDGAR  — for public companies (10-K / 10-Q filings). High precision,
     auditable accession numbers.
  2. Web search — for private companies (Stripe, OpenAI, SpaceX, etc.) that
     have no SEC filings. Lower precision but better than nothing — pulls from
     news articles, press releases, IPO drafts, leaked metrics.

The agent decides automatically based on whether SEC's `search_company` returns
a CIK. If yes → SEC path. If no → web fallback.

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

import asyncio
import json
import logging
import os
import re
import sys
from datetime import date
from typing import Any

import anthropic

from backend.core.config import get_settings
from backend.agents._prompt_cache import cached_system, PROMPT_CACHE_HEADERS
from backend.hooks.base import HookContext
from backend.hooks.audit_logging import AuditLoggingHook
from backend.hooks.input_normalization import InputNormalizationHook
from backend.hooks.output_validation import OutputValidationHook
from backend.hooks.policy_enforcement import PolicyEnforcementHook
from backend.models.report import Citation, FinancialMetric, FinancialSection

from ._rag import agent_mcp, rag_hint, visible_tools

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a Senior Private Equity Analyst at a top-tier investment firm
(Blackstone / KKR / Silver Lake caliber). You are producing an
institutional-quality Financial Analysis section for a due diligence memo
that will be reviewed by an Investment Committee deciding whether to deploy
$500M–$10B into this company.

Your output must be precise, comprehensive, fully cited, and ready to present
to an IC. Never fabricate data. Never assume — cite or omit.

## Tools available

### SEC EDGAR (primary — use for every public company)
  - search_company(name)                              → find CIK
  - get_company_facts(cik)                             → XBRL structured financials — your PRIMARY quantitative source
  - get_latest_filing(cik, prefer_quarterly)           → most recent 10-K or 10-Q metadata
  - get_recent_8k_filings(cik)                         → recent material-event filings
  - get_filing_text(cik, accession_number, section)    → extract specific sections from a filing

### Web search (supplement + fallback for private companies)
  - web_search(query) → earnings call highlights, analyst coverage, competitive context

## Investigation playbook — 5 tool calls maximum; synthesise as soon as data is complete

### Phase 1 — Quantitative foundation [2 tool calls, 2 turns — always run]
1. `search_company(name)` → CIK.
2. `get_company_facts(cik)` → PRIMARY source. Map every metric directly:
   - Copy `value` as-is (raw USD float). Copy `label` → `period`. Copy `yoy_growth` → `growth_rate` (latest entry only). Set `period_of_report` = `as_of` field.
   - Use ALL metrics: revenue, cost_of_revenue, gross_profit, operating_income, ebitda, net_income, eps_diluted, operating_cash_flow, capital_expenditure, free_cash_flow, dividends_paid, share_repurchases, total_debt, cash_and_equivalents, total_assets, current_assets/liabilities, stockholders_equity.

### Phase 2 — Management commentary [2 tool calls, 2 turns]
3. `get_latest_filing(cik)` → form type + accession_number.
4. `get_filing_text(cik, accession_number, section="Item 7")` for 10-K, or `section="Item 2"` for 10-Q.
   ONE section only — MD&A covers segments, guidance, cost trends, and capital allocation. Do NOT separately fetch Item 1 or Item 1A.

→ After Phase 2: if all required schema fields can be populated from XBRL + MD&A data, skip Phase 3 and go directly to Synthesis.

### Phase 3 — Context [1 turn; call BOTH tools in the SAME turn]
Issue `get_recent_8k_filings` and `web_search` together in one response (the system executes them in parallel):
5a. `get_recent_8k_filings(cik)` — scan descriptions only; read a filing text ONLY if description explicitly says M&A, restructuring, or debt offering. Skip routine earnings 8-Ks.
5b. `web_search("{company} {latest_quarter} earnings analyst outlook revenue guidance")`

### Phase 4 — Synthesis
6. From collected data, compute and populate:
   - `margins`: gross_margin, operating_margin, net_margin, fcf_margin, rnd_intensity, sga_ratio — ALL as decimals (0.52 = 52%)
   - `cash_flow`: operating_cash_flow, capex, fcf, dividends, buybacks, fcf_margin
   - `balance_sheet`: current_ratio (current_assets/current_liabilities), debt_to_equity (total_debt/stockholders_equity), net_debt (total_debt − cash), total_assets, stockholders_equity
   - `segments`: from MD&A segment disclosures — name, revenue, operating_income, margin, growth_rate
   - `capital_allocation`: 2-3 sentence narrative on FCF deployment (buybacks vs dividends vs capex vs M&A)
   - `management_notes`: exec comp, insider activity, material 8-K events, credibility assessment
   - `investment_highlights`: 3-5 bullets — strongest reasons an IC would approve this investment
   - `key_concerns`: 3-5 bullets — what could go wrong (concentration, margin pressure, leverage, cyclicality)
   - `summary`: 3-4 sentences — period, headline numbers, trajectory, and investment thesis
8. Output ONLY a valid JSON object matching the schema below.

### Fallback: private companies (no SEC filings)
If `search_company` returns no CIK:
1. `web_search` for revenue, valuation, funding rounds, press releases.
2. Fill what you can, set `filing_type` = "web", lower `confidence_score`.

## Output schema

Output ONLY a valid JSON object (no markdown fences, no commentary):

{
  "company": "<string>",
  "ticker": "<string or null>",
  "period_of_report": "<ISO date — e.g. 2026-03-31>",
  "filing_type": "<10-K | 10-Q | web>",

  "revenue": [{"value": <float>, "year": <int>, "period": "<label from XBRL>", "growth_rate": <float|null>, "citation": {"source":"...", "url":"...", "filing_date":"...", "accession_number":"...", "excerpt":"..."}}],
  "cost_of_revenue": [...same...],
  "gross_profit": [...],
  "operating_income": [...],
  "ebitda": [...],
  "net_income": [...],
  "eps_diluted": [...],
  "total_debt": [...],
  "cash_and_equivalents": [...],

  "segments": [{"name":"<string>", "revenue":<float|null>, "operating_income":<float|null>, "margin":<float|null>, "growth_rate":<float|null>, "notes":"<string|null>"}],

  "cash_flow": {
    "operating_cash_flow": <float|null>,
    "capital_expenditure": <float|null>,
    "free_cash_flow": <float|null>,
    "dividends_paid": <float|null>,
    "share_repurchases": <float|null>,
    "fcf_margin": <float|null>,
    "period": "<label>",
    "citation": {...}
  },

  "balance_sheet": {
    "current_ratio": <float|null>,
    "debt_to_equity": <float|null>,
    "net_debt": <float|null>,
    "interest_coverage": <float|null>,
    "total_assets": <float|null>,
    "stockholders_equity": <float|null>,
    "period": "<label>",
    "citation": {...}
  },

  "margins": {
    "gross_margin": <float|null>,
    "operating_margin": <float|null>,
    "net_margin": <float|null>,
    "fcf_margin": <float|null>,
    "rnd_intensity": <float|null>,
    "sga_ratio": <float|null>,
    "period": "<label>"
  },

  "capital_allocation": "<2-3 sentence narrative on how management deploys capital>",
  "management_notes": "<exec comp, insider activity, 8-K material events>",
  "investment_highlights": ["<bullet 1>", "<bullet 2>", "..."],
  "key_concerns": ["<bullet 1>", "<bullet 2>", "..."],

  "key_ratios": {"<metric>_<YYYY>_<q1|q2|q3|q4>": <float>, ...},
  "summary": "<3-4 sentence IC-grade summary stating period, headline numbers, trajectory, thesis>",
  "citations": [{...}],
  "confidence_score": <0.0–1.0>
}

## Rules
- NEVER fabricate data. If a value is not found, omit the field — do not guess.
- ALWAYS use the most recent filing. Do not stop at 10-K if a newer 10-Q exists.
- NEVER mix period lengths. Quarter vs full-year in one array is invalid.
- Monetary values: raw USD floats (1_200_000_000.0 not "1.2B").
- Margins and ratios: decimals (0.52 = 52%). Do not multiply by 100.
- key_ratios keys MUST include a period suffix: `_YYYY_qN` for quarterly or
  `_YYYY` for annual data. Examples:
    "revenue_growth_yoy_2026_q1": 0.121
    "gross_margin_2026_q1": 0.127
    "current_ratio_2026_q1": 1.36
    "roe_2025": 0.11
  This tells analysts exactly which period each ratio covers.
- `period_of_report`: the actual filing period end, not today's date.
- Citations: at least one required. For web sources, accession_number can be "".
- confidence_score: 1.0 = full SEC with 8-K + earnings; 0.8 = SEC only;
  0.6 = partial SEC; 0.3–0.5 = web only; below 0.3 = decline.
- investment_highlights and key_concerns: 3-5 bullets each, always populated.
  An IC will not approve a memo with no risk section.
"""

MAX_ITERATIONS = 10  # 6 planned tool calls + 4 buffer; hard cap via TIMEOUT_SECONDS


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class FinancialAgent:
    TIMEOUT_SECONDS = 180  # hard cap per agent run (seconds)

    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            # Global setting (8) causes 60s+ exponential backoff on rate limits.
            # Keep low: we have a hard timeout anyway, and a fast failure is better
            # than a long retry spiral that kills the whole agent run.
            max_retries=2,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.specialist_model

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
        workspace_id: str | None = None,
    ) -> FinancialSection:
        """
        Run the financial analysis agentic loop for *company*.

        When *workspace_id* is provided and the workspace has uploaded
        documents, the agent can additionally `similarity_search` the firm's
        private data-room files (scoped to that workspace).

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
        today = date.today().isoformat()
        user_msg = (
            f"Today's date: {today}. "
            f"Analyse the financials for {company_norm} using the most recent SEC filing available. "
            f"If a 10-Q was filed after the latest 10-K, use the 10-Q as the primary source."
        )
        if ticker_norm:
            user_msg += f" Ticker: {ticker_norm}."
        if context_norm:
            user_msg += f"\n\n<analyst_context>\n{context_norm}\n</analyst_context>"

        final_text: str = ""

        settings = get_settings()
        async with agent_mcp(
            [
                settings.sec_edgar_mcp_script,
                settings.web_search_mcp_script,
            ],
            {
                "SEC_EDGAR_USER_AGENT": settings.sec_edgar_user_agent,
                "TAVILY_API_KEY": settings.tavily_api_key,
            },
            workspace_id=workspace_id,
            settings=settings,
        ) as (mcp, rag_on):
            user_msg += rag_hint(rag_on)
            messages: list[dict[str, Any]] = [{"role": "user", "content": user_msg}]
            tools = visible_tools(mcp, rag_on)

            for iteration in range(MAX_ITERATIONS):
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
                    # Append so the finalize path has a valid assistant turn to
                    # anchor on — prevents two consecutive user messages if the
                    # JSON in final_text turns out to be malformed.
                    messages.append({"role": "assistant", "content": response.content})
                    break

                if response.stop_reason == "tool_use":
                    tool_blocks = [b for b in response.content if b.type == "tool_use"]
                    for b in tool_blocks:
                        logger.debug("Tool call: %s(%s)", b.name, json.dumps(b.input))
                        ctx.tool_calls.append({"tool": b.name, "input": b.input})

                    # Execute all tool calls in parallel (was sequential)
                    raw_results = await asyncio.gather(
                        *[mcp.call_tool(b.name, b.input) for b in tool_blocks],
                        return_exceptions=True,
                    )
                    tool_results: list[dict] = [
                        {
                            "type": "tool_result",
                            "tool_use_id": b.id,
                            "content": (
                                res if not isinstance(res, Exception)
                                else json.dumps({"error": str(res)})
                            ),
                        }
                        for b, res in zip(tool_blocks, raw_results)
                    ]

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
                # Anthropic requires strictly alternating user/assistant messages.
                # Two cases need bridging:
                #   1. end_turn: we now append the response before breaking, so
                #      messages ends with assistant — just add the user finalize msg.
                #   2. MAX_ITERATIONS hit on a tool_use turn: messages ends with
                #      the user tool_results block — insert a bridging assistant msg.
                if messages and messages[-1].get("role") == "user":
                    messages.append({
                        "role": "assistant",
                        "content": [{"type": "text", "text": "I have collected all available data. Synthesising the final JSON output now."}],
                    })
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
                    system=cached_system(SYSTEM_PROMPT),
                    extra_headers=PROMPT_CACHE_HEADERS,
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
