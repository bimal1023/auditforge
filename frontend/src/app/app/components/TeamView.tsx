"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, Mail, Shield, Eye, Pencil, Trash2, Plus,
  Loader2, Check, X, Clock, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";
import type {
  WorkspaceMember, WorkspaceInvite, WorkspaceInfo, WorkspaceRole,
} from "@/lib/types";

/* ── Styles ──────────────────────────────────────────────────── */

const card: React.CSSProperties = {
  background: "var(--n0)", border: "1px solid var(--n100)",
  borderRadius: 10, padding: "20px 24px", marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: "var(--n900)",
  marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
  borderBottom: "1px solid var(--n50)",
};
const avatar: React.CSSProperties = {
  width: 32, height: 32, borderRadius: "50%", background: "var(--b50)",
  color: "var(--b700)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0,
};
const roleBadge = (role: WorkspaceRole): React.CSSProperties => {
  const map: Record<WorkspaceRole, { bg: string; fg: string }> = {
    admin: { bg: "var(--b50)", fg: "var(--b700)" },
    analyst: { bg: "var(--t50)", fg: "var(--t700)" },
    viewer: { bg: "var(--n50)", fg: "var(--n600)" },
  };
  const c = map[role] ?? map.viewer;
  return {
    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
    background: c.bg, color: c.fg, textTransform: "capitalize",
  };
};
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
  cursor: "pointer", border: "none",
};
const primaryBtn: React.CSSProperties = {
  ...btn, background: "var(--b600)", color: "#fff",
};
const ghostBtn: React.CSSProperties = {
  ...btn, background: "transparent", color: "var(--n500)", padding: "4px 8px",
};
const input: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 6, border: "1px solid var(--n200)",
  fontSize: 13, outline: "none", flex: 1, minWidth: 0,
};
const select: React.CSSProperties = {
  ...input, flex: "0 0 auto", width: 120, cursor: "pointer",
};

/* ── Props ───────────────────────────────────────────────────── */

interface Props {
  workspaceRole?: string;
}

/* ── Component ───────────────────────────────────────────────── */

export function TeamView({ workspaceRole }: Props) {
  const isAdmin = workspaceRole === "admin";
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [wsInfo, setWsInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<WorkspaceRole>("analyst");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, iRes, wRes] = await Promise.all([
        apiFetch("/api/v1/team/members"),
        isAdmin ? apiFetch("/api/v1/team/invites") : Promise.resolve(null),
        apiFetch("/api/v1/team/info"),
      ]);

      if (mRes.ok) setMembers(await mRes.json());
      if (iRes?.ok) setInvites(await iRes.json());
      if (wRes.ok) setWsInfo(await wRes.json());
    } catch {
      setError("Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!invEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await apiFetch("/api/v1/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail.trim(), role: invRole }),
      });
      if (res.ok) {
        setInviteMsg("Invite sent!");
        setInvEmail("");
        fetchAll();
      } else {
        const data = await res.json().catch(() => null);
        setInviteMsg(data?.detail || "Failed to send invite.");
      }
    } catch {
      setInviteMsg("Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    await apiFetch(`/api/v1/team/invites/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    await apiFetch(`/api/v1/team/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    fetchAll();
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the workspace?")) return;
    await apiFetch(`/api/v1/team/members/${memberId}`, { method: "DELETE" });
    fetchAll();
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, color: "var(--n400)" }}>
        <Loader2 size={16} className="spin" /> Loading team...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {error && (
        <div style={{ ...card, borderColor: "var(--r200)", background: "var(--r50)", color: "var(--r700)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Workspace summary */}
      {wsInfo && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: "var(--b600)" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--n900)" }}>{wsInfo.name}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--n500)" }}>
            {wsInfo.member_count} / {wsInfo.seat_limit} seats
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "var(--b50)", color: "var(--b700)", textTransform: "capitalize",
          }}>
            {wsInfo.plan_tier} plan
          </span>
        </div>
      )}

      {/* Members */}
      <div style={card}>
        <div style={sectionTitle}>
          <Shield size={15} /> Members ({members.length})
        </div>
        {members.map((m) => {
          const initials = (m.full_name || m.email)
            .split(/[@\s]/)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <div key={m.id} style={row}>
              <div style={avatar}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--n900)" }}>
                  {m.full_name || m.email.split("@")[0]}
                </div>
                <div style={{ fontSize: 12, color: "var(--n400)" }}>{m.email}</div>
              </div>

              {isAdmin ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select
                    style={{ ...select, width: 100, fontSize: 12, padding: "4px 8px" }}
                    value={m.role}
                    onChange={(e) => handleChangeRole(m.id, e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button style={ghostBtn} onClick={() => handleRemoveMember(m.id)} title="Remove">
                    <Trash2 size={13} style={{ color: "var(--r500)" }} />
                  </button>
                </div>
              ) : (
                <span style={roleBadge(m.role)}>{m.role}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <div style={card}>
          <div style={sectionTitle}>
            <Mail size={15} /> Invite team member
          </div>
          <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={input}
              type="email"
              placeholder="colleague@company.com"
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              required
            />
            <select style={select} value={invRole} onChange={(e) => setInvRole(e.target.value as WorkspaceRole)}>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" style={primaryBtn} disabled={inviting}>
              {inviting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Send invite
            </button>
          </form>
          {inviteMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: inviteMsg.includes("sent") ? "var(--g600)" : "var(--r600)" }}>
              {inviteMsg.includes("sent") ? <Check size={12} /> : <X size={12} />} {inviteMsg}
            </div>
          )}
        </div>
      )}

      {/* Pending invites (admin only) */}
      {isAdmin && invites.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>
            <Clock size={15} /> Pending invites ({invites.length})
          </div>
          {invites.map((inv) => (
            <div key={inv.id} style={row}>
              <div style={{ ...avatar, background: "var(--y50)", color: "var(--y700)" }}>
                <Mail size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--n900)" }}>{inv.email}</div>
                <div style={{ fontSize: 11, color: "var(--n400)" }}>
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                  {inv.invited_by_email && ` · Invited by ${inv.invited_by_email.split("@")[0]}`}
                </div>
              </div>
              <span style={roleBadge(inv.role)}>{inv.role}</span>
              <button style={ghostBtn} onClick={() => handleRevokeInvite(inv.id)} title="Revoke">
                <X size={13} style={{ color: "var(--r500)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade nudge for solo users */}
      {wsInfo && wsInfo.seat_limit <= 1 && (
        <div style={{
          ...card, background: "var(--b50)", borderColor: "var(--b200)",
          textAlign: "center", padding: "28px 24px",
        }}>
          <Users size={20} style={{ color: "var(--b600)", marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--n900)", marginBottom: 4 }}>
            Invite your team
          </div>
          <div style={{ fontSize: 13, color: "var(--n500)", marginBottom: 16 }}>
            Upgrade to Desk to add up to 5 team members and share memos, credits, and documents.
          </div>
          <button
            style={primaryBtn}
            onClick={async () => {
              const res = await apiFetch("/api/v1/billing/checkout", { method: "POST" });
              if (res.ok) {
                const data = await res.json();
                if (data.checkout_url) window.location.href = data.checkout_url;
              }
            }}
          >
            Upgrade to Desk
          </button>
        </div>
      )}
    </div>
  );
}
