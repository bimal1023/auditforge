"""
Deal Action Queue generator.

Takes a completed due-diligence report and asks Claude (fast model) to produce
a prioritized list of concrete next-step diligence actions, each tied to a
specific finding. This is the "execution-centric" layer: instead of just
surfacing findings, we tell the deal team exactly what to do next.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic

from backend.core.config import get_settings
from backend.models.actions import ActionGenerationResult, GeneratedAction

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a senior PE due-diligence lead. You are handed a completed diligence
report on a target company. Your job is to produce a prioritized ACTION LIST —
the concrete next steps the deal team should take before progressing the deal.

These are NOT summaries. Each action is a specific, assignable task. Good
examples:
  - "Request audited bank statements for FY2023–FY2024 to verify reported cash"
  - "Ask management to explain the 14% gross-margin decline in the most recent year"
  - "Obtain IP assignment agreements for all key engineering hires"
  - "Commission a third-party market-sizing study to validate the TAM claim"
  - "Review the pending class-action docket for settlement exposure estimates"

## Output format — output ONLY a valid JSON object, no markdown fences:
{
  "actions": [
    {
      "title": "<short imperative task, <90 chars>",
      "description": "<1-2 sentences: what to do and what to look for>",
      "category": "<financial | legal | market | risk | management | operational>",
      "priority": "<high | medium | low>",
      "rationale": "<why this matters — reference the specific finding it comes from>"
    }
  ]
}

## Rules
- Produce 5 to 12 actions. Quality over quantity.
- Every action must trace to something in the report — cite the finding in the rationale.
- "high" priority = could kill the deal or materially change valuation.
- Be specific and concrete. No generic advice like "review financials".
- Spread across categories where the report supports it; don't force it.
- Output ONLY the JSON object.
"""


def _build_context(data: dict) -> str:
    """Condense a report's data dict into a compact context block for Claude."""
    parts: list[str] = []
    company = data.get("company", "the company")
    ticker = data.get("ticker")
    parts.append(f"Company: {company}" + (f" ({ticker})" if ticker else ""))
    if data.get("overall_score") is not None:
        parts.append(f"Overall diligence score: {data['overall_score']}/10")
    if data.get("executive_summary"):
        parts.append(f"\nExecutive summary:\n{data['executive_summary']}")

    fin = data.get("financial")
    if isinstance(fin, dict):
        parts.append(f"\n## Financial\n{fin.get('summary', '')}")
        ratios = fin.get("key_ratios") or {}
        if ratios:
            ratio_str = ", ".join(f"{k}={v}" for k, v in list(ratios.items())[:10])
            parts.append(f"Key ratios: {ratio_str}")

    risk = data.get("risk")
    if isinstance(risk, dict):
        parts.append(f"\n## Risk\n{risk.get('summary', '')}")
        for r in (risk.get("risks") or [])[:10]:
            parts.append(f"- [{r.get('severity', '?')}] {r.get('title', '')}: {r.get('description', '')}")

    market = data.get("market")
    if isinstance(market, dict):
        parts.append(f"\n## Market\n{market.get('summary', '')}")
        drivers = market.get("growth_drivers") or []
        headwinds = market.get("headwinds") or []
        if drivers:
            parts.append("Growth drivers: " + "; ".join(drivers[:5]))
        if headwinds:
            parts.append("Headwinds: " + "; ".join(headwinds[:5]))

    legal = data.get("legal")
    if isinstance(legal, dict):
        parts.append(f"\n## Legal\n{legal.get('summary', '')}")
        for lit in (legal.get("litigations") or [])[:6]:
            parts.append(f"- Litigation: {lit.get('case_name', '')} ({lit.get('status', '')}) — {lit.get('description', '')}")
        for reg in (legal.get("regulatory_issues") or [])[:6]:
            if isinstance(reg, dict):
                parts.append(f"- Regulatory: {reg.get('description', '')} ({reg.get('status', '')})")

    return "\n".join(parts)[:8000]


def _parse(text: str) -> ActionGenerationResult:
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
                        text = text[start : i + 1]
                        break
        return ActionGenerationResult.model_validate(json.loads(text, strict=False))
    except Exception as exc:
        logger.warning("Could not parse action generation JSON: %s", exc)
        return ActionGenerationResult(actions=[])


async def generate_actions(report_data: dict) -> list[GeneratedAction]:
    """Generate a prioritized action list from a completed report's data dict."""
    settings = get_settings()
    context = _build_context(report_data)

    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        max_retries=settings.anthropic_max_retries,
        timeout=settings.anthropic_request_timeout,
    )
    response = await client.messages.create(
        model=settings.fast_model,
        max_tokens=2500,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Produce the diligence action list for this report:\n\n{context}",
        }],
    )
    text = response.content[0].text if response.content else ""
    result = _parse(text)
    return result.actions
