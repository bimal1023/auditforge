"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ListChecks, Sparkles, Plus, Check, X, RotateCw, Trash2,
  BarChart2, Scale, Globe, ShieldAlert, Users, Wrench,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "../ui";
import type { DealAction, ActionCategory, ActionPriority } from "@/lib/types";

interface Props {
  reportId: string;
  isComplete: boolean;
}

/* ── Category + priority metadata ────────────────────────────── */

const CAT: Record<ActionCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  financial:   { label: "Financial",   icon: BarChart2,   color: "var(--brand)",  bg: "var(--brand-soft)" },
  legal:       { label: "Legal",       icon: Scale,       color: "var(--teal)",   bg: "var(--teal-soft)" },
  market:      { label: "Market",      icon: Globe,       color: "var(--green)",  bg: "var(--green-soft)" },
  risk:        { label: "Risk",        icon: ShieldAlert, color: "var(--amber)",  bg: "var(--amber-soft)" },
  management:  { label: "Management",  icon: Users,       color: "var(--purple)", bg: "var(--purple-soft)" },
  operational: { label: "Operational", icon: Wrench,      color: "var(--ink-3)", bg: "var(--surface-2)" },
};

const PRIO: Record<ActionPriority, { label: string; color: string; ink: string; bg: string }> = {
  high:   { label: "High",   color: "var(--red)",   ink: "var(--red-ink)",   bg: "var(--red-soft)" },
  medium: { label: "Medium", color: "var(--amber)", ink: "var(--amber-ink)", bg: "var(--amber-soft)" },
  low:    { label: "Low",    color: "var(--ink-4)", ink: "var(--ink-3)",     bg: "var(--surface-2)" },
};

const PRIO_ORDER: ActionPriority[] = ["high", "medium", "low"];

/* ── Component ───────────────────────────────────────────────── */

export function ActionQueue({ reportId, isComplete }: Props) {
  const [actions, setActions] = useState<DealAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/v1/reports/${reportId}/actions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DealAction[]) => setActions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/reports/${reportId}/actions/generate`, { method: "POST" });
      if (res.ok) {
        setActions(await res.json());
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.detail ?? "Generation failed. Please try again.");
      }
    } catch {
      setError("Generation failed. Please try again.");
    } finally { setGenerating(false); }
  }

  async function patch(id: string, status: DealAction["status"]) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await apiFetch(`/api/v1/actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch(() => load());
  }

  async function remove(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    await apiFetch(`/api/v1/actions/${id}`, { method: "DELETE" }).catch(() => load());
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await apiFetch(`/api/v1/reports/${reportId}/actions`, {
      method: "POST",
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      const created: DealAction = await res.json();
      setActions((prev) => [...prev, created]);
      setNewTitle(""); setAdding(false);
    }
  }

  /* ── Not yet complete ─────────────────────────────────────── */
  if (!isComplete) {
    return (
      <Empty icon={ListChecks} title="No action queue yet"
        body="The action queue becomes available once the report finishes generating." />
    );
  }

  if (loading) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>;
  }

  const active = actions.filter((a) => a.status === "open" || a.status === "in_progress");
  const closed = actions.filter((a) => a.status === "done" || a.status === "dismissed");
  const trackable = actions.filter((a) => a.status !== "dismissed");
  const doneCount = actions.filter((a) => a.status === "done").length;
  const pct = trackable.length ? Math.round((doneCount / trackable.length) * 100) : 0;

  /* ── Empty (no actions generated yet) ─────────────────────── */
  if (actions.length === 0) {
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Sparkles size={22} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            Turn findings into next steps
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 420, lineHeight: 1.6, margin: "0 0 18px" }}>
            Generate a prioritized list of concrete diligence actions — each tied to a specific finding in this report.
          </p>
          <button onClick={generate} disabled={generating} style={primaryBtn(generating)}>
            {generating ? <><Spinner size={13} color="#fff" /> Generating…</> : <><Sparkles size={14} /> Generate action queue</>}
          </button>
          {error && <div style={{ marginTop: 14, fontSize: 12, color: "var(--red-ink)" }}>{error}</div>}
        </div>
      </div>
    );
  }

  /* ── Populated ────────────────────────────────────────────── */
  return (
    <div>
      {/* Header: progress + regenerate */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {doneCount} of {trackable.length} complete
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>· {active.length} open</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "var(--green)", transition: "width 0.3s" }} />
          </div>
        </div>
        <button onClick={generate} disabled={generating} style={ghostBtn(generating)} title="Regenerate from report">
          {generating ? <Spinner size={13} /> : <RotateCw size={13} />} Regenerate
        </button>
      </div>

      {error && <div style={{ marginBottom: 12, fontSize: 12, color: "var(--red-ink)" }}>{error}</div>}

      {/* Active actions grouped by priority */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {PRIO_ORDER.map((prio) => {
          const items = active.filter((a) => a.priority === prio);
          if (items.length === 0) return null;
          const p = PRIO[prio];
          return (
            <div key={prio}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: p.ink }}>
                  {p.label} priority
                </span>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: p.bg, color: p.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((a) => <ActionCard key={a.id} a={a} onToggle={patch} onDismiss={patch} onDelete={remove} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add manual action */}
      <div style={{ marginTop: 16 }}>
        {adding ? (
          <form onSubmit={addManual} style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Describe a task…"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, outline: "none" }}
            />
            <button type="submit" disabled={!newTitle.trim()} style={primaryBtn(!newTitle.trim())}>Add</button>
            <button type="button" onClick={() => { setAdding(false); setNewTitle(""); }} style={ghostBtn(false)}>Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            <Plus size={14} /> Add your own action
          </button>
        )}
      </div>

      {/* Completed & dismissed */}
      {closed.length > 0 && (
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 9 }}>
            Completed & dismissed ({closed.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {closed.map((a) => <ActionCard key={a.id} a={a} muted onToggle={patch} onDismiss={patch} onDelete={remove} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Action card ─────────────────────────────────────────────── */

function ActionCard({
  a, muted, onToggle, onDismiss, onDelete,
}: {
  a: DealAction; muted?: boolean;
  onToggle: (id: string, s: DealAction["status"]) => void;
  onDismiss: (id: string, s: DealAction["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const cat = CAT[a.category] ?? CAT.operational;
  const CatIcon = cat.icon;
  const p = PRIO[a.priority] ?? PRIO.medium;
  const isDone = a.status === "done";
  const isDismissed = a.status === "dismissed";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12,
      padding: "13px 15px",
      background: muted ? "var(--surface-2)" : "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: muted ? "1px solid var(--border)" : `3px solid ${p.color}`,
      borderRadius: 10, alignItems: "flex-start",
      opacity: isDismissed ? 0.6 : 1,
    }}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(a.id, isDone ? "open" : "done")}
        title={isDone ? "Mark as open" : "Mark as done"}
        style={{
          width: 20, height: 20, marginTop: 1, borderRadius: 6,
          border: `1.5px solid ${isDone ? "var(--green)" : "var(--border-strong)"}`,
          background: isDone ? "var(--green)" : "transparent",
          color: "#fff", cursor: "pointer", flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}
      >
        {isDone && <Check size={13} />}
      </button>

      {/* Content */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4,
          textDecoration: isDone || isDismissed ? "line-through" : "none",
        }}>{a.title}</div>
        {a.description && !muted && (
          <p style={{ margin: "0 0 6px", fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{a.description}</p>
        )}
        {a.rationale && !muted && (
          <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic", paddingLeft: 9, borderLeft: "2px solid var(--border)", lineHeight: 1.5 }}>
            {a.rationale}
          </div>
        )}
        {!muted && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: cat.color, background: cat.bg, padding: "2px 7px", borderRadius: 6 }}>
              <CatIcon size={10} /> {cat.label}
            </span>
            {a.origin === "manual" && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)" }}>added by you</span>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {!isDismissed && !muted && (
          <button onClick={() => onDismiss(a.id, "dismissed")} title="Dismiss"
            style={iconBtn}><X size={13} /></button>
        )}
        {isDismissed && (
          <button onClick={() => onToggle(a.id, "open")} title="Restore"
            style={iconBtn}><RotateCw size={12} /></button>
        )}
        <button onClick={() => onDelete(a.id)} title="Delete"
          style={iconBtn}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

/* ── Small UI bits ───────────────────────────────────────────── */

function Empty({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 24px" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", color: "var(--ink-4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon size={20} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>{title}</div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 380, lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 4,
  color: "var(--ink-5)", borderRadius: 6, display: "inline-flex",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7,
    height: 36, padding: "0 16px", fontSize: 13, fontWeight: 600,
    background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 32, padding: "0 12px", fontSize: 12.5, fontWeight: 600,
    background: "var(--surface)", color: "var(--ink-2)",
    border: "1px solid var(--border-strong)", borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
