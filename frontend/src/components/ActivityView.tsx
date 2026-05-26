"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Loader, RefreshCw, FileText } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";
import type { ReportSummary } from "@/lib/types";

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

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function EventIcon({ status }: { status: string }) {
  const size = 16;
  if (status === "complete") return <CheckCircle size={size} color="var(--green)" />;
  if (status === "error")    return <XCircle     size={size} color="var(--red)"   />;
  if (status === "running")  return <Loader      size={size} color="var(--brand)" style={{ animation: "spin 1s linear infinite" }} />;
  return <Clock size={size} color="var(--ink-4)" />;
}

function eventLabel(r: ReportSummary): string {
  if (r.status === "complete") return `Report completed${r.overall_score != null ? ` — score ${r.overall_score.toFixed(1)}` : ""}`;
  if (r.status === "error")    return "Report failed";
  if (r.status === "running")  return "Report in progress…";
  return "Report queued";
}

function dotColor(status: string): string {
  if (status === "complete") return "var(--green)";
  if (status === "error")    return "var(--red)";
  if (status === "running")  return "var(--brand)";
  return "var(--ink-5)";
}

export function ActivityView() {
  const [items,   setItems]   = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiFetch("/api/v1/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", animation: "af-slide-up 0.3s ease-out" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)" }}>
            Activity
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            Your report generation history
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 34, padding: "0 13px",
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

      {/* ── Timeline ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "52px 0" }}>
          <Spinner size={20} color="var(--brand)" />
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "52px 0",
          fontSize: 13.5, color: "var(--ink-4)",
        }}>
          No activity yet — generate a report to see it here.
        </div>
      ) : (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-sm)",
        }}>
          {items.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "16px 20px",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              {/* Left: icon column with timeline line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingTop: 1 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                  background: r.status === "complete" ? "var(--green-soft)"
                    : r.status === "error"   ? "var(--red-soft)"
                    : r.status === "running" ? "var(--brand-soft)"
                    : "var(--surface-3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <EventIcon status={r.status} />
                </div>
                {i < items.length - 1 && (
                  <div style={{
                    width: 1.5, flex: 1, minHeight: 16, marginTop: 6,
                    background: "var(--border)",
                  }} />
                )}
              </div>

              {/* Right: content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                    {r.company}
                  </span>
                  {r.ticker && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "var(--ink-3)",
                      fontFamily: "JetBrains Mono, monospace",
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                      padding: "1px 6px", borderRadius: 4,
                    }}>{r.ticker}</span>
                  )}
                </div>

                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3 }}>
                  {eventLabel(r)}
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginTop: 6,
                  fontSize: 11.5, color: "var(--ink-4)",
                }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 7px", borderRadius: 999,
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                  }}>
                    <FileText size={10} />
                    <span style={{ fontWeight: 500 }}>Report</span>
                  </div>
                  <span>·</span>
                  <span title={r.generated_at ? fullDate(r.generated_at) : ""}>
                    {r.generated_at ? timeAgo(r.generated_at) : "—"}
                  </span>
                  {r.overall_score != null && (
                    <>
                      <span>·</span>
                      <span style={{
                        fontFamily: "JetBrains Mono, monospace", fontWeight: 800,
                        color: r.overall_score >= 7 ? "var(--green-ink)" : r.overall_score >= 5 ? "var(--amber-ink)" : "var(--red-ink)",
                      }}>
                        {r.overall_score.toFixed(1)} / 10
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: status dot */}
              <div style={{
                width: 8, height: 8, borderRadius: 999, flexShrink: 0, marginTop: 10,
                background: dotColor(r.status),
                boxShadow: r.status === "running" ? `0 0 0 3px ${dotColor(r.status)}33` : "none",
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
