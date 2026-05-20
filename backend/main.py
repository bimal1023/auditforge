"""AuditForge FastAPI application entry point."""
from __future__ import annotations

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.api.routes import router
from backend.api.auth_routes import router as auth_router
from backend.api.upload_routes import router as upload_router

settings = get_settings()
logging.basicConfig(
    stream=sys.stdout,
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

app = FastAPI(
    title="AuditForge",
    description="Multi-agent PE due diligence platform",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")


@app.on_event("startup")
async def create_tables() -> None:
    from backend.core.database import get_engine
    from backend.models.db import Base
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.3.0"}
