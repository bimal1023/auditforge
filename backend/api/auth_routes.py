"""Register, login, logout, and password-reset endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import (
    _is_token_blacklisted,
    blacklist_token,
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    get_current_user,
    hash_password,
    verify_email_verification_token,
    verify_password,
    verify_password_reset_token,
)
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.models.db import User
from backend.services.email import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer()

# ── Common weak passwords to reject ──────────────────────────────────────
_WEAK_PASSWORDS = {
    "password", "12345678", "123456789", "1234567890", "qwerty123",
    "password1", "iloveyou", "abc12345", "admin123", "letmein12",
    "welcome1", "monkey123", "dragon12", "master12", "qwerty12",
}


def _validate_password_strength(password: str) -> None:
    """Enforce basic password complexity — min 8 chars, mixed content."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if password.lower() in _WEAK_PASSWORDS:
        raise HTTPException(status_code=400, detail="That password is too common. Choose a stronger one.")
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_upper and has_lower and has_digit):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one uppercase letter, one lowercase letter, and one digit",
        )


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    company_name: str | None = None   # seeds the workspace name; optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    message: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    memo_credits: int
    plan_tier: str
    subscription_status: str | None = None
    current_period_end: datetime | None = None
    is_verified: bool = True
    created_at: datetime | None = None
    # Workspace info (populated from active workspace)
    workspace_id: str | None = None
    workspace_name: str | None = None
    workspace_role: str | None = None


class RegisterResponse(BaseModel):
    """Returned by /register — no access token until the user verifies their email."""
    detail: str = "Account created. Check your email to verify."
    email: str


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("20/hour")
async def register(
    request: Request,
    req: RegisterRequest,
    db: AsyncSession = Depends(get_session),
) -> RegisterResponse:
    _validate_password_strength(req.password)

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        # Don't reveal that the email is already registered — prevents
        # user enumeration. Return the same response as a successful signup.
        logger.info("Registration attempt for existing email: %s", req.email)
        return RegisterResponse(email=req.email)

    from backend.models.db import Workspace, WorkspaceMember

    # New accounts start unverified — Python `default=False` on the model.
    full_name = (req.full_name or "").strip() or None
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=full_name,
    )
    db.add(user)
    await db.flush()  # get user.id without committing

    # Create a personal workspace for the new user. Seed its name from the
    # optional company name supplied at signup; fall back to the email so the
    # workspace always has a non-empty display name.
    ws_name = (req.company_name or "").strip() or req.email
    ws = Workspace(
        name=ws_name,
        slug=str(user.id),
        plan_tier="solo",
        memo_credits=3,
    )
    db.add(ws)
    await db.flush()

    membership = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role="admin",
    )
    db.add(membership)
    user.active_workspace_id = ws.id

    await db.commit()
    await db.refresh(user)

    # Send verification email with a 24h JWT link. The user cannot log in until
    # they click it.
    settings = get_settings()
    token = create_email_verification_token(user.id)
    verify_url = f"{settings.app_url}/verify-email?token={token}"
    try:
        await send_verification_email(to=user.email, verify_url=verify_url)
    except Exception as exc:
        logger.warning("Verification email failed for %s: %s", user.email, exc)

    return RegisterResponse(email=req.email)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    req: LoginRequest,
    db: AsyncSession = Depends(get_session),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Block login until email is verified. 403 with a specific code lets the
    # frontend show a "Resend verification email" affordance instead of a
    # generic error.
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified",
        )

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout", status_code=204)
async def logout(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    current_user: User = Depends(get_current_user),
) -> None:
    """Blacklist the current token so it cannot be reused after logout."""
    blacklist_token(creds.credentials)


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserResponse:
    from backend.models.db import Workspace, WorkspaceMember

    # Populate workspace info from active workspace
    ws_id = ws_name = ws_role = None
    plan_tier = current_user.plan_tier
    memo_credits = current_user.memo_credits
    subscription_status = current_user.subscription_status
    current_period_end = current_user.current_period_end

    if current_user.active_workspace_id:
        ws = await db.get(Workspace, current_user.active_workspace_id)
        if ws:
            ws_id = str(ws.id)
            ws_name = ws.name
            plan_tier = ws.plan_tier
            memo_credits = ws.memo_credits
            subscription_status = ws.subscription_status
            current_period_end = ws.current_period_end

            membership = (
                await db.execute(
                    select(WorkspaceMember).where(
                        WorkspaceMember.workspace_id == ws.id,
                        WorkspaceMember.user_id == current_user.id,
                    )
                )
            ).scalar_one_or_none()
            if membership:
                ws_role = membership.role

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        memo_credits=memo_credits,
        plan_tier=plan_tier,
        subscription_status=subscription_status,
        current_period_end=current_period_end,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        workspace_id=ws_id,
        workspace_name=ws_name,
        workspace_role=ws_role,
    )


# ── Password reset ──────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


@router.post("/forgot-password", status_code=204)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_session),
) -> None:
    """Send a password-reset email if the address matches an account.

    Always returns 204 — even when the email is unknown — to prevent
    user-enumeration attacks. Rate-limited to 5 requests / hour / IP so an
    attacker can't fish for valid emails or spam the Resend account.
    """
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    # Silently no-op for unknown emails (don't leak account existence).
    if user is None:
        logger.info("Password-reset requested for unknown email: %s", req.email)
        return

    token = create_password_reset_token(user.id)
    reset_url = f"{settings.app_url}/reset-password?token={token}"
    try:
        await send_password_reset_email(to=user.email, reset_url=reset_url)
    except Exception as exc:
        logger.error("Reset email send failed for %s: %s", user.email, exc)
        # Still return 204 — we don't want the client to retry storms of resends.


@router.post("/reset-password", response_model=TokenResponse)
@limiter.limit("10/hour")
async def reset_password(
    request: Request,
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Set a new password using a valid reset token from the email link.

    Returns a fresh access token on success so the user is logged in
    immediately, with no second login step.
    """
    # Check if this reset token was already used (replay protection)
    if _is_token_blacklisted(req.token):
        raise HTTPException(status_code=400, detail="Reset link has already been used")

    user_id = verify_password_reset_token(req.token)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user.hashed_password = hash_password(req.new_password)
    await db.commit()

    # Blacklist the reset token so it can't be replayed
    blacklist_token(req.token)

    return TokenResponse(access_token=create_access_token(user.id))


# ── Email verification ──────────────────────────────────────────────────────

class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


@router.post("/verify-email", response_model=TokenResponse)
@limiter.limit("20/hour")
async def verify_email(
    request: Request,
    req: VerifyEmailRequest,
    db: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Mark a user as verified using the token from their registration email.

    Returns a fresh access token on success so the user is signed in
    immediately, without a separate login step. Idempotent — re-clicking a
    valid link for an already-verified account still returns a fresh token,
    treating it as a successful authentication.
    """
    # Check if this verification token was already consumed
    if _is_token_blacklisted(req.token):
        raise HTTPException(status_code=400, detail="Verification link has already been used. Please log in.")

    user_id = verify_email_verification_token(req.token)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Verification link is invalid or has expired.")

    if user.is_verified:
        # Already verified — do NOT issue a fresh token (prevents using
        # leaked verification emails as passwordless login).
        blacklist_token(req.token)
        return TokenResponse(access_token="", message="Account already verified. Please log in.")

    # First-time verification — grant access and send welcome email.
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    await db.commit()

    # Blacklist the token so it can't be reused
    blacklist_token(req.token)

    # ── Auto-accept any pending workspace invites for this email ─────────
    # This handles the case where someone was invited before they had an
    # account: they register, verify, and land directly in the inviting
    # workspace — no second step required.
    from backend.models.db import Workspace, WorkspaceMember, WorkspaceInvite

    pending_invites = (await db.execute(
        select(WorkspaceInvite).where(
            WorkspaceInvite.email == user.email,
            WorkspaceInvite.accepted_at.is_(None),
            WorkspaceInvite.expires_at > datetime.now(timezone.utc),
        )
    )).scalars().all()

    for inv in pending_invites:
        # Check not already a member
        existing = (await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == inv.workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )).scalar_one_or_none()
        if existing:
            inv.accepted_at = datetime.now(timezone.utc)
            continue

        # Add user to the workspace
        db.add(WorkspaceMember(
            workspace_id=inv.workspace_id,
            user_id=user.id,
            role=inv.role,
        ))
        inv.accepted_at = datetime.now(timezone.utc)
        # Switch the user's active workspace to the invited one
        user.active_workspace_id = inv.workspace_id

    if pending_invites:
        await db.commit()

    try:
        await send_welcome_email(to=user.email)
    except Exception as exc:
        logger.warning("Welcome email failed for %s: %s", user.email, exc)

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/resend-verification", status_code=204)
@limiter.limit("5/hour")
async def resend_verification(
    request: Request,
    req: ResendVerificationRequest,
    db: AsyncSession = Depends(get_session),
) -> None:
    """Re-send the verification email if the address matches an unverified account.

    Always returns 204 — even when the email is unknown or already verified —
    to prevent user-enumeration. Rate-limited to 5/hr/IP so an attacker can't
    spam the Resend account.
    """
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if user is None or user.is_verified:
        # Don't leak which case we hit.
        logger.info("Resend-verification no-op for %s", req.email)
        return

    token = create_email_verification_token(user.id)
    verify_url = f"{settings.app_url}/verify-email?token={token}"
    try:
        await send_verification_email(to=user.email, verify_url=verify_url)
    except Exception as exc:
        logger.error("Verification email send failed for %s: %s", user.email, exc)


# ── Profile update ─────────────────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    full_name: str = Field(max_length=100)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Update the current user's profile (display name)."""
    current_user.full_name = req.full_name.strip() or None
    await db.commit()
    await db.refresh(current_user)

    from backend.models.db import Workspace, WorkspaceMember

    ws_id = ws_name = ws_role = None
    plan_tier = current_user.plan_tier
    memo_credits = current_user.memo_credits
    if current_user.active_workspace_id:
        ws = await db.get(Workspace, current_user.active_workspace_id)
        if ws:
            ws_id = str(ws.id)
            ws_name = ws.name
            plan_tier = ws.plan_tier
            memo_credits = ws.memo_credits
            membership = (await db.execute(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.user_id == current_user.id,
                )
            )).scalar_one_or_none()
            if membership:
                ws_role = membership.role

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        memo_credits=memo_credits,
        plan_tier=plan_tier,
        subscription_status=current_user.subscription_status,
        current_period_end=current_user.current_period_end,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        workspace_id=ws_id,
        workspace_name=ws_name,
        workspace_role=ws_role,
    )


# ── Change password ────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@router.put("/password", status_code=204)
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Change password by verifying the current one first."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    current_user.hashed_password = hash_password(req.new_password)
    await db.commit()


# ── Delete account ─────────────────────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/account", status_code=204)
async def delete_account(
    req: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Permanently delete the current user's account.

    Requires password confirmation. All associated data (reports, documents,
    watchlist items, etc.) is cascade-deleted by FK constraints.
    """
    if not verify_password(req.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    await db.delete(current_user)
    await db.commit()
