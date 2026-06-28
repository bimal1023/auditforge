"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, FileText, X, Layers, ChevronLeft, ChevronRight,
  Zap, ArrowUpRight, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner, fmtUSD } from "./ui";
import type { Deal, PipelineStage, DealConviction, ReportSummary } from "@/lib/types";

/* ── Stage metadata ─────────────────────────────────────────── */

const STAGES: { key: PipelineStage; label: string; accent: string }[] = [
  { key: "sourced",   label: "Sourced",   accent: "var(--n200)" },
  { key: "screening", label: "Screening", accent: "var(--b500)" },
  { key: "diligence", label: "Diligence", accent: "var(--b700)" },
  { key: "ic_review", label: "IC Review", accent: "var(--y600)" },
  { key: "closing",   label: "Closing",   accent: "var(--g500)" },
  { key: "won",       label: "Won",       accent: "var(--g600)" },
  { key: "passed",    label: "Passed",    accent: "var(--n300)" },
];

const CONVICTION: Record<DealConviction, { label: string; bg: string; fg: string }> = {
  high:   { label: "High conviction",   bg: "var(--g50)", fg: "var(--g600)" },
  medium: { label: "Medium conviction", bg: "var(--y50)", fg: "var(--y700)" },
  low:    { label: "Low conviction",    bg: "var(--n20)", fg: "var(--n300)" },
};

/* ── Helpers ────────────────────────────────────────────────── */

function daysIn(iso: string): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/* ── Component ──────────────────────────────────────────────── */

export function PipelineView({ onOpenReport }: { onOpenReport?: (reportId: string) => void }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deep Dive confirm modal + in-flight launch state.
  const [confirmDeal, setConfirmDeal] = useState<Deal | null>(null);
  const [launching, setLaunching] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState("");

  // Add-form fields
  const [company, setCompany] = useState("");
  const [ticker, setTicker] = useState("");
  const [conviction, setConviction] = useState<DealConviction | "">("");
  const [size, setSize] = useState("");
  const [reportId, setReportId] = useState("");

  // Horizontal-scroll plumbing for the kanban board.
  const boardRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const syncArrows = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflowing(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
  }, []);

  function scrollBoard(dir: -1 | 1) {
    boardRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/v1/deals")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Deal[]) => setDeals(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    apiFetch("/api/v1/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ReportSummary[]) => setReports(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [load]);

  // Keep the scroll arrows in sync with board size / content changes.
  useEffect(() => {
    syncArrows();
    window.addEventListener("resize", syncArrows);
    return () => window.removeEventListener("resize", syncArrows);
  }, [syncArrows, deals.length, loading]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setSaving(true);
    try {
      const parsedSize = size.trim() ? Number(size.replace(/[^0-9.]/g, "")) : undefined;
      const res = await apiFetch("/api/v1/deals", {
        method: "POST",
        body: JSON.stringify({
          company: company.trim(),
          ticker: ticker.trim() || undefined,
          conviction: conviction || undefined,
          deal_size_usd: parsedSize && !Number.isNaN(parsedSize) ? parsedSize : undefined,
          report_id: reportId || undefined,
        }),
      });
      if (res.ok) {
        const created: Deal = await res.json();
        setDeals((prev) => [...prev, created]);
        setCompany(""); setTicker(""); setConviction(""); setSize(""); setReportId("");
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function moveDeal(id: string, stage: PipelineStage) {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    await apiFetch(`/api/v1/deals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    }).catch(() => load());
  }

  async function removeDeal(id: string) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    await apiFetch(`/api/v1/deals/${id}`, { method: "DELETE" }).catch(() => load());
  }

  async function runDeepDive(deal: Deal) {
    setLaunching(true);
    setDeepDiveError("");
    try {
      const res = await apiFetch(`/api/v1/deals/${deal.id}/deep-dive`, { method: "POST" });
      if (res.ok) {
        const updated: Deal = await res.json();
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setConfirmDeal(null);
      } else if (res.status === 402) {
        setDeepDiveError("You're out of memo credits. Upgrade to Desk for 50 memos/month.");
      } else {
        setDeepDiveError("Couldn't start the deep dive. Please try again.");
      }
    } catch {
      setDeepDiveError("Network error — please try again.");
    } finally {
      setLaunching(false);
    }
  }

  // Poll while any linked report is still running so cards flip to "ready"
  // on their own — results persist server-side regardless of navigation.
  const hasPending = deals.some(
    (d) => d.report_status === "pending" || d.report_status === "running",
  );
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => {
      apiFetch("/api/v1/deals")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Deal[] | null) => { if (Array.isArray(d)) setDeals(d); })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [hasPending]);

  if (loading && deals.length === 0) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>;
  }

  const activeValue = deals
    .filter((d) => d.stage !== "passed" && d.stage !== "won")
    .reduce((s, d) => s + (d.deal_size_usd ?? 0), 0);
  const wonCount = deals.filter((d) => d.stage === "won").length;

  return (
    <div style={{ padding: "0 4px", minWidth: 0 }}>
      {/* ── Summary stats ─────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10, marginBottom: "var(--s-200)",
      }}>
        <StatCard label="Active deals" value={`${deals.length - wonCount - deals.filter((d) => d.stage === "passed").length}`} />
        <StatCard label="Pipeline value" value={activeValue > 0 ? `$${fmtUSD(activeValue)}` : "—"} />
        <StatCard label="Closed won" value={`${wonCount}`} tone="green" />
        <StatCard label="Total tracked" value={`${deals.length}`} />
      </div>

      {/* ── Add bar ───────────────────────────────────────── */}
      <div style={{
        marginBottom: "var(--s-200)", display: "flex", alignItems: "center",
        gap: "var(--s-150)", flexWrap: "wrap",
      }}>
        {!showAdd ? (
          <>
            <button type="button" onClick={() => setShowAdd(true)} style={{
              display: "inline-flex", alignItems: "center", gap: "var(--s-75)",
              padding: "var(--s-100) var(--s-200)", borderRadius: "var(--r-2)",
              background: "var(--b500)", color: "#fff", border: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              <Plus size={14} /> Add deal
            </button>
            {overflowing && (
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <ArrowBtn dir="left" disabled={atStart} onClick={() => scrollBoard(-1)} />
                <ArrowBtn dir="right" disabled={atEnd} onClick={() => scrollBoard(1)} />
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleAdd} style={{
            display: "flex", flexWrap: "wrap", gap: "var(--s-100)", alignItems: "center",
            padding: "var(--s-150)", border: "1px solid var(--n30)", borderRadius: "var(--r-3)",
            background: "var(--n0)",
          }}>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" required
              style={inputCss(2)} />
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Ticker" maxLength={10}
              className="mono" style={{ ...inputCss(0.7), textTransform: "uppercase" }} />
            <select value={conviction} onChange={(e) => setConviction(e.target.value as DealConviction | "")} style={inputCss(1)}>
              <option value="">Conviction…</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Deal size (USD)"
              style={inputCss(1)} />
            <select value={reportId} onChange={(e) => setReportId(e.target.value)} style={inputCss(1.4)}>
              <option value="">Link a memo (optional)…</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>{r.company}{r.ticker ? ` (${r.ticker})` : ""}</option>
              ))}
            </select>
            <button type="submit" disabled={saving || !company.trim()} style={{
              display: "inline-flex", alignItems: "center", gap: "var(--s-75)",
              padding: "var(--s-100) var(--s-200)", borderRadius: "var(--r-2)",
              background: "var(--b500)", color: "#fff", border: "none",
              fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1,
            }}>
              <Plus size={14} /> Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--n200)",
            }}><X size={16} /></button>
          </form>
        )}
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
      {deals.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--n300)" }}>
          <Layers size={26} style={{ color: "var(--n200)", marginBottom: 12 }} />
          <p style={{ fontSize: 13 }}>No deals yet. Add a company above to start tracking it through the pipeline.</p>
        </div>
      )}

      {/* ── Kanban board ──────────────────────────────────── */}
      {deals.length > 0 && (
        <div
          ref={boardRef}
          onScroll={syncArrows}
          style={{
            display: "flex", gap: "var(--s-150)", overflowX: "auto", paddingBottom: 8,
            minWidth: 0, scrollPaddingLeft: 8,
          }}
        >
          {STAGES.map((stage) => {
            const cards = deals
              .filter((d) => d.stage === stage.key)
              .sort((a, b) => a.position - b.position);
            const colValue = cards.reduce((s, d) => s + (d.deal_size_usd ?? 0), 0);
            return (
              <div
                key={stage.key}
                style={{
                  flex: "0 0 248px", display: "flex", flexDirection: "column", gap: "var(--s-100)",
                }}
              >
                {/* Column header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "var(--s-75)",
                  padding: "var(--s-75) var(--s-100)", borderTop: `2px solid ${stage.accent}`,
                  background: "var(--n10)", borderRadius: "0 0 var(--r-2) var(--r-2)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--n800)" }}>{stage.label}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, color: "var(--n300)",
                    background: "var(--n20)", borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center",
                  }}>{cards.length}</span>
                  <span style={{ flex: 1 }} />
                  {colValue > 0 && (
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--n300)" }}>${fmtUSD(colValue)}</span>
                  )}
                </div>

                {/* Cards */}
                {cards.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    reports={reports}
                    onMove={moveDeal}
                    onRemove={removeDeal}
                    onDeepDive={setConfirmDeal}
                    onOpenReport={onOpenReport}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Deep Dive confirm modal ───────────────────────── */}
      {confirmDeal && (
        <DeepDiveModal
          deal={confirmDeal}
          launching={launching}
          error={deepDiveError}
          onConfirm={() => runDeepDive(confirmDeal)}
          onClose={() => { if (!launching) { setConfirmDeal(null); setDeepDiveError(""); } }}
        />
      )}
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────── */

function DeepDiveModal({
  deal, launching, error, onConfirm, onClose,
}: {
  deal: Deal;
  launching: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,30,66,0.42)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: "var(--n0)", borderRadius: "var(--r-3)",
          border: "1px solid var(--n30)", boxShadow: "var(--e300)", padding: "var(--s-300)",
          display: "flex", flexDirection: "column", gap: "var(--s-150)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-100)" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "var(--r-2)", background: "var(--b50)", color: "var(--b700)",
          }}><Zap size={17} /></span>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--n900)" }}>Run a Deep Dive</div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={launching}
            style={{ background: "none", border: "none", cursor: launching ? "default" : "pointer", color: "var(--n200)", padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--n400)", margin: 0 }}>
          Launches the full four-agent diligence run on <strong style={{ color: "var(--n900)" }}>{deal.company}</strong>
          {deal.ticker ? ` (${deal.ticker})` : ""} — Financial, Risk, Market, and Legal.
          The deal moves to <strong style={{ color: "var(--n900)" }}>Diligence</strong> and its
          Action Queue is generated automatically when the report completes.
        </p>

        <div style={{
          display: "flex", flexDirection: "column", gap: 6, padding: "var(--s-150)",
          background: "var(--n10)", borderRadius: "var(--r-2)", fontSize: 12, color: "var(--n400)",
        }}>
          <Row label="Estimated time" value="~15–20 minutes" />
          <Row label="Cost" value="1 memo credit" />
          <Row label="Runs in background" value="Results are saved — you can leave this page" />
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--r600)",
            background: "var(--r50)", border: "1px solid var(--r100)", borderRadius: "var(--r-2)", padding: "8px 10px",
          }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--s-100)", justifyContent: "flex-end", marginTop: 2 }}>
          <button type="button" onClick={onClose} disabled={launching} style={{
            padding: "var(--s-100) var(--s-200)", borderRadius: "var(--r-2)", fontSize: 13, fontWeight: 600,
            background: "var(--n0)", border: "1px solid var(--n30)", color: "var(--n800)",
            cursor: launching ? "default" : "pointer",
          }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={launching} style={{
            display: "inline-flex", alignItems: "center", gap: "var(--s-75)",
            padding: "var(--s-100) var(--s-200)", borderRadius: "var(--r-2)", fontSize: 13, fontWeight: 600,
            background: "var(--b500)", color: "#fff", border: "none",
            cursor: launching ? "wait" : "pointer", opacity: launching ? 0.7 : 1,
          }}>
            {launching ? <><Spinner /> Starting…</> : <><Zap size={14} /> Run Deep Dive</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "var(--n300)" }}>{label}</span>
      <span style={{ color: "var(--n800)", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ArrowBtn({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={dir === "left" ? "Scroll left" : "Scroll right"}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: "var(--r-2)",
        background: "var(--n0)", border: "1px solid var(--n30)",
        color: disabled ? "var(--n40)" : "var(--n300)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
    >
      {dir === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: "var(--r-2)",
      background: "var(--n0)", border: "1px solid var(--n50)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--n400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: tone === "green" ? "var(--g600)" : "var(--n900)" }}>
        {value}
      </div>
    </div>
  );
}

function DealCard({
  deal, reports, onMove, onRemove, onDeepDive, onOpenReport,
}: {
  deal: Deal;
  reports: ReportSummary[];
  onMove: (id: string, stage: PipelineStage) => void;
  onRemove: (id: string) => void;
  onDeepDive: (deal: Deal) => void;
  onOpenReport?: (reportId: string) => void;
}) {
  const conv = deal.conviction ? CONVICTION[deal.conviction] : null;
  const linked = deal.report_id && reports.some((r) => r.id === deal.report_id);
  const running = deal.report_status === "pending" || deal.report_status === "running";
  const ready = deal.report_status === "complete";
  return (
    <div style={{
      background: "var(--n0)", border: "1px solid var(--n30)", borderRadius: "var(--r-2)",
      padding: "var(--s-150)", display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--s-75)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900)" }}>{deal.company}</span>
            {deal.ticker && (
              <span className="mono" style={{
                fontSize: 10, fontWeight: 700, color: "var(--b700)", background: "var(--b50)",
                padding: "1px 5px", borderRadius: "var(--r-1)",
              }}>{deal.ticker}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={() => onRemove(deal.id)} title="Remove deal"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--n200)", flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {conv && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: "var(--r-1)",
            background: conv.bg, color: conv.fg,
          }}>{conv.label}</span>
        )}
        {deal.deal_size_usd != null && deal.deal_size_usd > 0 && (
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--n800)" }}>
            ${fmtUSD(deal.deal_size_usd)}
          </span>
        )}
        {linked && (
          <span title="Linked memo" style={{ display: "inline-flex", alignItems: "center", color: "var(--n300)" }}>
            <FileText size={11} />
          </span>
        )}
      </div>

      {/* Deep Dive zone — visible on every card */}
      {running ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600,
          color: "var(--b700)", background: "var(--b50)", borderRadius: "var(--r-1)", padding: "5px 8px",
        }}>
          <Spinner /> Deep dive running…
        </div>
      ) : ready ? (
        <button type="button" onClick={() => deal.report_id && onOpenReport?.(deal.report_id)} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 11, fontWeight: 700, color: "var(--g600)", background: "var(--g50)",
          border: "1px solid var(--g100)", borderRadius: "var(--r-1)", padding: "5px 8px", cursor: "pointer",
        }}>
          <ArrowUpRight size={12} /> Open deep dive report
        </button>
      ) : (
        <button type="button" onClick={() => onDeepDive(deal)} title="Run full 4-agent diligence" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 11, fontWeight: 700, color: "var(--b700)", background: "var(--n0)",
          border: "1px solid var(--b500)", borderRadius: "var(--r-1)", padding: "5px 8px", cursor: "pointer",
        }}>
          <Zap size={12} /> Run Deep Dive
        </button>
      )}

      {/* Footer: stage selector + days-in-stage */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <select
          value={deal.stage}
          onChange={(e) => onMove(deal.id, e.target.value as PipelineStage)}
          style={{
            flex: 1, minWidth: 0, fontSize: 11, padding: "3px 6px", borderRadius: "var(--r-1)",
            border: "1px solid var(--n30)", background: "var(--n10)", color: "var(--n800)",
            cursor: "pointer", outline: "none",
          }}
        >
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "var(--n200)", whiteSpace: "nowrap" }}>{daysIn(deal.stage_updated_at)}</span>
      </div>
    </div>
  );
}

function inputCss(flex: number): React.CSSProperties {
  return {
    flex, minWidth: 90, padding: "var(--s-100) var(--s-150)", borderRadius: "var(--r-2)",
    border: "1px solid var(--n30)", background: "var(--n0)", color: "var(--n800)",
    fontSize: 13, outline: "none",
  };
}
