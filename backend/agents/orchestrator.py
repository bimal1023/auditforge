"""
Orchestrator — runs specialist agents sequentially, synthesises results.

Design decisions:
  - Sequential (not parallel) to respect the free-tier 30K input-tokens/min cap.
    Switch to asyncio.gather() once the API tier is upgraded.
  - Per-agent asyncio.wait_for() timeout so one stalled SEC call can't hang
    the entire pipeline indefinitely.
  - Publishes structured Redis events at every stage so the SSE endpoint can
    relay real-time progress to the browser.
  - Fallback sections (confidence_score == 0.0, summary contains "failed") are
    silently discarded — they carry no signal and would pollute the final report.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any
from uuid import UUID

import anthropic

from backend.core.config import get_settings
from backend.core.redis_events import publish
from backend.models.report import DueDiligenceReport, ReportRequest

from .financial_agent import FinancialAgent
from .legal_agent import LegalAgent
from .market_agent import MarketAgent
from .risk_agent import RiskAgent

logger = logging.getLogger(__name__)

SYNTHESIS_PROMPT = """\
You are the Orchestrator for AuditForge, a PE due diligence platform.

Given the specialist agent outputs below, write:
1. A concise executive_summary (3-5 sentences) covering the key findings
   across financial, risk, market, and legal dimensions.
2. An overall_score from 0.0 to 10.0 reflecting investment attractiveness
   (10 = highly attractive, 0 = do not invest).

Output ONLY valid JSON:
{"executive_summary": "<string>", "overall_score": <float>}
"""

_AGENT_LABELS = {
    "financial": "Financial Analysis",
    "risk":      "Risk Analysis",
    "market":    "Market Analysis",
    "legal":     "Legal Analysis",
}


class Orchestrator:
    def __init__(self, report_id: str | None = None) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=settings.anthropic_max_retries,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.orchestrator_model
        self._report_id = report_id
        self._timeout = settings.agent_timeout_seconds or None
        self._inter_delay = settings.agent_inter_delay_seconds

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _emit(self, event_type: str, message: str = "", **extra) -> None:
        if self._report_id:
            publish(self._report_id, event_type, message=message, **extra)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(self, request: ReportRequest) -> DueDiligenceReport:
        report = DueDiligenceReport(
            company=request.company_name,
            ticker=request.ticker,
            status="running",
        )

        self._emit("status", f"Starting due diligence on {request.company_name}…")

        specs: list[tuple[str, Any]] = []
        if "financial" in request.focus_areas:
            specs.append(("financial", FinancialAgent()))
        if "risk" in request.focus_areas:
            specs.append(("risk", RiskAgent()))
        if "market" in request.focus_areas:
            specs.append(("market", MarketAgent()))
        if "legal" in request.focus_areas:
            specs.append(("legal", LegalAgent()))

        for i, (key, agent) in enumerate(specs):
            if i > 0 and self._inter_delay:
                await asyncio.sleep(self._inter_delay)

            label = _AGENT_LABELS.get(key, key)

            # One overload retry per agent — wait 90s then try once more
            for attempt in range(2):
                self._emit("agent_start", f"{label}: fetching data…", agent=key)
                try:
                    coro = agent.run(
                        request.company_name,
                        ticker=request.ticker,
                        context=request.context,
                    )
                    if self._timeout:
                        result = await asyncio.wait_for(coro, timeout=self._timeout)
                    else:
                        result = await coro

                    if _is_fallback(result):
                        logger.warning(
                            "Specialist %s returned a fallback section (confidence=0); discarding",
                            key,
                        )
                        self._emit(
                            "agent_fail",
                            f"{label}: could not extract data from filings",
                            agent=key,
                        )
                    else:
                        setattr(report, key, result)
                        conf = getattr(result, "confidence_score", None)
                        self._emit(
                            "agent_done",
                            f"{label}: complete",
                            agent=key,
                            confidence=round(conf, 2) if conf is not None else None,
                        )
                        logger.info("Specialist %s OK (confidence=%.2f)", key, conf or 0)
                    break  # success or fallback — don't retry

                except asyncio.TimeoutError:
                    logger.warning("Specialist %s timed out after %ds", key, self._timeout)
                    self._emit("agent_fail", f"{label}: timed out", agent=key, reason="timeout")
                    break

                except Exception as exc:
                    if attempt == 0 and _is_overloaded(exc):
                        wait = 90
                        logger.warning("Specialist %s overloaded — retrying in %ds", key, wait)
                        self._emit(
                            "status",
                            f"{label}: API overloaded, retrying in {wait}s…",
                            agent=key,
                        )
                        await asyncio.sleep(wait)
                        # Re-instantiate the agent so MCP connections are fresh
                        agent = type(agent)()
                        continue
                    logger.error("Specialist %s failed: %r", key, exc, exc_info=True)
                    self._emit(
                        "agent_fail",
                        f"{label}: {_friendly_error(exc)}",
                        agent=key,
                        reason=type(exc).__name__,
                    )
                    break

        # ── Synthesis ──────────────────────────────────────────────────────
        self._emit("status", "Synthesising findings…")
        try:
            summary_input = _build_synthesis_input(report)
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=512,
                system=SYNTHESIS_PROMPT,
                messages=[{"role": "user", "content": summary_input}],
            )
            text = resp.content[0].text if resp.content else "{}"
            text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
            text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)
            start, end = text.find("{"), text.rfind("}") + 1
            synthesis = json.loads(text[start:end] if start != -1 else "{}")
            report.executive_summary = synthesis.get("executive_summary")
            report.overall_score = synthesis.get("overall_score")
        except Exception as exc:
            logger.warning("Synthesis failed: %s", exc)

        report.status = "complete"
        return report


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_fallback(section: Any) -> bool:
    """True if the section is a parser fallback with no real data."""
    confidence = getattr(section, "confidence_score", 1.0)
    summary = getattr(section, "summary", "")
    return confidence == 0.0 and "failed" in summary.lower()


def _is_overloaded(exc: Exception) -> bool:
    """True if the exception (or any sub-exception) is a 529 OverloadedError."""
    from anthropic import OverloadedError
    if isinstance(exc, OverloadedError):
        return True
    # anyio wraps the error in an ExceptionGroup on teardown
    if isinstance(exc, BaseExceptionGroup):
        return any(_is_overloaded(e) for e in exc.exceptions)
    return False


def _friendly_error(exc: Exception) -> str:
    """Return a short, user-safe error description without internal details."""
    name = type(exc).__name__
    if _is_overloaded(exc):
        return "API overloaded after retries — partial report"
    if "RateLimit" in name:
        return "rate limit reached — will retry on next run"
    if "Timeout" in name:
        return "request timed out"
    return f"internal error ({name})"


def _build_synthesis_input(report: DueDiligenceReport) -> str:
    parts: list[str] = [f"Company: {report.company}"]
    for key, label in _AGENT_LABELS.items():
        section = getattr(report, key, None)
        if section:
            parts.append(f"{label} summary: {section.summary}")
    return "\n\n".join(parts)
