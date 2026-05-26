"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Clock, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";
import type { Report, ReportSummary } from "@/lib/types";

interface Props {
  /** Called with the full report when the user clicks a history item. */
  onSelect: (report: Report) => void;
  /** Increment this to trigger a re-fetch (e.g. after a new report completes). */
  refreshKey?: number;
  /** Called when the user clicks "View all" — typically switches to the Library tab. */
  onViewAll?: () => void;
}

/* ── Score → BUY / HOLD / SELL ───────────────────────────────────────────── */
function scoreRating(score: number) {
  if (score >= 7.0)
    return { label: "BUY",  color: "var(--green)",  bg: "var(--green-soft)",  ink: "var(--green-ink)"  };
  if (score >= 5.0)
    return { label: "HOLD", color: "var(--amber)",  bg: "var(--amber-soft)",  ink: "var(--amber-ink)"  };
  return   { label: "SELL", color: "var(--red)",    bg: "var(--red-soft)",    ink: "var(--red-ink)"    };
}

/* ── Human-readable "2h ago" ─────────────────────────────────────────────── */
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

/* ── Component ───────────────────────────────────────────────────────────── */
export function RecentReports({ onSelect, refreshKey, onViewAll }: Props) {
  const [items,    setItems]    = useState<ReportSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [opening,  setOpening]  = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  function refresh() { setFetchKey((k) => k + 1); }

  /* Fetch list whenever refreshKey or fetchKey changes */
  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch("/api/v1/reports")
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((data: ReportSummary[]) => setItems(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, fetchKey]);

  /* Open a historical report — fetch full JSON then hand off to parent */
  async function handleOpen(id: string) {
    if (opening) return;
    setOpening(id);
    try {
      const res = await apiFetch(`/api/v1/reports/${id}`);
      if (!res.ok) return;
      const report: Report = await res.json();
      onSelect(report);
    } catch {
      /* silently ignore — the main page will stay as-is */
    } finally {
      setOpening(null);
    }
  }

  const visible = items.slice(0, 6);

  return (
    <div style={{ marginBottom: 16 }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: "var(--ink)", letterSpacing: "-0.01em",
        }}>
          Recent reports
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Refresh button */}
          <button
            onClick={refresh}
            title="Refresh"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-4)", padding: 2,
              display: "inline-flex", alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-4)")}
          >
            <RefreshCw size={11} />
          </button>

          {/* View all link */}
          {onViewAll && items.length > 0 && (
            <button
              onClick={onViewAll}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: "var(--ink-4)", padding: 0,
                display: "inline-flex", alignItems: "center", gap: 2,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-4)")}
            >
              View all <ChevronRight size={10} />
            </button>
          )}
        </div>
      </div>

      {/* ── States ── */}
      {loading ? (
        <div style={{
          display: "flex", justifyContent: "center",
          padding: "22px 0",
        }}>
          <Spinner size={15} color="var(--ink-4)" />
        </div>

      ) : error ? (
        <div style={{
          padding: "12px", textAlign: "center",
          fontSize: 12, color: "var(--red-ink)",
          background: "var(--red-soft)",
          border: "1px solid rgba(220,38,38,0.15)",
          borderRadius: 10,
        }}>
          Could not load history
        </div>

      ) : visible.length === 0 ? (
        <div style={{
          padding: "18px 12px", textAlign: "center",
          fontSize: 12, color: "var(--ink-4)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10, lineHeight: 1.5,
        }}>
          No reports yet.<br />
          <span style={{ opacity: 0.7 }}>Generate one to see it here.</span>
        </div>

      ) : (
        /* ── Report list ── */
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {visible.map((item, i) => {
            const isComplete = item.status === "complete";
            const isRunning  = item.status === "running" || item.status === "pending";
            const isError    = item.status === "error";
            const rating     = isComplete && item.overall_score != null ? scoreRating(item.overall_score) : null;
            const isLast     = i === visible.length - 1;
            const isOpening  = opening === item.id;
            const canOpen    = isComplete && !opening;

            return (
              <button
                key={item.id}
                onClick={() => canOpen && handleOpen(item.id)}
                disabled={!canOpen}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 12px",
                  background: "none", border: "none",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                  cursor: canOpen ? "pointer" : "default",
                  textAlign: "left",
                  transition: "background 0.12s",
                  opacity: opening && !isOpening ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (canOpen) e.currentTarget.style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                {/* Score / status badge */}
                <div style={{
                  flexShrink: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 2, width: 40,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 999,
                    background: isRunning ? "var(--brand-soft)"
                      : isError ? "var(--red-soft)"
                      : rating ? rating.bg : "var(--surface-3)",
                    border: `2px solid ${
                      isRunning ? "var(--brand)"
                      : isError ? "var(--red)"
                      : rating ? rating.color : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    color: isRunning ? "var(--brand)"
                      : isError ? "var(--red-ink)"
                      : rating ? rating.ink : "var(--ink-4)",
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "-0.02em",
                  }}>
                    {isRunning
                      ? <Spinner size={13} color="var(--brand)" />
                      : isError ? "!"
                      : item.overall_score != null ? item.overall_score.toFixed(1) : "—"}
                  </div>
                  <span style={{
                    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em",
                    color: isRunning ? "var(--brand)"
                      : isError ? "var(--red-ink)"
                      : rating ? rating.ink : "var(--ink-4)",
                  }}>
                    {isRunning ? (item.status === "pending" ? "WAIT" : "RUN")
                      : isError ? "ERR"
                      : rating ? rating.label : "—"}
                  </span>
                </div>

                {/* Company info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700,
                    color: "var(--ink)", letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {item.company}
                  </div>
                  <div style={{
                    fontSize: 10.5, color: "var(--ink-4)",
                    marginTop: 2,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {item.ticker && (
                      <>
                        <span style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700, fontSize: 10,
                          color: "var(--ink-3)",
                        }}>
                          {item.ticker}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Clock size={9} />
                      {item.generated_at ? timeAgo(item.generated_at) : "—"}
                    </span>
                  </div>
                </div>

                {/* Chevron / spinner */}
                <div style={{ flexShrink: 0, color: "var(--ink-4)" }}>
                  {isOpening
                    ? <Spinner size={13} color="var(--brand)" />
                    : isComplete ? <ChevronRight size={14} />
                    : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
