"""
Orchestrator — runs specialist agents in parallel, synthesises results.

Design decisions:
  - PARALLEL via asyncio.gather(). Requires Anthropic Tier 2+ to avoid 429s;
    on free tier (30K input TPM) you'll see rate-limit errors during bursts.
    To revert to sequential: replace the gather() call with a for-loop and
    raise `agent_inter_delay_seconds` back to 10.
  - Per-agent asyncio.wait_for() timeout so one stalled SEC call can't hang
    the entire pipeline indefinitely.
  - Each agent owns its own overload-retry logic; `_run_one_agent` never
    re-raises, so gather() always completes regardless of partial failures.
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
You are the Orchestrator for Arthvion, a PE due diligence platform.

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
    def __init__(
        self,
        report_id: str | None = None,
        workspace_id: str | None = None,
    ) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=settings.anthropic_max_retries,
            timeout=settings.anthropic_request_timeout,
        )
        self._model = settings.orchestrator_model
        self._report_id = report_id
        # When set, specialist agents can retrieve this workspace's uploaded
        # documents via the pgvector RAG store (scoped server-side). Left None
        # for reports run without a workspace or with no uploaded documents.
        self._workspace_id = workspace_id
        self._timeout = settings.agent_timeout_seconds or None
        # Inter-agent delay is unused now that specialists run in parallel.
        # Kept on Settings for back-compat in case someone reverts to sequential.

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _emit(self, event_type: str, message: str = "", **extra) -> None:
        if self._report_id:
            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, lambda: publish(self._report_id, event_type, message=message, **extra))

    async def _run_one_agent(
        self,
        key: str,
        agent: Any,
        request: ReportRequest,
        report: DueDiligenceReport,
    ) -> None:
        """Run a single specialist agent; mutate `report` on success.

        Owns its own retry-on-overload (one attempt) and timeout logic. Catches
        all exceptions and emits the appropriate Redis event — never re-raises,
        so callers can confidently use asyncio.gather() without exception
        handling at the call site.
        """
        label = _AGENT_LABELS.get(key, key)

        # One overload retry per agent — wait 90s then try once more
        for attempt in range(2):
            self._emit("agent_start", f"{label}: fetching data…", agent=key)
            try:
                coro = agent.run(
                    request.company_name,
                    ticker=request.ticker,
                    context=request.context,
                    workspace_id=self._workspace_id,
                )
                # Per-agent TIMEOUT_SECONDS takes precedence over the global setting,
                # allowing e.g. FinancialAgent to enforce a tighter SLA.
                per_agent_timeout = getattr(agent, "TIMEOUT_SECONDS", None)
                timeout = per_agent_timeout or self._timeout
                if timeout:
                    result = await asyncio.wait_for(coro, timeout=timeout)
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
                return  # success or fallback — don't retry

            except asyncio.TimeoutError:
                logger.warning("Specialist %s timed out after %ds", key, self._timeout)
                self._emit("agent_fail", f"{label}: timed out", agent=key, reason="timeout")
                return

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
                return

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

        # Run all specialist agents concurrently. Each handles its own retries
        # and exceptions internally, so gather() never raises — partial failures
        # show up as missing sections on the report (we discard fallbacks).
        await asyncio.gather(*(
            self._run_one_agent(key, agent, request, report)
            for key, agent in specs
        ))

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
    """True if the exception (or any sub-exception) signals a 529 overload.

    The SDK renamed OverloadedError → APIStatusError(status_code=529) in newer
    releases, so we check the status code rather than the class name.
    """
    try:
        from anthropic import APIStatusError
        if isinstance(exc, APIStatusError) and exc.status_code == 529:
            return True
    except ImportError:
        pass
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
