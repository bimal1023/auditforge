"""
Pydantic schemas for the full due diligence report and each specialist section.

Rules enforced here:
- Monetary values are raw floats in USD (never strings).
- Every section requires at least one Citation.
- confidence_score is 0.0–1.0.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

import logging as _logging
from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Shared primitives
# ---------------------------------------------------------------------------

class Citation(BaseModel):
    source: str                          # e.g. "AAPL 10-K 2024"
    url: Optional[str] = None
    filing_date: Optional[str] = None   # ISO date string
    accession_number: Optional[str] = None
    excerpt: Optional[str] = None       # ≤ 500 chars of supporting text


class FinancialMetric(BaseModel):
    value: float                         # raw USD
    year: int
    period: Optional[str] = None         # e.g. "Q1 FY2026" or "FY2025" — what window value covers
    growth_rate: Optional[float] = None  # YoY as decimal, e.g. 0.12 = 12 %
    citation: Optional[Citation] = None  # optional: missing citation ≠ invalid metric


# ---------------------------------------------------------------------------
# Specialist section schemas
# ---------------------------------------------------------------------------

# ── Structured sub-sections for PE-grade analysis ─────────────────────────

class SegmentBreakdown(BaseModel):
    """Single business segment (e.g. iPhone, AWS, Google Cloud)."""
    name: str
    revenue: Optional[float] = None         # raw USD, latest period
    operating_income: Optional[float] = None
    margin: Optional[float] = None          # operating margin, 0.0–1.0
    growth_rate: Optional[float] = None     # YoY, decimal
    notes: Optional[str] = None


class CashFlowAnalysis(BaseModel):
    """Capital deployment for the latest period."""
    operating_cash_flow: Optional[float] = None
    capital_expenditure: Optional[float] = None
    free_cash_flow: Optional[float] = None
    dividends_paid: Optional[float] = None
    share_repurchases: Optional[float] = None
    fcf_margin: Optional[float] = None      # FCF / revenue
    period: Optional[str] = None            # e.g. "Qtr ended Mar 2026"
    citation: Optional[Citation] = None


class BalanceSheetHealth(BaseModel):
    """Liquidity and leverage snapshot."""
    current_ratio: Optional[float] = None   # current assets / current liabilities
    debt_to_equity: Optional[float] = None  # total debt / stockholders equity
    net_debt: Optional[float] = None        # total debt − cash
    interest_coverage: Optional[float] = None  # EBITDA / interest expense
    total_assets: Optional[float] = None
    stockholders_equity: Optional[float] = None
    period: Optional[str] = None
    citation: Optional[Citation] = None


class MarginAnalysis(BaseModel):
    """Margin bridge — all as decimals (0.52 = 52%)."""
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    fcf_margin: Optional[float] = None
    rnd_intensity: Optional[float] = None   # R&D / revenue
    sga_ratio: Optional[float] = None       # SG&A / revenue
    period: Optional[str] = None


class FinancialSection(BaseModel):
    company: str
    ticker: Optional[str] = None
    period_of_report: Optional[str] = None     # e.g. "2026-03-28"
    filing_type: Optional[str] = None          # "10-K" | "10-Q" | "web"

    # ── Core metrics (kept for table display) ─────────────────────────────
    revenue: list[FinancialMetric] = []
    cost_of_revenue: list[FinancialMetric] = []
    gross_profit: list[FinancialMetric] = []
    operating_income: list[FinancialMetric] = []
    ebitda: list[FinancialMetric] = []
    net_income: list[FinancialMetric] = []
    eps_diluted: list[FinancialMetric] = []
    total_debt: list[FinancialMetric] = []
    cash_and_equivalents: list[FinancialMetric] = []

    # ── PE-grade sub-sections ─────────────────────────────────────────────
    segments: list[SegmentBreakdown] = []
    cash_flow: Optional[CashFlowAnalysis] = None
    balance_sheet: Optional[BalanceSheetHealth] = None
    margins: Optional[MarginAnalysis] = None
    capital_allocation: Optional[str] = None    # narrative
    management_notes: Optional[str] = None      # comp alignment, insider activity
    investment_highlights: list[str] = []        # 3-5 bullets: why invest
    key_concerns: list[str] = []                 # 3-5 bullets: what could go wrong

    key_ratios: dict[str, float] = Field(default_factory=dict)
    summary: str
    citations: list[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def drop_invalid_metrics(cls, values: Any) -> Any:
        """Drop individual metrics that can't be parsed rather than failing the section.

        The model occasionally outputs a null value or a string where a float is
        expected. Dropping the bad entry keeps the rest of the metrics usable —
        losing one data point is vastly better than losing the whole section.
        """
        _metric_fields = (
            "revenue", "cost_of_revenue", "gross_profit", "operating_income",
            "ebitda", "net_income", "eps_diluted", "total_debt", "cash_and_equivalents",
        )
        _log = _logging.getLogger(__name__)
        for field in _metric_fields:
            items = values.get(field) if isinstance(values, dict) else None
            if not isinstance(items, list):
                continue
            good: list = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                try:
                    float(item.get("value", None))  # type: ignore[arg-type]
                    int(item.get("year", None))      # type: ignore[arg-type]
                    good.append(item)
                except (TypeError, ValueError):
                    _log.debug("Dropping invalid metric in %s: %r", field, item)
            if isinstance(values, dict):
                values[field] = good
        return values

    @field_validator("citations")
    @classmethod
    def require_citations(cls, v: list[Citation]) -> list[Citation]:
        if not v:
            raise ValueError("FinancialSection must have at least one citation")
        return v

    @field_validator("key_ratios", mode="before")
    @classmethod
    def drop_unknown_ratios(cls, v: Any) -> dict[str, float]:
        """Keep only numeric ratio values; silently drop the rest.

        The model frequently emits a ratio key with a `null` value (or "N/A")
        for figures it couldn't determine — extremely common for private
        companies with no SEC filings. The field is typed `dict[str, float]`,
        so a single null used to raise a ValidationError and sink the ENTIRE
        financial section (it fell back to confidence=0.0 → discarded → "could
        not extract data" in the UI). A null ratio carries no signal, so we drop
        it and keep every real number instead of losing the whole report.
        """
        if not isinstance(v, dict):
            return {}
        cleaned: dict[str, float] = {}
        for key, val in v.items():
            if val is None:
                continue
            try:
                cleaned[str(key)] = float(val)
            except (TypeError, ValueError):
                continue  # non-numeric ("N/A", "", etc.) — drop it
        return cleaned


class RiskFactor(BaseModel):
    title: str
    description: str
    severity: str   # "high" | "medium" | "low"
    citation: Citation


class RiskSection(BaseModel):
    company: str
    risks: list[RiskFactor] = []
    summary: str
    citations: list[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("citations")
    @classmethod
    def require_citations(cls, v: list[Citation]) -> list[Citation]:
        if not v:
            raise ValueError("RiskSection must have at least one citation")
        return v


class Competitor(BaseModel):
    name: str
    estimated_market_share: Optional[float] = None  # 0.0–1.0
    notes: Optional[str] = None


class MarketSection(BaseModel):
    company: str
    market_size_usd: Optional[float] = None   # TAM in raw USD
    market_share: Optional[float] = None       # 0.0–1.0
    competitors: list[Competitor] = []
    growth_drivers: list[str] = []
    headwinds: list[str] = []
    summary: str
    citations: list[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("citations")
    @classmethod
    def require_citations(cls, v: list[Citation]) -> list[Citation]:
        if not v:
            raise ValueError("MarketSection must have at least one citation")
        return v


class LitigationItem(BaseModel):
    case_name: str
    status: str
    potential_liability_usd: Optional[float] = None
    description: str
    citation: Citation


class LegalSection(BaseModel):
    company: str
    litigations: list[LitigationItem] = []
    regulatory_issues: list[dict] = []
    summary: str
    citations: list[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("citations")
    @classmethod
    def require_citations(cls, v: list[Citation]) -> list[Citation]:
        if not v:
            raise ValueError("LegalSection must have at least one citation")
        return v


# ---------------------------------------------------------------------------
# Top-level report
# ---------------------------------------------------------------------------

class DueDiligenceReport(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    company: str
    ticker: Optional[str] = None
    financial: Optional[FinancialSection] = None
    risk: Optional[RiskSection] = None
    market: Optional[MarketSection] = None
    legal: Optional[LegalSection] = None
    executive_summary: Optional[str] = None
    overall_score: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"   # "pending" | "running" | "complete" | "error"
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# API request/response
# ---------------------------------------------------------------------------

_VALID_FOCUS_AREAS = {"financial", "risk", "market", "legal"}


class ReportRequest(BaseModel):
    company_name: str = Field(..., min_length=1)
    ticker: Optional[str] = None
    focus_areas: list[str] = ["financial", "risk", "market", "legal"]
    context: Optional[str] = None   # any extra PE context to pass to agents
    force_refresh: bool = False     # bypass response cache and run fresh agents

    @field_validator("focus_areas")
    @classmethod
    def _validate_focus_areas(cls, v: list[str]) -> list[str]:
        bad = set(v) - _VALID_FOCUS_AREAS
        if bad:
            raise ValueError(f"Unknown focus areas: {bad}. Valid values: {_VALID_FOCUS_AREAS}")
        if not v:
            raise ValueError("focus_areas must contain at least one area")
        return v


class ReportStatusResponse(BaseModel):
    id: UUID
    status: str
    company: str
    ticker: Optional[str] = None
    overall_score: Optional[float] = None
    generated_at: Optional[datetime] = None
