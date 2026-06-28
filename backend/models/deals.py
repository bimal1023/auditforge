"""Deal Stage Pipeline — stage constants and request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel

# Ordered funnel. The first five are active stages; the last two are terminal.
PIPELINE_STAGES: list[str] = [
    "sourced",
    "screening",
    "diligence",
    "ic_review",
    "closing",
    "won",
    "passed",
]
VALID_STAGES = set(PIPELINE_STAGES)
VALID_CONVICTION = {"high", "medium", "low"}


class CreateDealRequest(BaseModel):
    company: str
    ticker: str | None = None
    report_id: str | None = None
    stage: str = "sourced"
    deal_size_usd: float | None = None
    conviction: str | None = None
    notes: str = ""


class UpdateDealRequest(BaseModel):
    company: str | None = None
    ticker: str | None = None
    report_id: str | None = None
    stage: str | None = None
    position: int | None = None
    deal_size_usd: float | None = None
    conviction: str | None = None
    notes: str | None = None


class DealOut(BaseModel):
    id: str
    company: str
    ticker: str | None
    report_id: str | None
    # Status of the linked report, surfaced so the pipeline card can render
    # Deep Dive running/ready state without any client-side memory:
    # null (no report) | "pending" | "running" | "complete" | "error".
    report_status: str | None = None
    stage: str
    position: int
    deal_size_usd: float | None
    conviction: str | None
    notes: str
    stage_updated_at: str
    created_at: str
    updated_at: str
