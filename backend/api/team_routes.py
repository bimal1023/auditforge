"""Team / workspace management endpoints.

Mounted at /api/v1/team/* by backend.main.

Invite flow:
  1. Admin POSTs /team/invite → creates WorkspaceInvite, sends email
  2. Recipient clicks link → frontend /invite page → POST /team/accept-invite
  3. If user exists, add WorkspaceMember. If not, register first then accept.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.activity import log_activity
from backend.core.auth import get_current_user
from backend.core.config import get_settings
from backend.core.database import get_session
from backend.core.rate_limit import limiter
from backend.core.workspace import WorkspaceContext, get_workspace_context, require_role
from backend.models.db import User, Workspace, WorkspaceMember, WorkspaceInvite
from backend.services.email import send_workspace_invite_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])

# Seat limits per plan tier
SEAT_LIMITS: dict[str, int] = {
    "solo": 1,
    "desk": 5,
    "firm": 999,
}


# ── Request / response schemas ─────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "analyst"  # "admin" | "analyst" | "viewer"


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str | None = None
    role: str
    joined_at: str


class InviteOut(BaseModel):
    id: str
    email: str
    role: str
    invited_by_email: str | None = None
    expires_at: str
    created_at: str


class AcceptInviteRequest(BaseModel):
    token: str


class RoleUpdateRequest(BaseModel):
    role: str  # "admin" | "analyst" | "viewer"


class WorkspaceInfoOut(BaseModel):
    id: str
    name: str
    plan_tier: str
    member_count: int
    seat_limit: int


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("/info", response_model=WorkspaceInfoOut)
async def workspace_info(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> WorkspaceInfoOut:
    """Return workspace metadata visible to any member."""
    member_count = (
        await db.execute(
            select(func.count()).select_from(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == ctx.workspace.id)
        )
    ).scalar_one()
    return WorkspaceInfoOut(
        id=str(ctx.workspace.id),
        name=ctx.workspace.name,
        plan_tier=ctx.workspace.plan_tier,
        member_count=member_count,
        seat_limit=SEAT_LIMITS.get(ctx.workspace.plan_tier, 1),
    )


@router.get("/members", response_model=list[MemberOut])
async def list_members(
    ctx: WorkspaceContext = Depends(get_workspace_context),
    db: AsyncSession = Depends(get_session),
) -> list[MemberOut]:
    """List all members of the current workspace."""
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == ctx.workspace.id)
        .order_by(WorkspaceMember.joined_at)
    )
    return [
        MemberOut(
            id=str(m.id),
            user_id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            joined_at=m.joined_at.isoformat() if m.joined_at else "",
        )
        for m, u in result.all()
    ]


@router.post("/invite", response_model=InviteOut, status_code=201)
@limiter.limit("20/hour")
async def send_invite(
    request: Request,
    body: InviteRequest,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> InviteOut:
    """Send an invite email to join the workspace."""
    if body.role not in ("admin", "analyst", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin, analyst, or viewer.")

    ws = ctx.workspace
    seat_limit = SEAT_LIMITS.get(ws.plan_tier, 1)

    # Count current members + pending invites
    member_count = (
        await db.execute(
            select(func.count()).select_from(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == ws.id)
        )
    ).scalar_one()

    pending_count = (
        await db.execute(
            select(func.count()).select_from(WorkspaceInvite)
            .where(
                WorkspaceInvite.workspace_id == ws.id,
                WorkspaceInvite.accepted_at.is_(None),
                WorkspaceInvite.expires_at > datetime.now(timezone.utc),
            )
        )
    ).scalar_one()

    if member_count + pending_count >= seat_limit:
        if ws.plan_tier == "solo":
            raise HTTPException(
                status_code=403,
                detail="Solo plan supports 1 seat. Upgrade to Desk to invite team members.",
            )
        raise HTTPException(
            status_code=403,
            detail=f"Seat limit reached ({member_count + pending_count}/{seat_limit}). "
                   f"Upgrade your plan to add more members.",
        )

    # Check if user is already a member
    existing_user = (
        await db.execute(select(User).where(User.email == body.email))
    ).scalar_one_or_none()

    if existing_user:
        existing_member = (
            await db.execute(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.user_id == existing_user.id,
                )
            )
        ).scalar_one_or_none()
        if existing_member:
            raise HTTPException(status_code=409, detail="This user is already a member.")

    # Check for existing pending invite
    existing_invite = (
        await db.execute(
            select(WorkspaceInvite).where(
                WorkspaceInvite.workspace_id == ws.id,
                WorkspaceInvite.email == body.email,
                WorkspaceInvite.accepted_at.is_(None),
                WorkspaceInvite.expires_at > datetime.now(timezone.utc),
            )
        )
    ).scalar_one_or_none()
    if existing_invite:
        raise HTTPException(status_code=409, detail="An invite is already pending for this email.")

    invite = WorkspaceInvite(
        workspace_id=ws.id,
        email=body.email,
        role=body.role,
        invited_by=ctx.user.id,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    # Send invite email (best-effort)
    settings = get_settings()
    invite_url = f"{settings.app_url}/invite?token={invite.token}"
    inviter_name = ctx.user.full_name or ctx.user.email.split("@")[0]
    try:
        await send_workspace_invite_email(
            to=body.email,
            inviter_name=inviter_name,
            workspace_name=ws.name,
            invite_url=invite_url,
        )
    except Exception as exc:
        logger.warning("Invite email failed for %s: %s", body.email, exc)

    return InviteOut(
        id=str(invite.id),
        email=invite.email,
        role=invite.role,
        invited_by_email=ctx.user.email,
        expires_at=invite.expires_at.isoformat() if invite.expires_at else "",
        created_at=invite.created_at.isoformat() if invite.created_at else "",
    )


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> list[InviteOut]:
    """List pending invites (admin only)."""
    result = await db.execute(
        select(WorkspaceInvite)
        .where(
            WorkspaceInvite.workspace_id == ctx.workspace.id,
            WorkspaceInvite.accepted_at.is_(None),
            WorkspaceInvite.expires_at > datetime.now(timezone.utc),
        )
        .order_by(WorkspaceInvite.created_at.desc())
    )
    invites = result.scalars().all()

    # Fetch inviter emails in one query
    inviter_ids = {i.invited_by for i in invites if i.invited_by}
    inviter_map: dict[UUID, str] = {}
    if inviter_ids:
        users_result = await db.execute(
            select(User.id, User.email).where(User.id.in_(inviter_ids))
        )
        inviter_map = {uid: email for uid, email in users_result.all()}

    return [
        InviteOut(
            id=str(inv.id),
            email=inv.email,
            role=inv.role,
            invited_by_email=inviter_map.get(inv.invited_by) if inv.invited_by else None,
            expires_at=inv.expires_at.isoformat() if inv.expires_at else "",
            created_at=inv.created_at.isoformat() if inv.created_at else "",
        )
        for inv in invites
    ]


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite(
    invite_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Revoke a pending invite (admin only)."""
    invite = await db.get(WorkspaceInvite, invite_id)
    if not invite or invite.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Invite not found.")
    await db.delete(invite)
    await db.commit()


@router.patch("/members/{member_id}/role", response_model=MemberOut)
async def update_member_role(
    member_id: UUID,
    body: RoleUpdateRequest,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> MemberOut:
    """Change a member's role (admin only)."""
    if body.role not in ("admin", "analyst", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin, analyst, or viewer.")

    member = await db.get(WorkspaceMember, member_id)
    if not member or member.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Can't demote yourself if you're the last admin
    if member.user_id == ctx.user.id and body.role != "admin":
        admin_count = (
            await db.execute(
                select(func.count()).select_from(WorkspaceMember)
                .where(
                    WorkspaceMember.workspace_id == ctx.workspace.id,
                    WorkspaceMember.role == "admin",
                )
            )
        ).scalar_one()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last admin. Promote another member first.",
            )

    member.role = body.role
    await db.commit()
    await db.refresh(member)

    user = await db.get(User, member.user_id)
    return MemberOut(
        id=str(member.id),
        user_id=str(member.user_id),
        email=user.email if user else "",
        full_name=user.full_name if user else None,
        role=member.role,
        joined_at=member.joined_at.isoformat() if member.joined_at else "",
    )


@router.delete("/members/{member_id}", status_code=204)
async def remove_member(
    member_id: UUID,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Remove a member from the workspace (admin only)."""
    member = await db.get(WorkspaceMember, member_id)
    if not member or member.workspace_id != ctx.workspace.id:
        raise HTTPException(status_code=404, detail="Member not found.")

    # Can't remove yourself if you're the last admin
    if member.user_id == ctx.user.id:
        admin_count = (
            await db.execute(
                select(func.count()).select_from(WorkspaceMember)
                .where(
                    WorkspaceMember.workspace_id == ctx.workspace.id,
                    WorkspaceMember.role == "admin",
                )
            )
        ).scalar_one()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last admin. Promote another member first.",
            )

    # If the removed user's active workspace pointed here, clear it
    removed_user = await db.get(User, member.user_id)
    if removed_user and removed_user.active_workspace_id == ctx.workspace.id:
        removed_user.active_workspace_id = None

    await db.delete(member)
    await db.commit()


@router.post("/accept-invite", status_code=200)
@limiter.limit("20/hour")
async def accept_invite(
    request: Request,
    body: AcceptInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Accept a workspace invite using the token from the email link.

    The user must be logged in. If they registered after receiving the invite,
    they accept once their account is ready. Returns workspace info on success.
    """
    invite = (
        await db.execute(
            select(WorkspaceInvite).where(WorkspaceInvite.token == body.token)
        )
    ).scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or has expired.")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="This invite has already been accepted.")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This invite has expired. Ask the admin to resend.")

    # Check email matches (case-insensitive)
    if current_user.email.lower() != invite.email.lower():
        raise HTTPException(
            status_code=403,
            detail="This invite was sent to a different email address.",
        )

    # Check if already a member
    existing = (
        await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == invite.workspace_id,
                WorkspaceMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        invite.accepted_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "already_member", "workspace_id": str(invite.workspace_id)}

    # Create membership
    membership = WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        role=invite.role,
    )
    db.add(membership)
    invite.accepted_at = datetime.now(timezone.utc)

    # Switch the user's active workspace to the new one
    current_user.active_workspace_id = invite.workspace_id

    await db.commit()

    workspace = await db.get(Workspace, invite.workspace_id)

    # Log activity
    await log_activity(
        db=db,
        workspace_id=invite.workspace_id,
        actor_user_id=current_user.id,
        event_type="member_joined",
        summary=f"{current_user.full_name or current_user.email} joined the workspace",
        details={"role": invite.role},
    )
    await db.commit()

    return {
        "status": "joined",
        "workspace_id": str(invite.workspace_id),
        "workspace_name": workspace.name if workspace else "",
        "role": invite.role,
    }


@router.patch("/workspace", response_model=WorkspaceInfoOut)
async def rename_workspace(
    body: dict,
    ctx: WorkspaceContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> WorkspaceInfoOut:
    """Rename the workspace (admin only)."""
    new_name = body.get("name", "").strip()
    if not new_name or len(new_name) > 100:
        raise HTTPException(status_code=400, detail="Name must be 1-100 characters.")
    ctx.workspace.name = new_name
    await db.commit()

    member_count = (
        await db.execute(
            select(func.count()).select_from(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == ctx.workspace.id)
        )
    ).scalar_one()

    return WorkspaceInfoOut(
        id=str(ctx.workspace.id),
        name=ctx.workspace.name,
        plan_tier=ctx.workspace.plan_tier,
        member_count=member_count,
        seat_limit=SEAT_LIMITS.get(ctx.workspace.plan_tier, 1),
    )
