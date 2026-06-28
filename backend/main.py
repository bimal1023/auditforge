"""Arthvion FastAPI application entry point."""
from __future__ import annotations

import logging
import sys

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import get_settings
from backend.core.rate_limit import limiter
from backend.api.routes import router
from backend.api.auth_routes import router as auth_router
from backend.api.upload_routes import router as upload_router
from backend.api.billing_routes import router as billing_router
from backend.api.watchlist_routes import router as watchlist_router
from backend.api.actions_routes import router as actions_router
from backend.api.deals_routes import router as deals_router
from backend.api.qa_routes import router as qa_router
from backend.api.report_chat_routes import router as report_chat_router
from backend.api.earnings_routes import router as earnings_router
from backend.api.comps_routes import router as comps_router
from backend.api.screener_routes import router as screener_router
from backend.api.team_routes import router as team_router
from backend.api.comments_routes import router as comments_router
from backend.api.activity_routes import router as activity_router
from backend.api.notifications_routes import router as notifications_router

settings = get_settings()
logging.basicConfig(
    stream=sys.stdout,
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if settings.environment != "development":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text
    from backend.core.database import get_engine
    from backend.models.db import Base
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # ── Idempotent in-place migrations for existing databases ────────────
        # `Base.metadata.create_all` only CREATEs tables that don't exist; it
        # never ALTERs them. So when we add new columns to existing models we
        # need to ADD COLUMN IF NOT EXISTS here. Postgres-only syntax (we don't
        # support SQLite in prod). Drop these after a proper Alembic setup.
        await conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS memo_credits INTEGER NOT NULL DEFAULT 3, "
            "ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) NOT NULL DEFAULT 'solo', "
            "ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE, "
            "ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE, "
            "ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64), "
            "ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(64), "
            "ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32), "
            "ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE, "
            "ADD COLUMN IF NOT EXISTS full_name VARCHAR(100), "
            "ADD COLUMN IF NOT EXISTS active_workspace_id UUID"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx "
            "ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL"
        ))

        # ── Workspace columns on data tables ─────────────────────────────────
        await conn.execute(text(
            "ALTER TABLE reports "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE documents "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE earnings_analyses "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE comps_analyses "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE deal_actions "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE deals "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"
        ))
        await conn.execute(text(
            "ALTER TABLE qa_queries "
            "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, "
            "ADD COLUMN IF NOT EXISTS corpus_fingerprint VARCHAR(80)"
        ))

        # ── Workspace backfill: create a personal workspace for every user
        # that doesn't have one yet. Idempotent — skips users who already
        # have active_workspace_id set. ────────────────────────────────────
        await conn.execute(text("""
            INSERT INTO workspaces (id, name, slug, plan_tier, memo_credits,
                stripe_customer_id, stripe_subscription_id,
                subscription_status, current_period_end)
            SELECT
                gen_random_uuid(),
                u.email,
                u.id::text,
                u.plan_tier,
                u.memo_credits,
                u.stripe_customer_id,
                u.stripe_subscription_id,
                u.subscription_status,
                u.current_period_end
            FROM users u
            WHERE u.active_workspace_id IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id
              )
        """))

        # Create membership rows for the new personal workspaces.
        await conn.execute(text("""
            INSERT INTO workspace_members (id, workspace_id, user_id, role)
            SELECT gen_random_uuid(), w.id, u.id, 'admin'
            FROM users u
            JOIN workspaces w ON w.slug = u.id::text
            WHERE u.active_workspace_id IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.user_id = u.id AND wm.workspace_id = w.id
              )
        """))

        # Point users to their personal workspace.
        await conn.execute(text("""
            UPDATE users u
            SET active_workspace_id = w.id
            FROM workspaces w
            WHERE w.slug = u.id::text
              AND u.active_workspace_id IS NULL
        """))

        # Backfill workspace_id on data tables for rows that don't have it.
        await conn.execute(text("""
            UPDATE reports r
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE r.user_id = u.id
              AND r.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE documents d
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE d.user_id = u.id
              AND d.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE watchlist_items wi
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE wi.user_id = u.id
              AND wi.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE earnings_analyses ea
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE ea.user_id = u.id
              AND ea.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE comps_analyses ca
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE ca.user_id = u.id
              AND ca.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE deal_actions da
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE da.user_id = u.id
              AND da.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE deals d2
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE d2.user_id = u.id
              AND d2.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))
        await conn.execute(text("""
            UPDATE qa_queries qq
            SET workspace_id = u.active_workspace_id
            FROM users u
            WHERE qq.user_id = u.id
              AND qq.workspace_id IS NULL
              AND u.active_workspace_id IS NOT NULL
        """))

        # ── Indexes for collaboration tables ────────────────────────────────
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_comments_target "
            "ON comments (target_type, target_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_activity_workspace_created "
            "ON activity_events (workspace_id, created_at DESC)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_unread "
            "ON notifications (user_id, read) WHERE read = FALSE"
        ))

    yield


app = FastAPI(
    title="Arthvion",
    description="Multi-agent PE due diligence platform",
    version="0.3.0",
    lifespan=lifespan,
    # Don't expose version/routes in production
    docs_url="/docs" if settings.environment.lower() == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment.lower() == "development" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")
app.include_router(actions_router, prefix="/api/v1")
app.include_router(deals_router, prefix="/api/v1")
app.include_router(qa_router, prefix="/api/v1")
app.include_router(report_chat_router, prefix="/api/v1")
app.include_router(earnings_router, prefix="/api/v1")
app.include_router(comps_router, prefix="/api/v1")
app.include_router(screener_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(comments_router, prefix="/api/v1")
app.include_router(activity_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
