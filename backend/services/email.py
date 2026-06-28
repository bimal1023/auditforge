"""Resend email integration.

Sends transactional emails (password reset, welcome) by calling the Resend
REST API directly via httpx — no extra SDK needed.

If `resend_api_key` is empty, all send_* functions log a warning and return
False without raising. This lets dev environments run without configuration
and keeps the auth endpoints usable when email is offline.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_RESEND_API = "https://api.resend.com/emails"


async def _send_email(
    *, to: str, subject: str, html: str, text: Optional[str] = None,
) -> bool:
    """Low-level send. Returns True on 2xx, False otherwise. Never raises."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("Resend API key not set; skipping email to %s (%s)", to, subject)
        return False

    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                _RESEND_API,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
        if r.status_code >= 300:
            logger.error("Resend send failed (%s): %s", r.status_code, r.text)
            return False
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Resend exception sending to %s: %s", to, exc)
        return False


# ── High-level templates ─────────────────────────────────────────────────────

async def send_password_reset_email(*, to: str, reset_url: str) -> bool:
    """Send a one-time reset link. Link expires in 15 minutes server-side."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #172B4D;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg,#0C66E4 0%,#08458C 100%); border-radius: 8px; line-height: 48px; color: #fff; font-weight: 700; font-size: 22px;">A</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #091E42; margin: 0 0 16px;">Reset your password</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #44546F;">
        We received a request to reset the password on your Arthvion account.
        Click the button below to set a new one — the link expires in 15 minutes.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{reset_url}" style="display: inline-block; background: #0C66E4; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px;">
          Reset password
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #626F86;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #0C66E4; word-break: break-all;">{reset_url}</span>
      </p>
      <hr style="border: none; border-top: 1px solid #DCDFE4; margin: 32px 0;" />
      <p style="font-size: 12px; color: #8590A2; line-height: 1.5;">
        Didn't request this? You can safely ignore this email — your password won't change.
        If you keep getting these, contact support.
      </p>
    </div>
    """
    text = (
        "Reset your Arthvion password\n\n"
        f"Visit this link to set a new password (expires in 15 minutes):\n{reset_url}\n\n"
        "If you didn't request this, you can ignore this email."
    )
    return await _send_email(
        to=to, subject="Reset your Arthvion password", html=html, text=text,
    )


async def send_welcome_email(*, to: str) -> bool:
    """Send a confirmation/welcome email after successful registration."""
    settings = get_settings()
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #172B4D;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg,#0C66E4 0%,#08458C 100%); border-radius: 8px; line-height: 48px; color: #fff; font-weight: 700; font-size: 22px;">A</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #091E42; margin: 0 0 16px;">Welcome to Arthvion</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #44546F;">
        Your account is ready. You have <strong>3 free memo credits</strong> on the Solo plan —
        enough to spin up your first diligence runs and see the output for yourself.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{settings.app_url}/app" style="display: inline-block; background: #0C66E4; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px;">
          Open the dashboard
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #626F86;">
        Four specialist agents will pull SEC filings, market intelligence, and litigation
        records in parallel — your first memo lands in about three minutes.
      </p>
      <hr style="border: none; border-top: 1px solid #DCDFE4; margin: 32px 0;" />
      <p style="font-size: 12px; color: #8590A2; line-height: 1.5;">
        Questions? Just reply to this email — it goes to a real person.
      </p>
    </div>
    """
    text = (
        "Welcome to Arthvion!\n\n"
        f"Your account is ready. Open the dashboard at {settings.app_url}/app\n\n"
        "You have 3 free memo credits on the Solo plan."
    )
    return await _send_email(
        to=to, subject="Welcome to Arthvion", html=html, text=text,
    )


async def send_verification_email(*, to: str, verify_url: str) -> bool:
    """Sent immediately after registration. User must click the link before login.

    Combines welcome + verification into a single email so we don't bombard
    users on day zero. The link expires in 24 hours.
    """
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #172B4D;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg,#0C66E4 0%,#08458C 100%); border-radius: 8px; line-height: 48px; color: #fff; font-weight: 700; font-size: 22px;">A</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #091E42; margin: 0 0 16px;">Welcome to Arthvion — one last step</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #44546F;">
        Thanks for signing up. To activate your account and start generating diligence memos,
        please confirm this is your email address. The link expires in 24 hours.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{verify_url}" style="display: inline-block; background: #0C66E4; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px;">
          Verify my email
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #626F86;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #0C66E4; word-break: break-all;">{verify_url}</span>
      </p>
      <hr style="border: none; border-top: 1px solid #DCDFE4; margin: 32px 0;" />
      <p style="font-size: 13px; line-height: 1.6; color: #626F86;">
        Once verified you&rsquo;ll have <strong>3 free memo credits</strong> on the Solo plan —
        four specialist agents pull SEC filings, market intelligence, and litigation records
        in parallel. First memo lands in about three minutes.
      </p>
      <p style="font-size: 12px; color: #8590A2; line-height: 1.5; margin-top: 32px;">
        Didn&rsquo;t sign up? You can safely ignore this email — no account will be created
        unless this link is clicked.
      </p>
    </div>
    """
    text = (
        "Welcome to Arthvion — please verify your email\n\n"
        f"Click this link to activate your account (expires in 24 hours):\n{verify_url}\n\n"
        "If you didn't sign up, you can ignore this email."
    )
    return await _send_email(
        to=to, subject="Verify your Arthvion email", html=html, text=text,
    )


async def send_workspace_invite_email(
    *, to: str, inviter_name: str, workspace_name: str, invite_url: str,
) -> bool:
    """Invite someone to join a workspace. Link expires in 7 days."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #172B4D;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg,#0C66E4 0%,#08458C 100%); border-radius: 8px; line-height: 48px; color: #fff; font-weight: 700; font-size: 22px;">A</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #091E42; margin: 0 0 16px;">You&rsquo;re invited to join a team</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #44546F;">
        <strong>{inviter_name}</strong> has invited you to join <strong>{workspace_name}</strong> on Arthvion —
        a multi-agent PE due diligence platform. Click below to accept the invitation.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{invite_url}" style="display: inline-block; background: #0C66E4; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px;">
          Accept invitation
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #626F86;">
        Or copy and paste this link into your browser:<br>
        <span style="color: #0C66E4; word-break: break-all;">{invite_url}</span>
      </p>
      <hr style="border: none; border-top: 1px solid #DCDFE4; margin: 32px 0;" />
      <p style="font-size: 12px; color: #8590A2; line-height: 1.5;">
        This invitation expires in 7 days. If you don&rsquo;t have an Arthvion account yet,
        you&rsquo;ll be asked to create one first.
      </p>
    </div>
    """
    text = (
        f"You're invited to join {workspace_name} on Arthvion\n\n"
        f"{inviter_name} has invited you. Accept the invitation:\n{invite_url}\n\n"
        "This link expires in 7 days."
    )
    return await _send_email(
        to=to,
        subject=f"{inviter_name} invited you to {workspace_name} on Arthvion",
        html=html,
        text=text,
    )


async def send_report_to_team_email(
    *, to_list: list[str], report_company: str, sender_name: str, report_url: str,
) -> int:
    """Send a report link to one or more team members. Returns count of emails sent."""
    sent = 0
    for addr in to_list:
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #172B4D;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg,#0C66E4 0%,#08458C 100%); border-radius: 8px; line-height: 48px; color: #fff; font-weight: 700; font-size: 22px;">A</div>
          </div>
          <h1 style="font-size: 22px; font-weight: 700; color: #091E42; margin: 0 0 16px;">New memo shared with you</h1>
          <p style="font-size: 14px; line-height: 1.6; color: #44546F;">
            <strong>{sender_name}</strong> shared a due diligence memo for <strong>{report_company}</strong> with you.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="{report_url}" style="display: inline-block; background: #0C66E4; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px;">
              View memo
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #DCDFE4; margin: 32px 0;" />
          <p style="font-size: 12px; color: #8590A2; line-height: 1.5;">
            You&rsquo;re receiving this because you&rsquo;re a member of the same workspace on Arthvion.
          </p>
        </div>
        """
        text = (
            f"{sender_name} shared a memo for {report_company} with you.\n\n"
            f"View it here: {report_url}"
        )
        ok = await _send_email(
            to=addr,
            subject=f"Memo: {report_company} — shared by {sender_name}",
            html=html,
            text=text,
        )
        if ok:
            sent += 1
    return sent
