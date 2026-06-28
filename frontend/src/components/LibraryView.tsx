"use client";

import { useEffect, useState } from "react";
import { Search, RefreshCw, ChevronRight, Clock } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";
import { useIsMobile } from "@/lib/hooks";
import type { Report, ReportSummary } from "@/lib/types";

interface Props {
  onOpen: (report: Report) => void;
}

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

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span style={{ color: "var(--ink-4)", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>—</span>;
  const color = score >= 7 ? "var(--green)"  : score >= 5 ? "var(--amber)"  : "var(--red)";
  const bg    = score >= 7 ? "var(--green-soft)" : score >= 5 ? "var(--amber-soft)" : "var(--red-soft)";
  const ink   = score >= 7 ? "var(--green-ink)"  : score >= 5 ? "var(--amber-ink)"  : "var(--red-ink)";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 44, height: 22, borderRadius: 6,
      background: bg, border: `1px solid ${color}44`,
      fontSize: 11.5, fontWeight: 800, color: ink,
      fontFamily: "JetBrains Mono, monospace",
    }}>
      {score.toFixed(1)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; ink: string; dot: string; label: string }> = {
    complete: { bg: "var(--green-soft)", ink: "var(--green-ink)", dot: "var(--green)", label: "Complete" },
    running:  { bg: "var(--brand-soft)", ink: "var(--brand-ink)", dot: "var(--brand)", label: "Running"  },
    pending:  { bg: "var(--surface-3)",  ink: "var(--ink-3)",     dot: "var(--ink-4)", label: "Pending"  },
    error:    { bg: "var(--red-soft)",   ink: "var(--red-ink)",   dot: "var(--red)",   label: "Error"    },
  };
  const s = map[status] ?? map.pending;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999,
      background: s.bg, color: s.ink,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
      {s.label}
    </div>
  );
}

const STATUS_FILTERS = ["all", "complete", "running", "error"] as const;

export function LibraryView({ onOpen }: Props) {
  const isMobile = useIsMobile();
  const [items,   setItems]   = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<string>("all");
  const [opening, setOpening] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch("/api/v1/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = items.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.company.toLowerCase().includes(q) || (r.ticker ?? "").toLowerCase().includes(q);
    const matchF = filter === "all" || r.status === filter;
    return matchQ && matchF;
  });

  async function handleOpen(id: string, status: string) {
    if (status !== "complete" || opening) return;
    setOpening(id);
    try {
      const res = await apiFetch(`/api/v1/reports/${id}`);
      if (res.ok) onOpen(await res.json());
    } finally {
      setOpening(null);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", animation: "af-slide-up 0.3s ease-out" }}>

      {/* ── Toolbar (count + refresh) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {items.length} report{items.length !== 1 ? "s" : ""} total
        </span>
        <button
          onClick={load}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 32, padding: "0 12px",
            background: "var(--surface)", border: "1px solid var(--border-strong)",
            borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            color: "var(--ink-3)", fontFamily: "Inter, sans-serif",
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--ink)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)";   e.currentTarget.style.color = "var(--ink-3)"; }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Search + filter bar ── */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, marginBottom: 16 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          height: 38, padding: "0 12px",
          background: "var(--surface)", border: "1px solid var(--border-strong)",
          borderRadius: 9,
        }}>
          <Search size={13} color="var(--ink-4)" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or ticker…"
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent", fontSize: 13.5,
              color: "var(--ink)", fontFamily: "Inter, sans-serif",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 2, display: "flex", fontSize: 16, lineHeight: 1 }}
            >×</button>
          )}
        </div>
        <div className="af-no-scrollbar" style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                height: 38, padding: "0 13px", flexShrink: 0,
                background: filter === s ? "var(--ink)" : "var(--surface)",
                color: filter === s ? "#fff" : "var(--ink-3)",
                border: `1px solid ${filter === s ? "var(--ink)" : "var(--border-strong)"}`,
                borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
                transition: "all 0.12s",
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-sm)",
      }}>
        {/* Table header — hidden on mobile (card layout instead) */}
        {!isMobile && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "52px 1fr 110px 90px 110px 32px",
            padding: "0 18px",
            background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
          }}>
            {["Score", "Company", "Status", "Ticker", "Date", ""].map((h, i) => (
              <div key={i} style={{
                padding: "10px 0",
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "var(--ink-4)",
              }}>{h}</div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "52px 0" }}>
            <Spinner size={20} color="var(--brand)" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "52px 0", textAlign: "center", fontSize: 13.5, color: "var(--ink-4)" }}>
            {search || filter !== "all"
              ? "No reports match your filters"
              : "No reports yet — generate your first one from the Reports tab"}
          </div>
        ) : (
          filtered.map((r, i) => {
            const canOpen   = r.status === "complete";
            const isOpening = opening === r.id;

            /* ── Mobile: card layout ── */
            if (isMobile) return (
              <div
                key={r.id}
                onClick={() => handleOpen(r.id, r.status)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  cursor: canOpen ? "pointer" : "default",
                  transition: "background 0.12s",
                  opacity: opening && !isOpening ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (canOpen) e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <ScoreBadge score={r.overall_score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.company}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {r.ticker && <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink-3)" }}>{r.ticker}</span>}
                    <StatusBadge status={r.status} />
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={9} />{r.generated_at ? timeAgo(r.generated_at) : "—"}</span>
                  </div>
                </div>
                {isOpening ? <Spinner size={13} color="var(--brand)" /> : canOpen ? <ChevronRight size={14} color="var(--ink-4)" /> : null}
              </div>
            );

            /* ── Desktop: grid layout ── */
            return (
              <div
                key={r.id}
                onClick={() => handleOpen(r.id, r.status)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr 110px 90px 110px 32px",
                  padding: "0 18px", minHeight: 52,
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  alignItems: "center",
                  cursor: canOpen ? "pointer" : "default",
                  transition: "background 0.12s",
                  opacity: opening && !isOpening ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (canOpen) e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div><ScoreBadge score={r.overall_score} /></div>
                <div style={{
                  fontSize: 13.5, fontWeight: 700, color: "var(--ink)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  paddingRight: 16,
                }}>{r.company}</div>
                <div><StatusBadge status={r.status} /></div>
                <div style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink-3)" }}>
                  {r.ticker ?? "—"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} />
                  {r.generated_at ? timeAgo(r.generated_at) : "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {isOpening
                    ? <Spinner size={13} color="var(--brand)" />
                    : canOpen
                      ? <ChevronRight size={14} color="var(--ink-4)" />
                      : null
                  }
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
