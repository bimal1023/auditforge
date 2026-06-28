"""Stripe billing helpers.

Wraps `stripe.Customer`, `stripe.checkout.Session`, and `stripe.billing_portal`
into small async helpers that the API layer calls. All Stripe API calls are
synchronous (their Python SDK doesn't offer async), so we wrap them with
`asyncio.to_thread` to avoid blocking the event loop.

Plan ↔ credits mapping is the single source of truth for "how many memos
does a given plan tier come with":
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import stripe

from backend.core.config import get_settings
from backend.models.db import User, Workspace

logger = logging.getLogger(__name__)


# How many memo credits each plan grants per billing cycle.
PLAN_CREDITS: dict[str, int] = {
    "solo": 3,
    "desk": 50,
    # Firm is custom — webhook will leave credits unchanged unless we set
    # the field explicitly via admin tooling.
    "firm": 999_999,
}

WATCHLIST_MAX_SLOTS: dict[str, int] = {
    "solo": 0,
    "desk": 5,
    "firm": 999_999,
}

WATCHLIST_SCAN_FREQUENCY: dict[str, str] = {
    "solo": "weekly",
    "desk": "weekly",
    "firm": "daily",
}


def _client() -> stripe.StripeClient:
    """Build a Stripe client from settings. Raises if the key isn't configured."""
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise RuntimeError(
            "STRIPE_SECRET_KEY is not set. Add it to infra/.env to enable billing."
        )
    # stripe.api_key is module-global — set it once. Newer SDK versions also
    # support `stripe.StripeClient(...)` for per-call isolation but we keep
    # the simpler global pattern for a single-tenant secret.
    stripe.api_key = settings.stripe_secret_key
    return stripe  # type: ignore[return-value]


# ── Customer ─────────────────────────────────────────────────────────────────

async def ensure_stripe_customer(workspace: Workspace, user: User) -> str:
    """Return the workspace's Stripe customer ID, creating one if needed.

    Uses the admin user's email as the Stripe customer email.
    Caller is responsible for committing the new ID to the DB.
    """
    if workspace.stripe_customer_id:
        return workspace.stripe_customer_id

    client = _client()
    customer = await asyncio.to_thread(
        client.Customer.create,  # type: ignore[attr-defined]
        email=user.email,
        metadata={"workspace_id": str(workspace.id), "user_id": str(user.id)},
    )
    workspace.stripe_customer_id = customer["id"]
    return customer["id"]


# ── Checkout ─────────────────────────────────────────────────────────────────

async def create_checkout_session(
    *, workspace: Workspace, user: User, price_id: str,
    success_url: str, cancel_url: str,
) -> str:
    """Create a Stripe Checkout session and return the redirect URL.

    Uses subscription mode. Billing is at the workspace level.
    """
    settings = get_settings()
    customer_id = await ensure_stripe_customer(workspace, user)

    subscription_data: dict = {
        "metadata": {"workspace_id": str(workspace.id)},
    }
    if settings.stripe_trial_days > 0:
        subscription_data["trial_period_days"] = settings.stripe_trial_days

    client = _client()
    session = await asyncio.to_thread(
        client.checkout.Session.create,  # type: ignore[attr-defined]
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        subscription_data=subscription_data,
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        allow_promotion_codes=True,
    )
    return session["url"]


# ── Top-up (one-time purchase of extra memo credits) ─────────────────────────

async def create_topup_session(
    *, workspace: Workspace, user: User, price_id: str, credits: int,
    success_url: str, cancel_url: str,
) -> str:
    """Create a one-time Stripe Checkout session to buy `credits` extra memos.

    Uses `mode="payment"` with `quantity=credits` against a per-unit price.
    The credit count is also stamped into session metadata so the webhook can
    grant exactly that many credits idempotently (keyed on the session ID).
    """
    customer_id = await ensure_stripe_customer(workspace, user)

    client = _client()
    session = await asyncio.to_thread(
        client.checkout.Session.create,  # type: ignore[attr-defined]
        mode="payment",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": credits}],
        metadata={
            "workspace_id": str(workspace.id),
            "topup_credits": str(credits),
        },
        payment_intent_data={
            "metadata": {
                "workspace_id": str(workspace.id),
                "topup_credits": str(credits),
            },
        },
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
    )
    return session["url"]


# ── Customer portal (manage subscription) ────────────────────────────────────

async def create_portal_session(*, workspace: Workspace, return_url: str) -> str:
    """Create a Stripe customer-portal session for plan management."""
    if not workspace.stripe_customer_id:
        raise ValueError("Workspace has no Stripe customer record")

    client = _client()
    session = await asyncio.to_thread(
        client.billing_portal.Session.create,  # type: ignore[attr-defined]
        customer=workspace.stripe_customer_id,
        return_url=return_url,
    )
    return session["url"]


# ── Webhook event verification ───────────────────────────────────────────────

def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    """Verify a Stripe webhook payload's signature and return the parsed event.

    Raises `stripe.SignatureVerificationError` if the signature is invalid —
    callers should map that to HTTP 400.
    """
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise RuntimeError(
            "STRIPE_WEBHOOK_SECRET is not set. Forward webhooks with "
            "`stripe listen --forward-to localhost:8000/api/v1/billing/webhook` "
            "and copy the printed secret into infra/.env."
        )
    return stripe.Webhook.construct_event(  # type: ignore[no-any-return]
        payload=payload,
        sig_header=signature,
        secret=settings.stripe_webhook_secret,
    )


# ── Helpers to translate Stripe price IDs back to our plan_tier strings ──────

def price_id_to_plan(price_id: Optional[str]) -> str:
    """Map a Stripe price ID to one of our plan_tier values."""
    settings = get_settings()
    if price_id and price_id == settings.stripe_desk_price_id:
        return "desk"
    return "solo"
