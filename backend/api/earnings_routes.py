"""Earnings call analysis — fetch transcripts from FMP, analyze with Claude."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import EarningsAnalysis
from backend.agents._mcp_client import MCPClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/earnings", tags=["earnings"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    ticker: str
    year: int = 2024
    quarter: int = 4


class EarningsResponse(BaseModel):
    id: uuid.UUID
    ticker: str
    company: str
    year: int
    quarter: int
    transcript_date: str | None
    analysis: dict | None
    created_at: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=EarningsResponse)
@limiter.limit("10/minute")
async def analyze_earnings(
    request: Request,
    body: AnalyzeRequest,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> EarningsResponse:
    """Fetch an earnings call transcript and analyze it with Claude."""
    settings = get_settings()
    ticker = body.ticker.upper().strip()

    if not ticker:
        raise HTTPException(400, "Ticker is required.")
    if body.quarter not in (1, 2, 3, 4):
        raise HTTPException(400, "Quarter must be 1–4.")
    if not settings.fmp_api_key:
        raise HTTPException(
            503,
            "Earnings analysis requires an FMP API key. "
            "Get one free at https://financialmodelingprep.com/developer "
            "and add FMP_API_KEY to your infra/.env file.",
        )

    # Step 1: Try transcript first, then fall back to financial data
    transcript_content = ""
    transcript_date = None
    use_financial_fallback = False

    try:
        async with MCPClient(
            settings.earnings_mcp_script,
            extra_env={"FMP_API_KEY": settings.fmp_api_key},
        ) as earnings:
            raw = await earnings.call_tool("get_earnings_transcript", {
                "ticker": ticker,
                "year": body.year,
                "quarter": body.quarter,
            }, max_chars=0)

        transcript_data = json.loads(raw, strict=False)

        if transcript_data.get("restricted") or transcript_data.get("error"):
            use_financial_fallback = True
            logger.info("Transcript restricted for %s, using financial data fallback", ticker)
        else:
            transcript_content = transcript_data.get("content", "")
            transcript_date = transcript_data.get("date")
            if not transcript_content:
                use_financial_fallback = True
    except Exception as exc:
        logger.warning("Transcript fetch failed, using financial fallback: %s", exc)
        use_financial_fallback = True

    # Trim transcript to ~30K chars to stay within token budget
    if transcript_content and len(transcript_content) > 30_000:
        transcript_content = transcript_content[:30_000] + "\n\n[...transcript truncated for analysis...]"

    # Step 2: Fetch financial data (always — supplements transcript or replaces it)
    financial_context_parts = []
    try:
        async with MCPClient(
            settings.earnings_mcp_script,
            extra_env={"FMP_API_KEY": settings.fmp_api_key},
        ) as fmp:
            # Fetch profile
            profile_raw = await fmp.call_tool("get_company_profile", {"ticker": ticker}, max_chars=0)
            profile = json.loads(profile_raw, strict=False)
            if profile and not profile.get("error"):
                financial_context_parts.append(
                    f"## Company Profile\n"
                    f"Name: {profile.get('company_name', ticker)}\n"
                    f"Sector: {profile.get('sector', 'N/A')} | Industry: {profile.get('industry', 'N/A')}\n"
                    f"Market Cap: ${(profile.get('market_cap', 0) or 0) / 1e9:.1f}B\n"
                    f"Employees: {profile.get('employees', 'N/A')}"
                )
    except Exception as exc:
        logger.warning("Profile fetch failed: %s", exc)

    try:
        async with MCPClient(
            settings.earnings_mcp_script,
            extra_env={"FMP_API_KEY": settings.fmp_api_key},
        ) as fmp:
            # Key metrics
            metrics_raw = await fmp.call_tool("get_key_metrics", {"ticker": ticker, "limit": 4}, max_chars=0)
            metrics = json.loads(metrics_raw, strict=False)
            m_list = metrics.get("metrics", [])
            if m_list:
                lines = ["## Key Metrics (Annual)"]
                for m in m_list[:4]:
                    lines.append(
                        f"- {m.get('date', '?')}: P/E={m.get('pe_ratio', 'N/A')}, "
                        f"EV/EBITDA={m.get('ev_to_ebitda', 'N/A')}, ROE={m.get('roe', 'N/A')}, "
                        f"D/E={m.get('debt_to_equity', 'N/A')}"
                    )
                financial_context_parts.append("\n".join(lines))
    except Exception as exc:
        logger.warning("Metrics fetch failed: %s", exc)

    try:
        async with MCPClient(
            settings.earnings_mcp_script,
            extra_env={"FMP_API_KEY": settings.fmp_api_key},
        ) as fmp:
            # Income growth
            growth_raw = await fmp.call_tool("get_income_growth", {"ticker": ticker, "limit": 4}, max_chars=0)
            growth = json.loads(growth_raw, strict=False)
            g_list = growth.get("growth", [])
            if g_list:
                lines = ["## Growth Rates"]
                for g in g_list[:4]:
                    rev_g = g.get("revenue_growth")
                    ni_g = g.get("net_income_growth")
                    lines.append(
                        f"- {g.get('date', '?')}: Revenue growth={f'{rev_g:.1%}' if rev_g is not None else 'N/A'}, "
                        f"Net income growth={f'{ni_g:.1%}' if ni_g is not None else 'N/A'}"
                    )
                financial_context_parts.append("\n".join(lines))
    except Exception as exc:
        logger.warning("Growth fetch failed: %s", exc)

    try:
        async with MCPClient(
            settings.earnings_mcp_script,
            extra_env={"FMP_API_KEY": settings.fmp_api_key},
        ) as fmp:
            # Income statement
            stmt_raw = await fmp.call_tool("get_income_statement", {"ticker": ticker, "limit": 4}, max_chars=0)
            stmt = json.loads(stmt_raw, strict=False)
            s_list = stmt.get("statements", [])
            if s_list:
                lines = ["## Income Statement"]
                for s in s_list[:4]:
                    rev = s.get("revenue") or 0
                    ni = s.get("net_income") or 0
                    lines.append(
                        f"- {s.get('date', '?')}: Revenue=${rev / 1e9:.1f}B, "
                        f"EBITDA=${(s.get('ebitda') or 0) / 1e9:.1f}B, "
                        f"Net Income=${ni / 1e9:.1f}B, EPS=${s.get('eps_diluted', 'N/A')}"
                    )
                financial_context_parts.append("\n".join(lines))
    except Exception as exc:
        logger.warning("Income statement fetch failed: %s", exc)

    financial_context = "\n\n".join(financial_context_parts)

    if not transcript_content and not financial_context:
        raise HTTPException(404, f"No financial data available for {ticker}")

    # Step 3: Analyze with Claude
    if use_financial_fallback:
        system_prompt = (
            "You are a senior equity research analyst. Analyze the financial data "
            "provided for this company and produce a structured earnings/financial analysis.\n\n"
            "## Output format\n"
            "Return ONLY a valid JSON object with these keys:\n"
            "{\n"
            '  "company_name": "string — full company name",\n'
            '  "key_metrics": [\n'
            '    {"metric": "Revenue", "value": "$X.XB", "yoy_change": "+X%", "context": "brief note"}\n'
            "  ],\n"
            '  "guidance": {\n'
            '    "revenue_guidance": "Not available (financial data analysis)",\n'
            '    "eps_guidance": "Not available",\n'
            '    "outlook_tone": "bullish|neutral|cautious|bearish",\n'
            '    "changes_from_prior": "Based on historical trend analysis"\n'
            "  },\n"
            '  "management_tone": {\n'
            '    "overall": "N/A — based on financial data only",\n'
            '    "notable_quotes": [],\n'
            '    "red_flags": ["list any concerning financial trends"],\n'
            '    "positive_signals": ["list any strong financial indicators"]\n'
            "  },\n"
            '  "key_topics": [\n'
            '    {"topic": "string", "summary": "2-3 sentence summary", "sentiment": "positive|neutral|negative"}\n'
            "  ],\n"
            '  "analyst_qa_highlights": [],\n'
            '  "risks_mentioned": ["risk 1", "risk 2"],\n'
            '  "catalysts": ["catalyst 1", "catalyst 2"],\n'
            '  "executive_summary": "3-5 sentence overall takeaway for an investor based on financial trends"\n'
            "}\n\n"
            "## Rules\n"
            "- Analyze all numbers, ratios, and growth trends provided\n"
            "- Identify year-over-year trends (improving/declining)\n"
            "- Flag any concerning metrics (high debt, declining margins, etc.)\n"
            "- Highlight strengths (growing revenue, improving ROE, etc.)\n"
            "- Be specific with actual numbers from the data\n"
            "- Output ONLY the JSON object, no markdown fences, no commentary"
        )
        user_content = (
            f"## Financial Analysis — {ticker} (as of Q{body.quarter} {body.year})\n\n"
            f"Note: Earnings call transcript not available. "
            f"Performing analysis based on financial statements and metrics.\n\n"
            f"{financial_context}"
        )
    else:
        system_prompt = (
            "You are a senior equity research analyst. Analyze this earnings call "
            "transcript and produce a structured analysis.\n\n"
            "## Output format\n"
            "Return ONLY a valid JSON object with these keys:\n"
            "{\n"
            '  "company_name": "string — full company name",\n'
            '  "key_metrics": [\n'
            '    {"metric": "Revenue", "value": "$X.XB", "yoy_change": "+X%", "context": "brief note"}\n'
            "  ],\n"
            '  "guidance": {\n'
            '    "revenue_guidance": "string — next quarter/year revenue guidance",\n'
            '    "eps_guidance": "string — EPS guidance if given",\n'
            '    "outlook_tone": "bullish|neutral|cautious|bearish",\n'
            '    "changes_from_prior": "string — how guidance changed vs last quarter"\n'
            "  },\n"
            '  "management_tone": {\n'
            '    "overall": "confident|neutral|defensive|cautious",\n'
            '    "notable_quotes": ["quote 1", "quote 2"],\n'
            '    "red_flags": ["any concerning language or deflections"],\n'
            '    "positive_signals": ["any strong positive indicators"]\n'
            "  },\n"
            '  "key_topics": [\n'
            '    {"topic": "string", "summary": "2-3 sentence summary", "sentiment": "positive|neutral|negative"}\n'
            "  ],\n"
            '  "analyst_qa_highlights": [\n'
            '    {"analyst": "name/firm if mentioned", "question_topic": "string", '
            '"management_response": "brief summary", "notable": true/false}\n'
            "  ],\n"
            '  "risks_mentioned": ["risk 1", "risk 2"],\n'
            '  "catalysts": ["catalyst 1", "catalyst 2"],\n'
            '  "executive_summary": "3-5 sentence overall takeaway for an investor"\n'
            "}\n\n"
            "## Rules\n"
            "- Extract EVERY specific number, percentage, and dollar figure mentioned\n"
            "- Compare to prior periods when management provides comparisons\n"
            "- Flag any guidance changes, beats, or misses\n"
            "- Note evasive answers in Q&A as red flags\n"
            "- Be precise — investors make decisions based on this\n"
            "- Output ONLY the JSON object, no markdown fences, no commentary"
        )
        user_content = (
            f"## Earnings Call Transcript — {ticker} Q{body.quarter} {body.year}\n\n"
            f"{financial_context}\n\n"
            f"---\n\n## Transcript\n\n{transcript_content}"
        )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.fast_model,
            max_tokens=3000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        answer_text = response.content[0].text
    except Exception as exc:
        logger.error("Claude earnings analysis failed: %s", exc)
        raise HTTPException(502, "Failed to analyze earnings data. Please try again.")

    # Step 4: Parse the JSON response
    analysis: dict = {}
    try:
        # Strip markdown fences if model wrapped it
        clean = answer_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        clean = clean.strip()
        analysis = json.loads(clean, strict=False)
    except json.JSONDecodeError:
        logger.warning("Could not parse earnings analysis as JSON, storing as raw text")
        analysis = {"raw_analysis": answer_text, "parse_error": True}

    company_name = analysis.get("company_name", ticker)

    # Step 5: Persist
    record = EarningsAnalysis(
        user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        ticker=ticker,
        company=company_name,
        year=body.year,
        quarter=body.quarter,
        transcript_date=transcript_date,
        analysis=analysis,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return EarningsResponse(
        id=record.id,
        ticker=record.ticker,
        company=record.company,
        year=record.year,
        quarter=record.quarter,
        transcript_date=record.transcript_date,
        analysis=record.analysis,
        created_at=record.created_at.isoformat(),
    )


@router.get("/history", response_model=list[EarningsResponse])
async def get_earnings_history(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=20, le=50),
) -> list[EarningsResponse]:
    """Return past earnings analyses for the current workspace."""
    result = await db.execute(
        select(EarningsAnalysis)
        .where(EarningsAnalysis.workspace_id == ctx.workspace.id)
        .order_by(EarningsAnalysis.created_at.desc())
        .limit(limit)
    )
    return [
        EarningsResponse(
            id=r.id,
            ticker=r.ticker,
            company=r.company,
            year=r.year,
            quarter=r.quarter,
            transcript_date=r.transcript_date,
            analysis=r.analysis,
            created_at=r.created_at.isoformat(),
        )
        for r in result.scalars().all()
    ]


@router.delete("/{analysis_id}", status_code=204)
async def delete_earnings_analysis(
    analysis_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_session),
) -> None:
    result = await db.execute(
        select(EarningsAnalysis).where(
            EarningsAnalysis.id == analysis_id,
            EarningsAnalysis.workspace_id == ctx.workspace.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Analysis not found")
    await db.delete(record)
    await db.commit()
