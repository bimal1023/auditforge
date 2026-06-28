"""Pydantic request/response schemas for the comments API."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateCommentRequest(BaseModel):
    target_type: str = Field(..., pattern=r"^(report|deal)$")
    target_id: UUID
    body: str = Field(..., min_length=1, max_length=10000)


class UpdateCommentRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)


class CommentOut(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    user_name: str | None
    target_type: str
    target_id: UUID
    body: str
    mentions: list[str]
    edited_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
