"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/hooks";
import { Search, Clock, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";
import type { Report, ReportSummary } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (report: Report) => void;
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

export function SearchModal({ open, onClose, onSelect }: Props) {
  const isMobile = useIsMobile();
  const [query,   setQuery]   = useState("");
  const [items,   setItems]   = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor,  setCursor]  = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch report list once on open ── */
  useEffect(() => {
    if (!open) { setQuery(""); setCursor(0); return; }
    setLoading(true);
    apiFetch("/api/v1/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  /* ── Close on Escape, navigate with ↑↓, select with Enter ── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter" && filtered[cursor]) handleOpen(filtered[cursor]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor, query]);

  const filtered = items.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return r.company.toLowerCase().includes(q) || (r.ticker ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  /* Reset cursor when query changes */
  useEffect(() => { setCursor(0); }, [query]);

  async function handleOpen(r: ReportSummary) {
    if (r.status !== "complete" || opening) return;
    setOpening(r.id);
    try {
      const res = await apiFetch(`/api/v1/reports/${r.id}`);
      if (res.ok) {
        onSelect(await res.json());
        onClose();
      }
    } finally {
      setOpening(null);
    }
  }

  if (!open) return null;

  return (
    /* ── Overlay ── */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: isMobile ? 16 : 120,
        padding: isMobile ? "16px 12px 0" : undefined,
        animation: "af-fade-in 0.15s ease-out",
      }}
    >
      {/* ── Panel ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "calc(100vw - 32px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16, boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          animation: "af-slide-up 0.2s ease-out",
        }}
      >
        {/* Search input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 16px", height: 52,
          borderBottom: filtered.length > 0 || loading ? "1px solid var(--border)" : "none",
        }}>
          {loading
            ? <Spinner size={16} color="var(--ink-4)" />
            : <Search size={16} color="var(--ink-4)" style={{ flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports by company or ticker…"
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent",
              fontSize: 15, color: "var(--ink)",
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 6px", borderRadius: 6,
              color: "var(--ink-4)", display: "flex", alignItems: "center",
              fontSize: 11, fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            ESC
          </button>
        </div>

        {/* Results */}
        {filtered.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {!query && (
              <div style={{ padding: "8px 16px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                Recent reports
              </div>
            )}
            {filtered.map((r, i) => {
              const isActive  = i === cursor;
              const isOpening = opening === r.id;
              const canOpen   = r.status === "complete";
              const scoreColor = r.overall_score == null ? "var(--ink-4)"
                : r.overall_score >= 7 ? "var(--green-ink)"
                : r.overall_score >= 5 ? "var(--amber-ink)"
                : "var(--red-ink)";

              return (
                <div
                  key={r.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => handleOpen(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: isActive ? "var(--surface-2)" : "transparent",
                    cursor: canOpen ? "pointer" : "default",
                    transition: "background 0.1s",
                    opacity: opening && !isOpening ? 0.5 : 1,
                  }}
                >
                  {/* Score */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: "var(--surface-3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11.5, fontWeight: 800,
                    fontFamily: "JetBrains Mono, monospace",
                    color: scoreColor,
                  }}>
                    {r.overall_score != null ? r.overall_score.toFixed(1) : "—"}
                  </div>

                  {/* Company info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                      {r.company}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                      {r.ticker && (
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink-3)", fontSize: 11 }}>{r.ticker}</span>
                      )}
                      {r.ticker && <span>·</span>}
                      <Clock size={9} />
                      {r.generated_at ? timeAgo(r.generated_at) : "—"}
                    </div>
                  </div>

                  {/* Status / spinner */}
                  <div style={{ flexShrink: 0 }}>
                    {isOpening ? (
                      <Spinner size={14} color="var(--brand)" />
                    ) : !canOpen ? (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: r.status === "error" ? "var(--red-soft)" : "var(--surface-3)",
                        color: r.status === "error" ? "var(--red-ink)" : "var(--ink-4)",
                      }}>
                        {r.status}
                      </span>
                    ) : isActive ? (
                      <span style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "JetBrains Mono, monospace" }}>↵</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && query && filtered.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13.5, color: "var(--ink-4)" }}>
            No reports found for "<strong>{query}</strong>"
          </div>
        )}

        {/* Footer hint */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 11, color: "var(--ink-4)",
          fontFamily: "JetBrains Mono, monospace",
        }}>
          <span><kbd style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 3 }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 3 }}>↵</kbd> open</span>
          <span><kbd style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 3 }}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
