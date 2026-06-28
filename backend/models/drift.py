"""Pydantic schemas for the lightweight drift-check agent output."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class DriftChange(BaseModel):
    category: str
    title: str
    description: str
    severity: str
    source: str


class DriftCheckResult(BaseModel):
    company: str
    ticker: Optional[str] = None
    has_material_change: bool
    changes: list[DriftChange] = []
    summary: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    checked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
