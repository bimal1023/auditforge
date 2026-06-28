"""Billing endpoints — checkout, customer portal, and Stripe webhook.

Mounted at /api/v1/billing/* by backend.main.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import CreditTopup, ReportRecord, User, WatchlistItem, Workspace
from backend.services.billing import (
    PLAN_CREDITS,
    WATCHLIST_MAX_SLOTS,
    create_checkout_session,
    create_portal_session,
    create_topup_session,
    price_id_to_plan,
    verify_webhook,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


# ── Checkout (start a subscription) ──────────────────────────────────────────

@router.post("/checkout")
@limiter.limit("20/hour")
async def start_checkout(
    request: Request,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Create a Stripe Checkout session and return its URL.

    The frontend redirects the browser to that URL — Stripe handles the
    actual payment form. After success/cancel Stripe redirects back to
    `${APP_URL}/billing/success?session_id=...` or `/billing/cancel`.
    """
    settings = get_settings()
    ws = ctx.workspace
    if not settings.stripe_desk_price_id:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured. STRIPE_DESK_PRICE_ID is missing.",
        )

    # Prevent double-subscription
    if ws.subscription_status in ("trialing", "active"):
        raise HTTPException(
            status_code=400,
            detail="This workspace already has an active subscription. Use the customer portal to make changes.",
        )

    try:
        checkout_url = await create_checkout_session(
            workspace=ws,
            user=ctx.user,
            price_id=settings.stripe_desk_price_id,
            success_url=f"{settings.app_url}/billing/success",
            cancel_url=f"{settings.app_url}/billing/cancel",
        )
    except stripe.StripeError as exc:
        logger.error("Stripe checkout creation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not start checkout. Try again.")

    # Persist the (possibly newly-created) Stripe customer ID on workspace.
    await db.commit()

    return {"checkout_url": checkout_url}


# ── Top-up (buy extra memo credits mid-cycle) ────────────────────────────────

class TopupRequest(BaseModel):
    credits: int


@router.post("/topup")
@limiter.limit("20/hour")
async def start_topup(
    request: Request,
    body: TopupRequest,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Create a one-time Stripe Checkout session to buy extra memo credits.

    Unlike `/checkout` (which starts a recurring subscription), this is a
    one-off purchase that tops up the workspace's `memo_credits` without
    changing the plan tier. The credits are granted by the webhook once the
    `checkout.session.completed` event arrives — keyed on the session ID so a
    retried webhook can't double-grant.
    """
    settings = get_settings()
    ws = ctx.workspace

    if not settings.stripe_topup_price_id:
        raise HTTPException(
            status_code=503,
            detail="Credit top-ups are not configured. STRIPE_TOPUP_PRICE_ID is missing.",
        )

    # Only paying (Desk/Firm) workspaces can buy overage — Solo should upgrade.
    if (ws.plan_tier or "solo") == "solo":
        raise HTTPException(
            status_code=400,
            detail="Credit top-ups are available on paid plans. Upgrade to Desk first.",
        )

    credits = body.credits
    if credits < settings.topup_min_credits or credits > settings.topup_max_credits:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Top-up must be between {settings.topup_min_credits} and "
                f"{settings.topup_max_credits} credits."
            ),
        )

    try:
        checkout_url = await create_topup_session(
            workspace=ws,
            user=ctx.user,
            price_id=settings.stripe_topup_price_id,
            credits=credits,
            success_url=f"{settings.app_url}/billing/success",
            cancel_url=f"{settings.app_url}/billing/cancel",
        )
    except stripe.StripeError as exc:
        logger.error("Stripe top-up creation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not start top-up. Try again.")

    # Persist the (possibly newly-created) Stripe customer ID on the workspace.
    await db.commit()

    return {"checkout_url": checkout_url}


# ── Customer portal (manage existing subscription) ───────────────────────────

@router.post("/portal")
@limiter.limit("20/hour")
async def open_portal(
    request: Request,
    ctx: WorkspaceContext = Depends(require_role("admin")),
) -> dict:
    """Create a Stripe Customer Portal session and return its URL.

    Users land in a Stripe-hosted page where they can update their card,
    cancel, see invoices, etc. We never see card details — Stripe owns it.
    """
    settings = get_settings()
    ws = ctx.workspace
    if not ws.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="This workspace doesn't have a billing account yet. Start a subscription first.",
        )

    try:
        portal_url = await create_portal_session(
            workspace=ws,
            return_url=f"{settings.app_url}/app",
        )
    except stripe.StripeError as exc:
        logger.error("Stripe portal creation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not open billing portal.")

    return {"portal_url": portal_url}


# ── Usage summary (drives the Usage dashboard tab + sidebar badge) ────────────

@router.get("/usage")
async def get_usage(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Return workspace usage for the current billing cycle.

    Memo usage is derived from credits: `used = max(0, limit - remaining)`.
    Report/watchlist counts are queried live at the workspace level.
    """
    ws = ctx.workspace
    tier = ws.plan_tier or "solo"
    memo_limit = PLAN_CREDITS.get(tier, 0)
    remaining = max(0, ws.memo_credits)
    if memo_limit >= 999_999:
        memo_used = max(0, memo_limit - remaining) if remaining < memo_limit else 0
    else:
        memo_used = max(0, memo_limit - remaining)
    memo_pct = round((memo_used / memo_limit) * 100) if memo_limit and memo_limit < 999_999 else 0

    # ── Usage warning thresholds (drive the dashboard banner) ────────────────
    # "critical" once they're effectively out (>=95% used or 0 remaining),
    # "warning" at 80%. Unlimited (Firm) plans never warn.
    unlimited = memo_limit >= 999_999
    if unlimited:
        warn_level = "none"
        warn_message = None
    elif remaining <= 0 or memo_pct >= 95:
        warn_level = "critical"
        warn_message = (
            "You're out of memo credits. Buy more credits or wait for your "
            "monthly refill to keep running reports."
        )
    elif memo_pct >= 80:
        warn_level = "warning"
        warn_message = (
            f"You've used {memo_pct}% of your monthly memos "
            f"({remaining} left). Consider topping up."
        )
    else:
        warn_level = "none"
        warn_message = None

    now = datetime.now(timezone.utc)
    if ws.current_period_end:
        cycle_start = ws.current_period_end - timedelta(days=30)
    else:
        cycle_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    reports_total = (
        await db.execute(
            select(func.count())
            .select_from(ReportRecord)
            .where(ReportRecord.workspace_id == ws.id)
        )
    ).scalar_one()

    reports_this_cycle = (
        await db.execute(
            select(func.count())
            .select_from(ReportRecord)
            .where(
                ReportRecord.workspace_id == ws.id,
                ReportRecord.created_at >= cycle_start,
            )
        )
    ).scalar_one()

    watchlist_max = WATCHLIST_MAX_SLOTS.get(tier, 0)
    watchlist_used = (
        await db.execute(
            select(func.count())
            .select_from(WatchlistItem)
            .where(
                WatchlistItem.workspace_id == ws.id,
                WatchlistItem.status != "archived",
            )
        )
    ).scalar_one()

    return {
        "plan_tier": tier,
        "subscription_status": ws.subscription_status,
        "current_period_end": (
            ws.current_period_end.isoformat()
            if ws.current_period_end else None
        ),
        "memo": {
            "used": memo_used,
            "remaining": remaining,
            "limit": memo_limit,
            "percent": memo_pct,
            "unlimited": unlimited,
            "warning": {
                "level": warn_level,      # "none" | "warning" | "critical"
                "message": warn_message,
            },
        },
        "reports": {
            "this_cycle": reports_this_cycle,
            "total": reports_total,
        },
        "watchlist": {
            "used": watchlist_used,
            "max": watchlist_max,
            "unlimited": watchlist_max >= 999_999,
        },
    }


# ── Webhook (Stripe → us) ────────────────────────────────────────────────────
# NOTE: do NOT add auth to this endpoint. Stripe calls it directly with no
# bearer token. We authenticate via the signature header instead.

@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default=""),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Receive Stripe events and update our DB accordingly.

    Events we care about:
      - `checkout.session.completed` → grab customer/subscription IDs, mark plan
      - `customer.subscription.updated` / `.created` → sync status + period end
      - `customer.subscription.deleted` → downgrade to Solo
      - `invoice.paid` → refill memo credits for the new period
      - `invoice.payment_failed` → log; Stripe's dunning handles retries

    All updates are idempotent — Stripe retries failed deliveries up to 3 days.
    """
    payload = await request.body()
    try:
        event = verify_webhook(payload, stripe_signature)
    except stripe.SignatureVerificationError:
        logger.warning("Webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as exc:
        logger.error("Webhook payload parse failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event["type"]
    # stripe-python ≥ 14 returns StripeObject instances (NOT dict subclasses) for
    # `event.data.object`. They have no `.get()` method, so calling `data.get(...)`
    # raises `AttributeError: get` and silently fails every handler. Flatten to a
    # plain nested dict so the `.get()` / `_safe_get` access below works as written.
    data = event["data"]["object"]
    if hasattr(data, "to_dict"):
        data = data.to_dict()
    logger.info("Stripe webhook received: %s", event_type)

    # All branches wrap their work in this try/except so the exact traceback
    # ends up in the backend log — easier to debug than a bare 500 in Stripe
    # CLI output. Re-raises after logging so Stripe still retries.
    try:
        return await _dispatch_webhook(event_type, data, db)
    except Exception:
        # Log to stderr AND a debug file so we can recover the traceback
        # even if the user is running uvicorn without saving logs.
        import traceback as _tb
        import json as _json
        logger.exception("Webhook handler failed for %s", event_type)
        # Return 500 so Stripe retries the event (up to ~3 days with backoff).
        # This prevents silent data loss on transient DB errors or bugs.
        raise HTTPException(status_code=500, detail="Internal webhook processing error")


async def _dispatch_webhook(event_type: str, data: Any, db: AsyncSession) -> dict:
    """The actual event router. Pulled into a helper so the caller can wrap
    every branch in a single try/except for traceback logging."""

    # ── checkout.session.completed ───────────────────────────────────────────
    # First event after a successful checkout. We DON'T fetch the live
    # subscription here — too many edge cases across Stripe API versions.
    # We just trust that if the checkout succeeded, the user should be on
    # the Desk plan with the credit cap. Period end + status get refined
    # later by customer.subscription.created/updated events.
    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        mode = data.get("mode")
        logger.info("checkout.session.completed: customer=%s subscription=%s mode=%s",
                    customer_id, subscription_id, mode)
        if not customer_id:
            return {"received": True}

        ws = await _workspace_by_customer_id(db, customer_id)
        if ws is None:
            logger.warning("Checkout completed for unknown customer %s", customer_id)
            return {"received": True}

        # One-time credit top-up (mode="payment"): grant the purchased credits
        # on TOP of the current balance instead of resetting plan/credits.
        if mode == "payment":
            return await _grant_topup_credits(ws, data, db)

        if subscription_id:
            ws.stripe_subscription_id = subscription_id
        ws.plan_tier = "desk"
        ws.memo_credits = PLAN_CREDITS["desk"]
        ws.subscription_status = "active"
        await db.commit()
        logger.info("Granted Desk plan + %d credits to workspace %s",
                    PLAN_CREDITS["desk"], ws.id)
        return {"received": True}

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = data.get("customer")
        logger.info("%s: customer=%s", event_type, customer_id)
        ws = await _workspace_by_customer_id(db, customer_id)
        if ws is None:
            return {"received": True}
        try:
            _apply_subscription_to_workspace(ws, data)
        except Exception as exc:
            logger.warning("Could not apply subscription details: %s", exc)
            if ws.plan_tier == "solo":
                ws.plan_tier = "desk"
                ws.memo_credits = PLAN_CREDITS["desk"]
                ws.subscription_status = "active"
        await db.commit()
        logger.info("Synced subscription for workspace %s (plan=%s, credits=%d)",
                    ws.id, ws.plan_tier, ws.memo_credits)
        return {"received": True}

    if event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        ws = await _workspace_by_customer_id(db, customer_id)
        if ws is None:
            return {"received": True}
        ws.subscription_status = "canceled"
        ws.plan_tier = "solo"
        await db.commit()
        return {"received": True}

    if event_type == "invoice.paid":
        customer_id = data.get("customer")
        logger.info("invoice.paid: customer=%s", customer_id)
        if not customer_id:
            return {"received": True}
        ws = await _workspace_by_customer_id(db, customer_id)
        if ws is None:
            logger.warning("invoice.paid for unknown customer %s", customer_id)
            return {"received": True}
        if ws.plan_tier == "solo":
            ws.plan_tier = "desk"
            ws.subscription_status = "active"
        cap = PLAN_CREDITS.get(ws.plan_tier, PLAN_CREDITS["solo"])
        ws.memo_credits = cap
        await db.commit()
        logger.info("Refilled %d credits for workspace %s (%s plan)",
                    cap, ws.id, ws.plan_tier)
        return {"received": True}

    # ── invoice.payment_failed ───────────────────────────────────────────────
    # Stripe will retry per the user's dunning settings. We just log it.
    if event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        logger.warning("Payment failed for customer %s", customer_id)
        return {"received": True}

    # Anything else: acknowledge but don't act.
    return {"received": True}


# ── helpers ──────────────────────────────────────────────────────────────────

async def _grant_topup_credits(ws: Workspace, data: Any, db: AsyncSession) -> dict:
    """Add purchased overage credits to a workspace, idempotently.

    Idempotency is enforced by the UNIQUE `stripe_session_id` on CreditTopup:
    if we've already recorded this session we skip the increment entirely, so
    Stripe webhook retries can never double-grant.
    """
    session_id = data.get("id")
    metadata = data.get("metadata") or {}
    try:
        credits = int(metadata.get("topup_credits", 0))
    except (TypeError, ValueError):
        credits = 0

    if not session_id or credits <= 0:
        logger.warning("Top-up checkout missing session id or credits: %s", session_id)
        return {"received": True}

    existing = (
        await db.execute(
            select(CreditTopup).where(CreditTopup.stripe_session_id == session_id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("Top-up session %s already processed — skipping", session_id)
        return {"received": True}

    ws.memo_credits = (ws.memo_credits or 0) + credits
    db.add(CreditTopup(
        workspace_id=ws.id,
        stripe_session_id=session_id,
        credits=credits,
    ))
    await db.commit()
    logger.info("Topped up %d credits for workspace %s (now %d)",
                credits, ws.id, ws.memo_credits)
    return {"received": True}


async def _user_by_customer_id(db: AsyncSession, customer_id: str) -> User | None:
    """Legacy lookup — kept for backward compat during migration."""
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def _workspace_by_customer_id(db: AsyncSession, customer_id: str) -> Workspace | None:
    result = await db.execute(
        select(Workspace).where(Workspace.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def _get_subscription(subscription_id: str) -> dict:
    """Fetch the live subscription object from Stripe (used after checkout)."""
    import asyncio
    return await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)


def _safe_get(obj: Any, *path: Any) -> Any:
    """Walk a nested dict / StripeObject / list without raising on missing keys.

    Accepts either string keys (dict / attr access) or integer keys (list index).
    Returns None at the first missing link. Used to safely navigate Stripe's
    sometimes-nested structures like `sub.items.data[0].price.id`.
    """
    cur: Any = obj
    for key in path:
        if cur is None:
            return None
        # Integer key → list / tuple index
        if isinstance(key, int):
            if isinstance(cur, (list, tuple)) and 0 <= key < len(cur):
                cur = cur[key]
            else:
                return None
            continue
        # String key → dict or StripeObject
        if hasattr(cur, "get") and not isinstance(cur, str):
            cur = cur.get(key)
        else:
            try:
                cur = getattr(cur, key, None)
            except Exception:
                return None
    return cur


def _apply_subscription_to_workspace(ws: Workspace, sub: Any) -> None:
    """Sync workspace billing state from a Stripe subscription object.

    Defensive against API-shape differences across Stripe versions.
    Pure function — caller is responsible for `db.commit()`.
    """
    ws.subscription_status = _safe_get(sub, "status")

    period_end_ts = (
        _safe_get(sub, "current_period_end")
        or _safe_get(sub, "items", "data", 0, "current_period_end")
    )
    if isinstance(period_end_ts, (int, float)) and period_end_ts > 0:
        try:
            ws.current_period_end = datetime.fromtimestamp(
                int(period_end_ts), tz=timezone.utc,
            )
        except (OSError, OverflowError, ValueError) as exc:
            logger.warning("Bad period_end timestamp %s: %s", period_end_ts, exc)

    price_id = _safe_get(sub, "items", "data", 0, "price", "id")
    new_tier = price_id_to_plan(price_id)

    upgrading = ws.plan_tier != new_tier and new_tier != "solo"
    ws.plan_tier = new_tier
    if upgrading and ws.subscription_status in ("trialing", "active"):
        ws.memo_credits = PLAN_CREDITS.get(new_tier, PLAN_CREDITS["solo"])
        logger.info(
            "Granted %d credits to workspace %s on %s upgrade",
            ws.memo_credits, ws.id, new_tier,
        )
