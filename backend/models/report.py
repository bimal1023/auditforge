"""
Pydantic schemas for the full due diligence report and each specialist section.

Rules enforced here:
- Monetary values are raw floats in USD (never strings).
- Every section requires at least one Citation.
- confidence_score is 0.0–1.0.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


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
    growth_rate: Optional[float] = None  # YoY as decimal, e.g. 0.12 = 12 %
    citation: Citation


# ---------------------------------------------------------------------------
# Specialist section schemas
# ---------------------------------------------------------------------------

class FinancialSection(BaseModel):
    company: str
    ticker: Optional[str] = None
    revenue: list[FinancialMetric] = []
    gross_profit: list[FinancialMetric] = []
    ebitda: list[FinancialMetric] = []
    net_income: list[FinancialMetric] = []
    total_debt: list[FinancialMetric] = []
    cash_and_equivalents: list[FinancialMetric] = []
    key_ratios: dict[str, float] = Field(default_factory=dict)
    summary: str
    citations: list[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("citations")
    @classmethod
    def require_citations(cls, v: list[Citation]) -> list[Citation]:
        if not v:
            raise ValueError("FinancialSection must have at least one citation")
        return v


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

class ReportRequest(BaseModel):
    company_name: str
    ticker: Optional[str] = None
    focus_areas: list[str] = ["financial", "risk", "market", "legal"]
    context: Optional[str] = None   # any extra PE context to pass to agents
    force_refresh: bool = False     # bypass response cache and run fresh agents


class ReportStatusResponse(BaseModel):
    id: UUID
    status: str
    company: str
    ticker: Optional[str] = None
    overall_score: Optional[float] = None
    generated_at: Optional[datetime] = None
