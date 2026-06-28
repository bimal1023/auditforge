"use client";

import { useCallback, useEffect, useState } from "react";
import {
  User as UserIcon, Lock, CreditCard, AlertTriangle,
  Check, Eye, EyeOff, LogOut, Shield, Loader2, Building2,
} from "lucide-react";
import { apiFetch, clearToken } from "@/lib/auth";

/* ── Types ──────────────────────────────────────────────────── */

interface Props {
  planTier: string;
  credits: number | null;
  onRefreshCredits: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  memo_credits: number;
  plan_tier: string;
  subscription_status: string | null;
  current_period_end: string | null;
  is_verified: boolean;
  created_at: string | null;
  workspace_name: string | null;
  workspace_role: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo",
  desk: "Desk",
  firm: "Firm",
};

const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  solo: { bg: "var(--n50)", fg: "var(--n600)" },
  desk: { bg: "var(--b50)", fg: "var(--b700)" },
  firm: { bg: "var(--p50)", fg: "var(--p700)" },
};

const PLAN_CREDITS: Record<string, number> = {
  solo: 3,
  desk: 100,
  firm: 999_999,
};

/* ── Styles ─────────────────────────────────────────────────── */

const card: React.CSSProperties = {
  background: "var(--n0)",
  border: "1px solid var(--n50)",
  borderRadius: "var(--r-2)",
  padding: "var(--s-300)",
  marginBottom: "var(--s-200)",
};

const cardTitle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 14, fontWeight: 700, color: "var(--n900)",
  marginBottom: "var(--s-200)",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--n500)",
  marginBottom: 4, display: "block",
};

const fieldInput: React.CSSProperties = {
  width: "100%", maxWidth: 360, padding: "8px 12px",
  fontSize: 13, borderRadius: "var(--r-1)",
  border: "1px solid var(--n100)", background: "var(--n0)",
  color: "var(--n900)", outline: "none",
};

const fieldRow: React.CSSProperties = {
  marginBottom: "var(--s-150)",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  borderRadius: "var(--r-1)", border: "none", cursor: "pointer",
  background: "var(--b600)", color: "#fff",
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: "var(--r600)",
};

const btnOutline: React.CSSProperties = {
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  borderRadius: "var(--r-1)", cursor: "pointer",
  background: "transparent", color: "var(--n600)",
  border: "1px solid var(--n100)",
};

const toast: React.CSSProperties = {
  position: "fixed", bottom: 24, right: 24,
  padding: "10px 20px", borderRadius: "var(--r-1)",
  fontSize: 13, fontWeight: 600, zIndex: 9999,
  boxShadow: "var(--e-2)",
};

/* ── Component ──────────────────────────────────────────────── */

export function SettingsView({ planTier, credits, onRefreshCredits }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Organization (workspace) form
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Billing
  const [billingLoading, setBillingLoading] = useState(false);

  // Toast
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = useCallback((text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }, []);

  // Load profile on mount
  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setProfile(data);
        setFullName(data.full_name || "");
        setWorkspaceName(data.workspace_name || "");
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Profile save ──── */
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await apiFetch("/api/v1/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        flash("Profile updated", true);
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Failed to update profile", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setSavingProfile(false);
    }
  };

  /* ── Workspace rename (admin only) ──── */
  const handleSaveWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) { flash("Workspace name can't be empty", false); return; }
    setSavingWorkspace(true);
    try {
      const res = await apiFetch("/api/v1/team/workspace", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceName(data.name);
        setProfile((p) => (p ? { ...p, workspace_name: data.name } : p));
        flash("Organization updated", true);
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Failed to update organization", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setSavingWorkspace(false);
    }
  };

  /* ── Password change ──── */
  const handleChangePw = async () => {
    if (newPw !== confirmPw) { flash("Passwords don't match", false); return; }
    if (newPw.length < 8) { flash("Password must be at least 8 characters", false); return; }
    setSavingPw(true);
    try {
      const res = await apiFetch("/api/v1/auth/password", {
        method: "PUT",
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (res.ok || res.status === 204) {
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        flash("Password changed", true);
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Failed to change password", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setSavingPw(false);
    }
  };

  /* ── Billing actions ──── */
  const handleUpgrade = async () => {
    setBillingLoading(true);
    try {
      const res = await apiFetch("/api/v1/billing/checkout", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.checkout_url) window.location.href = data.checkout_url;
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Could not start checkout", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const res = await apiFetch("/api/v1/billing/portal", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.portal_url) window.location.href = data.portal_url;
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Could not open billing portal", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setBillingLoading(false);
    }
  };

  /* ── Delete account ──── */
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch("/api/v1/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePw }),
      });
      if (res.ok || res.status === 204) {
        clearToken();
        window.location.href = "/login";
      } else {
        const err = await res.json().catch(() => null);
        flash(err?.detail || "Failed to delete account", false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--n300)" }} />
      </div>
    );
  }

  const isWorkspaceAdmin = profile?.workspace_role === "admin";
  const tier = profile?.plan_tier || planTier;
  const pc = PLAN_COLORS[tier] || PLAN_COLORS.solo;
  const isActive = profile?.subscription_status === "active" || profile?.subscription_status === "trialing";
  const creditCap = PLAN_CREDITS[tier] || 3;
  const creditPct = credits != null ? Math.min(100, Math.round((credits / creditCap) * 100)) : 0;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* ── Profile ──────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>
          <UserIcon size={16} /> Profile
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>Display name</label>
          <input
            style={fieldInput}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
          />
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>Email</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              style={{ ...fieldInput, background: "var(--n25)", color: "var(--n400)" }}
              value={profile?.email || ""}
              disabled
            />
            {profile?.is_verified && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 11, fontWeight: 700, color: "var(--g700)",
                background: "var(--g50)", padding: "2px 8px",
                borderRadius: "var(--r-1)", whiteSpace: "nowrap",
              }}>
                <Check size={10} /> Verified
              </span>
            )}
          </div>
        </div>

        {profile?.created_at && (
          <div style={{ fontSize: 12, color: "var(--n300)", marginBottom: "var(--s-100)" }}>
            Member since {new Date(profile.created_at).toLocaleDateString("en-US", {
              month: "long", year: "numeric",
            })}
          </div>
        )}

        <button
          style={{ ...btnPrimary, opacity: savingProfile ? 0.6 : 1 }}
          onClick={handleSaveProfile}
          disabled={savingProfile}
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </div>

      {/* ── Organization ─────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>
          <Building2 size={16} /> Organization
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>Firm / company name</label>
          <input
            style={{ ...fieldInput, ...(isWorkspaceAdmin ? {} : { background: "var(--n25)", color: "var(--n400)" }) }}
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Your firm's name"
            maxLength={100}
            disabled={!isWorkspaceAdmin}
          />
          <div style={{ fontSize: 12, color: "var(--n300)", marginTop: 6 }}>
            {isWorkspaceAdmin
              ? "Shown across the app and on exported reports."
              : "Only a workspace admin can change this."}
          </div>
        </div>

        {isWorkspaceAdmin && (
          <button
            style={{ ...btnPrimary, opacity: savingWorkspace ? 0.6 : 1 }}
            onClick={handleSaveWorkspace}
            disabled={savingWorkspace}
          >
            {savingWorkspace ? "Saving…" : "Save organization"}
          </button>
        )}
      </div>

      {/* ── Security ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>
          <Lock size={16} /> Security
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>Current password</label>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              style={fieldInput}
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--n300)",
              }}
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>New password</label>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              style={fieldInput}
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--n300)",
              }}
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div style={fieldRow}>
          <label style={fieldLabel}>Confirm new password</label>
          <input
            style={fieldInput}
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Repeat new password"
          />
          {confirmPw && newPw && confirmPw !== newPw && (
            <span style={{ fontSize: 11, color: "var(--r600)", marginTop: 2, display: "block" }}>
              Passwords don&apos;t match
            </span>
          )}
        </div>

        <button
          style={{
            ...btnPrimary,
            opacity: (!currentPw || !newPw || !confirmPw || savingPw) ? 0.5 : 1,
          }}
          onClick={handleChangePw}
          disabled={!currentPw || !newPw || !confirmPw || savingPw}
        >
          {savingPw ? "Changing…" : "Change password"}
        </button>
      </div>

      {/* ── Plan & Billing ───────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>
          <CreditCard size={16} /> Plan & billing
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: "var(--s-200)",
        }}>
          {/* Plan badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 12px", borderRadius: "var(--r-1)",
            background: pc.bg, color: pc.fg,
            fontSize: 13, fontWeight: 700,
          }}>
            <Shield size={12} /> {PLAN_LABELS[tier] || tier}
          </span>

          {/* Status */}
          {isActive && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--g700)",
              background: "var(--g50)", padding: "2px 8px",
              borderRadius: "var(--r-1)",
            }}>
              Active
            </span>
          )}
          {profile?.subscription_status === "trialing" && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--b700)",
              background: "var(--b50)", padding: "2px 8px",
              borderRadius: "var(--r-1)",
            }}>
              Trial
            </span>
          )}
        </div>

        {/* Credit gauge */}
        <div style={{ marginBottom: "var(--s-200)" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--n500)" }}>
              Memo credits
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900)" }}>
              {credits ?? "—"} <span style={{ fontWeight: 400, color: "var(--n300)" }}>/ {creditCap}</span>
            </span>
          </div>
          <div style={{
            height: 6, borderRadius: 3, background: "var(--n50)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${creditPct}%`,
              background: creditPct < 20 ? "var(--r500)" : creditPct < 50 ? "var(--y500)" : "var(--g500)",
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>

        {/* Period end */}
        {profile?.current_period_end && (
          <div style={{ fontSize: 12, color: "var(--n400)", marginBottom: "var(--s-200)" }}>
            Current period ends {new Date(profile.current_period_end).toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            })}
          </div>
        )}

        {/* Billing actions */}
        <div style={{ display: "flex", gap: 8 }}>
          {tier === "solo" ? (
            <button
              style={{ ...btnPrimary, opacity: billingLoading ? 0.6 : 1 }}
              onClick={handleUpgrade}
              disabled={billingLoading}
            >
              {billingLoading ? "Loading…" : "Upgrade to Desk — $399/mo"}
            </button>
          ) : (
            <button
              style={{ ...btnOutline, opacity: billingLoading ? 0.6 : 1 }}
              onClick={handleManageBilling}
              disabled={billingLoading}
            >
              {billingLoading ? "Loading…" : "Manage subscription"}
            </button>
          )}
        </div>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────── */}
      <div style={{
        ...card,
        borderColor: "var(--r200)",
      }}>
        <div style={{ ...cardTitle, color: "var(--r700)" }}>
          <AlertTriangle size={16} /> Danger zone
        </div>
        <p style={{ fontSize: 13, color: "var(--n500)", marginBottom: "var(--s-200)", lineHeight: 1.5 }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        {!deleteOpen ? (
          <button
            style={{
              ...btnOutline,
              borderColor: "var(--r200)", color: "var(--r600)",
            }}
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </button>
        ) : (
          <div style={{
            padding: "var(--s-200)", borderRadius: "var(--r-1)",
            background: "var(--r50)", border: "1px solid var(--r200)",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--r700)", marginBottom: 12 }}>
              Confirm account deletion
            </p>
            <div style={fieldRow}>
              <label style={{ ...fieldLabel, color: "var(--r600)" }}>
                Enter your password to confirm
              </label>
              <input
                style={{ ...fieldInput, borderColor: "var(--r200)" }}
                type="password"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                placeholder="Your password"
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  ...btnDanger,
                  opacity: (!deletePw || deleting) ? 0.5 : 1,
                }}
                onClick={handleDeleteAccount}
                disabled={!deletePw || deleting}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                style={btnOutline}
                onClick={() => { setDeleteOpen(false); setDeletePw(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ──────────────────────────────────────── */}
      {msg && (
        <div style={{
          ...toast,
          background: msg.ok ? "var(--g700)" : "var(--r700)",
          color: "#fff",
        }}>
          {msg.ok ? <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> : null}
          {msg.text}
        </div>
      )}
    </div>
  );
}
