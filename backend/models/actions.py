"""
Pydantic schemas for the Deal Action Queue.

`GeneratedAction` is the shape Claude returns when it analyzes a report and
proposes next-step diligence tasks. `ActionGenerationResult` wraps the list so
the model can return a single JSON object.
"""
from __future__ import annotations

from pydantic import BaseModel, field_validator

VALID_CATEGORIES = {"financial", "legal", "market", "risk", "management", "operational"}
VALID_PRIORITIES = {"high", "medium", "low"}


class GeneratedAction(BaseModel):
    title: str
    description: str = ""
    category: str = "financial"
    priority: str = "medium"
    rationale: str = ""

    @field_validator("category")
    @classmethod
    def _norm_category(cls, v: str) -> str:
        v = (v or "").strip().lower()
        return v if v in VALID_CATEGORIES else "operational"

    @field_validator("priority")
    @classmethod
    def _norm_priority(cls, v: str) -> str:
        v = (v or "").strip().lower()
        return v if v in VALID_PRIORITIES else "medium"


class ActionGenerationResult(BaseModel):
    actions: list[GeneratedAction] = []
