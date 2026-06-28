"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Star, RefreshCw, Check, Trash2, ChevronDown, ChevronRight, AlertTriangle, Clock, Shield, RotateCcw, Archive, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";
import type { WatchlistItem, WatchlistEvent, WatchlistResponse } from "@/lib/types";

/* ── Types ──────────────────────────────────────────────────── */

interface Props {
  planTier: string;
  onAlertCount?: (n: number) => void;
}

interface ConfirmModal {
  open: boolean;
  itemId: string | null;
  itemName: string;
}

/* ── Helpers ─────────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const SEV: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  material_change: { bg: "var(--r50)",  fg: "var(--r700)",  dot: "var(--r500)",  label: "Material change" },
  minor_change:    { bg: "var(--y50)",  fg: "var(--y700)",  dot: "var(--y500)",  label: "Minor change" },
  no_change:       { bg: "var(--g50)",  fg: "var(--g700)",  dot: "var(--g500)",  label: "No changes" },
};

function DriftBadge({ type }: { type: string }) {
  const s = SEV[type] ?? SEV.no_change;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: "var(--r-1)",
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: s.dot }} />
      {s.label}
    </span>
  );
}

/* ── Component ──────────────────────────────────────────────── */

interface PortfolioSummary {
  total_companies: number;
  total_unacknowledged_alerts: number;
  status_breakdown: {
    material_changes: number;
    minor_changes: number;
    no_changes: number;
    never_scanned: number;
  };
  tickers: string[];
  health_score: number;
}

export function WatchlistView({ planTier, onAlertCount }: Props) {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState("");
  const [ticker, setTicker] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, WatchlistEvent[]>>({});
  const [scanning, setScanning] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({ open: false, itemId: null, itemName: "" });
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/v1/watchlist?include_archived=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WatchlistResponse | null) => {
        if (d) {
          setData(d);
          const total = d.items.reduce((s, i) => s + (i.status === "archived" ? 0 : i.unacknowledged_count), 0);
          onAlertCount?.(total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Also fetch portfolio summary
    apiFetch("/api/v1/watchlist/portfolio-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) setSummary(s); })
      .catch(() => {});
  }, [onAlertCount]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setAdding(true);
    setToast(null);
    try {
      const res = await apiFetch("/api/v1/watchlist", {
        method: "POST",
        body: JSON.stringify({ company: company.trim(), ticker: ticker.trim() || undefined }),
      });
      if (res.ok) {
        setCompany(""); setTicker("");
        load();
      } else {
        const body = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        const msg = typeof body?.error === "string" ? body.error : body?.detail ?? `Error ${res.status}`;
        showToast("error", msg);
      }
    } catch {
      showToast("error", "Failed to add company. Please try again.");
    } finally { setAdding(false); }
  }

  function openArchiveConfirm(id: string) {
    const item = data?.items.find(i => i.id === id);
    if (!item) return;
    setConfirmModal({ open: true, itemId: id, itemName: item.company });
  }

  async function handleArchiveConfirm() {
    if (!confirmModal.itemId) return;
    const name = confirmModal.itemName;
    setConfirmModal({ open: false, itemId: null, itemName: "" });
    await apiFetch(`/api/v1/watchlist/${confirmModal.itemId}`, { method: "DELETE" });
    showToast("success", `Archived "${name}" — recover it anytime from the archived section`);
    load();
  }

  async function handleRecover(id: string) {
    const item = data?.items.find(i => i.id === id);
    await apiFetch(`/api/v1/watchlist/${id}/recover`, { method: "POST" });
    showToast("success", `Recovered "${item?.company ?? "item"}" to your watchlist`);
    load();
  }

  async function handleRerun(id: string) {
    setScanning(id);
    try {
      const res = await apiFetch(`/api/v1/watchlist/${id}/rerun`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        const msg = typeof body?.error === "string" ? body.error : body?.detail ?? `Error ${res.status}`;
        showToast("error", msg);
      }
    } finally {
      setTimeout(() => { setScanning(null); load(); }, 3000);
    }
  }

  async function handleAck(id: string) {
    await apiFetch(`/api/v1/watchlist/${id}/acknowledge`, { method: "POST" });
    load();
  }

  async function toggleEvents(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!events[id]) {
      const res = await apiFetch(`/api/v1/watchlist/${id}/events`);
      if (res.ok) {
        const evts: WatchlistEvent[] = await res.json();
        setEvents((prev) => ({ ...prev, [id]: evts }));
      }
    }
  }

  /* ── Solo gate ────────────────────────────────────────────── */
  if (planTier === "solo") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--r-3)", background: "var(--n20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Star size={22} style={{ color: "var(--n200)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--n900)", marginBottom: 6 }}>Watchlist requires Desk or Firm</h2>
        <p style={{ fontSize: 13, color: "var(--n300)", maxWidth: 400, lineHeight: 1.55 }}>
          Monitor portfolio companies for material changes with automated drift scanning. Upgrade to Desk to unlock 5 watchlist slots with weekly scans.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>;
  }

  const items = data?.items ?? [];
  const slots = data?.slots ?? { used: 0, max: 5 };
  const activeItems = items.filter(i => i.status !== "archived");
  const archivedItems = items.filter(i => i.status === "archived");

  return (
    <div style={{ padding: "0 4px" }}>
      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "var(--s-150)",
          padding: "var(--s-150) var(--s-200)",
          background: toast.type === "success" ? "var(--g50)" : "var(--r50)",
          border: `1px solid ${toast.type === "success" ? "var(--g100)" : "var(--r100)"}`,
          borderLeft: `3px solid ${toast.type === "success" ? "var(--g500)" : "var(--r500)"}`,
          borderRadius: "var(--r-2)",
          marginBottom: "var(--s-200)",
        }}>
          <div style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
            background: toast.type === "success" ? "var(--g500)" : "var(--r500)",
            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 1,
          }}>
            {toast.type === "success" ? <Check size={10} /> : <X size={10} />}
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "var(--n800)", lineHeight: 1.5 }}>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "var(--n200)", flexShrink: 0, marginTop: 1,
          }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Portfolio summary ─────────────────────────────── */}
      {summary && summary.total_companies > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10, marginBottom: "var(--s-200)",
        }}>
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-2)",
            background: "var(--n0)", border: "1px solid var(--n50)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--n400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Companies
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--n900)", marginTop: 2 }}>
              {summary.total_companies}
            </div>
          </div>
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-2)",
            background: "var(--n0)", border: "1px solid var(--n50)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--n400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Health score
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, marginTop: 2,
              color: summary.health_score >= 70 ? "var(--g600)" : summary.health_score >= 40 ? "var(--y600)" : "var(--r600)",
            }}>
              {summary.health_score}%
            </div>
          </div>
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-2)",
            background: summary.total_unacknowledged_alerts > 0 ? "var(--r50)" : "var(--n0)",
            border: `1px solid ${summary.total_unacknowledged_alerts > 0 ? "var(--r200)" : "var(--n50)"}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--n400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Alerts
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, marginTop: 2,
              color: summary.total_unacknowledged_alerts > 0 ? "var(--r600)" : "var(--g600)",
            }}>
              {summary.total_unacknowledged_alerts}
            </div>
          </div>
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-2)",
            background: "var(--n0)", border: "1px solid var(--n50)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--n400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Status
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {summary.status_breakdown.material_changes > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: "var(--r-1)", background: "var(--r50)", color: "var(--r700)" }}>
                  {summary.status_breakdown.material_changes} material
                </span>
              )}
              {summary.status_breakdown.minor_changes > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: "var(--r-1)", background: "var(--y50)", color: "var(--y700)" }}>
                  {summary.status_breakdown.minor_changes} minor
                </span>
              )}
              {summary.status_breakdown.no_changes > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: "var(--r-1)", background: "var(--g50)", color: "var(--g700)" }}>
                  {summary.status_breakdown.no_changes} clear
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Slot usage ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-150)", marginBottom: "var(--s-200)" }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--n20)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (slots.used / Math.max(1, slots.max)) * 100)}%`, height: "100%", borderRadius: 2, background: slots.used >= slots.max ? "var(--r500)" : "var(--b500)", transition: "width 0.3s" }} />
        </div>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--n300)", whiteSpace: "nowrap" }}>{slots.used} / {slots.max} slots</span>
      </div>

      {/* ── Add form ───────────────────────────────────────── */}
      {slots.used < slots.max && (
        <form onSubmit={handleAdd} style={{
          display: "flex", gap: "var(--s-100)", marginBottom: "var(--s-300)", alignItems: "center",
        }}>
          <input
            value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name" required
            style={{
              flex: 2, padding: "var(--s-100) var(--s-150)", borderRadius: "var(--r-2)",
              border: "1px solid var(--n30)", background: "var(--n0)", color: "var(--n800)",
              fontSize: 13, outline: "none",
            }}
          />
          <input
            value={ticker} onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker" maxLength={10}
            className="mono"
            style={{
              flex: 0.7, padding: "var(--s-100) var(--s-150)", borderRadius: "var(--r-2)",
              border: "1px solid var(--n30)", background: "var(--n0)", color: "var(--n800)",
              fontSize: 13, outline: "none", textTransform: "uppercase",
            }}
          />
          <button type="submit" disabled={adding || !company.trim()} style={{
            display: "flex", alignItems: "center", gap: "var(--s-75)",
            padding: "var(--s-100) var(--s-200)", borderRadius: "var(--r-2)",
            background: "var(--b500)", color: "#fff", border: "none",
            fontSize: 13, fontWeight: 600,
            cursor: adding ? "wait" : "pointer", opacity: adding ? 0.6 : 1,
          }}>
            <Plus size={14} /> Add
          </button>
        </form>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {activeItems.length === 0 && archivedItems.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--n300)" }}>
          <Star size={26} style={{ color: "var(--n200)", marginBottom: 12 }} />
          <p style={{ fontSize: 13 }}>Add a company above to start monitoring for changes.</p>
        </div>
      )}

      {/* ── Active cards ───────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-100)" }}>
        {activeItems.map((item) => {
          const isExpanded = expanded === item.id;
          const itemEvents = events[item.id] ?? [];
          return (
            <div key={item.id} style={{
              background: "var(--n0)", border: "1px solid var(--n30)", borderRadius: "var(--r-3)",
              overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-150)", padding: "var(--s-150) var(--s-200)" }}>
                <button type="button" onClick={() => toggleEvents(item.id)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--n200)", display: "flex",
                }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--s-100)" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900)" }}>{item.company}</span>
                    {item.ticker && (
                      <span className="mono" style={{
                        fontSize: 10.5, fontWeight: 700, color: "var(--b700)", background: "var(--b50)",
                        padding: "1px 6px", borderRadius: "var(--r-1)",
                      }}>{item.ticker}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--s-100)", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--n200)" }}>
                      {item.last_scan_at ? `Scanned ${timeAgo(item.last_scan_at)}` : "Never scanned"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--n40)" }}>&middot;</span>
                    <span style={{ fontSize: 11, color: "var(--n200)", textTransform: "capitalize" }}>{item.scan_frequency}</span>
                  </div>
                </div>

                {item.latest_event && <DriftBadge type={item.latest_event.event_type} />}

                {item.unacknowledged_count > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 999, background: "var(--r500)", color: "#fff",
                    fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                  }}>{item.unacknowledged_count}</span>
                )}

                <div style={{ display: "flex", gap: 2 }}>
                  <button type="button" onClick={() => handleRerun(item.id)} disabled={scanning === item.id}
                    title="Run scan now"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--n200)", opacity: scanning === item.id ? 0.4 : 1 }}>
                    <RefreshCw size={14} style={{ animation: scanning === item.id ? "spin 1s linear infinite" : "none" }} />
                  </button>
                  {item.unacknowledged_count > 0 && (
                    <button type="button" onClick={() => handleAck(item.id)} title="Acknowledge all"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--g500)" }}>
                      <Check size={14} />
                    </button>
                  )}
                  <button type="button" onClick={() => openArchiveConfirm(item.id)} title="Archive"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--n200)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--n30)", padding: "var(--s-150) var(--s-200) var(--s-150) 44px" }}>
                  {itemEvents.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--n200)", margin: 0 }}>No drift events yet.</p>
                  )}
                  {itemEvents.slice(0, 10).map((ev) => (
                    <div key={ev.id} style={{ display: "flex", gap: "var(--s-100)", padding: "6px 0", borderBottom: "1px solid var(--n20)" }}>
                      <div style={{ flexShrink: 0, paddingTop: 2 }}>
                        {ev.event_type === "material_change" ? <AlertTriangle size={13} style={{ color: "var(--r500)" }} />
                          : ev.event_type === "minor_change" ? <Shield size={13} style={{ color: "var(--y500)" }} />
                          : <Clock size={13} style={{ color: "var(--g500)" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--n800)", marginBottom: 2 }}>{ev.summary}</div>
                        <div style={{ fontSize: 11, color: "var(--n200)" }}>
                          {ev.detected_at ? timeAgo(ev.detected_at) : ""}
                          {ev.acknowledged && <span style={{ marginLeft: 6 }}>&middot; acknowledged</span>}
                        </div>
                        {ev.details?.changes?.map((c, ci) => (
                          <div key={ci} style={{ fontSize: 11, color: "var(--n300)", marginTop: 4, paddingLeft: 8, borderLeft: "2px solid var(--n20)" }}>
                            <strong>{c.title}</strong> ({c.category}) — {c.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Archived section ───────────────────────────────── */}
      {archivedItems.length > 0 && (
        <div style={{ marginTop: activeItems.length > 0 ? "var(--s-300)" : 0 }}>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            style={{
              display: "flex", alignItems: "center", gap: "var(--s-100)", width: "100%",
              padding: "var(--s-100) var(--s-150)", borderRadius: "var(--r-2)",
              background: "var(--n10)", border: "1px solid var(--n30)",
              cursor: "pointer", marginBottom: showArchived ? "var(--s-100)" : 0,
              transition: "background .12s",
            }}
          >
            <Archive size={13} style={{ color: "var(--n200)" }} />
            <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--n300)" }}>
              {archivedItems.length} archived{" "}
              {archivedItems.length === 1 ? "company" : "companies"}
            </span>
            {showArchived
              ? <ChevronDown size={13} style={{ color: "var(--n200)" }} />
              : <ChevronRight size={13} style={{ color: "var(--n200)" }} />
            }
          </button>

          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-75)" }}>
              {archivedItems.map((item) => (
                <div key={item.id} style={{
                  background: "var(--n10)", border: "1px solid var(--n20)", borderRadius: "var(--r-2)",
                  padding: "var(--s-150) var(--s-200)", display: "flex", alignItems: "center", gap: "var(--s-150)",
                }}>
                  <Archive size={13} style={{ color: "var(--n200)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-100)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--n300)" }}>{item.company}</span>
                      {item.ticker && (
                        <span className="mono" style={{
                          fontSize: 10, fontWeight: 700, color: "var(--n200)", background: "var(--n20)",
                          padding: "1px 5px", borderRadius: "var(--r-1)",
                        }}>{item.ticker}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--n200)", marginTop: 2 }}>
                      Archived {item.archived_at ? timeAgo(item.archived_at) : ""}
                    </div>
                  </div>

                  <button type="button" onClick={() => handleRecover(item.id)}
                    className="btn-secondary"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "var(--s-75)",
                      height: 28, padding: "0 var(--s-150)",
                      fontSize: 12, fontWeight: 500, color: "var(--b500)",
                      background: "var(--n0)", border: "1px solid var(--n30)", borderRadius: "var(--r-2)",
                      cursor: "pointer", transition: "background .1s, border-color .1s",
                    }}
                  >
                    <RotateCcw size={11} /> Recover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation modal ─────────────────────────────── */}
      {confirmModal.open && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(9, 30, 66, 0.54)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50000,
          }}
          onClick={() => setConfirmModal({ open: false, itemId: null, itemName: "" })}
        >
          <div
            style={{
              background: "var(--n0)", borderRadius: "var(--r-3)",
              padding: "var(--s-300)", width: 400, maxWidth: "calc(100vw - 48px)",
              boxShadow: "var(--e300)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--s-200)" }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, itemId: null, itemName: "" })}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, color: "var(--n200)", borderRadius: "var(--r-1)",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--n900)", margin: "0 0 var(--s-75)", letterSpacing: "-0.01em" }}>
              Archive this company?
            </h3>

            {/* Body */}
            <p style={{ fontSize: 13, color: "var(--n300)", margin: "0 0 var(--s-300)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--n800)" }}>{confirmModal.itemName}</strong> will be moved to the archived section. You can recover it anytime and no data will be deleted.
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "var(--s-100)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, itemId: null, itemName: "" })}
                style={{
                  display: "inline-flex", alignItems: "center",
                  height: 32, padding: "0 var(--s-200)",
                  fontSize: 13, fontWeight: 500, color: "var(--n300)",
                  background: "var(--n0)", border: "1px solid var(--n30)", borderRadius: "var(--r-2)",
                  cursor: "pointer", transition: "background .1s, border-color .1s, color .1s",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "var(--s-75)",
                  height: 32, padding: "0 var(--s-200)",
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  background: "var(--r500)", border: "none", borderRadius: "var(--r-2)",
                  cursor: "pointer",
                }}
              >
                <Archive size={13} /> Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
