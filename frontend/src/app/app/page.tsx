"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Search, BarChart2, ShieldAlert, Globe, Scale, Zap, X, LogOut,
} from "lucide-react";
import { apiFetch, logout, getToken } from "@/lib/auth";
import { useIsMobile } from "@/lib/hooks";
import { ReportForm } from "@/components/ReportForm";
import { ReportViewer } from "@/components/ReportViewer";
import { RecentReports } from "@/components/RecentReports";
import { UploadDocument } from "@/components/UploadDocument";
import { LibraryView } from "@/components/LibraryView";
import { TemplatesView } from "@/components/TemplatesView";
import { ActivityView } from "@/components/ActivityView";
import { SearchModal } from "@/components/SearchModal";
import { ScoreChip, Pill, Spinner } from "@/components/ui";
import type { Report, ReportRequest, ReportSummary } from "@/lib/types";

/* ── Types ───────────────────────────────────────────────────────────────────── */
type AgentKey = "financial" | "risk" | "market" | "legal";
type AgentStatus = {
  key: AgentKey;
  label: string;
  icon: React.FC<{ size?: number }>;
  color: string;
  state: "waiting" | "running" | "done" | "failed";
  confidence?: number;
  progress: number;
  logs: string[];
};

/* ── Constants ───────────────────────────────────────────────────────────────── */
const AGENT_DEFS: Pick<AgentStatus, "key" | "label" | "icon" | "color">[] = [
  { key: "financial", label: "Financial", icon: BarChart2,   color: "#1B3A6B" },
  { key: "risk",      label: "Risk",      icon: ShieldAlert, color: "#9A5800" },
  { key: "market",    label: "Market",    icon: Globe,       color: "#0A6640" },
  { key: "legal",     label: "Legal",     icon: Scale,       color: "#1554A6" },
];
const AGENT_LABEL: Record<string, string> = Object.fromEntries(
  AGENT_DEFS.map((d) => [d.key, d.label]),
);
const TICKER_ITEMS = [
  { co: "Stripe",  score: 8.6, ticker: "PRIV", when: "2h ago"  },
  { co: "Figma",   score: 8.8, ticker: "PRIV", when: "4h ago"  },
  { co: "Klarna",  score: 5.4, ticker: "PRIV", when: "1d ago"  },
  { co: "Brex",    score: 6.8, ticker: "PRIV", when: "2d ago"  },
  { co: "Canva",   score: 7.2, ticker: "PRIV", when: "2d ago"  },
  { co: "OpenAI",  score: 9.1, ticker: "PRIV", when: "3d ago"  },
];

/* ── LogoMark ────────────────────────────────────────────────────────────────── */
function LogoMark({ size = 24, stroke = "var(--brand)" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z"
        fill={stroke} opacity="0.15" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8 L16 10.25 L16 14.75 L12 17 L8 14.75 L8 10.25 Z"
        stroke={stroke} strokeWidth="1.5" fill={stroke} />
    </svg>
  );
}

/* ── AppHeader ───────────────────────────────────────────────────────────────── */
type NavTab = "Reports" | "Library" | "Templates" | "Activity";
const NAV_TABS: NavTab[] = ["Reports", "Library", "Templates", "Activity"];

function AppHeader({
  onSignOut, activeTab, onTabChange, onSearchOpen,
}: {
  onSignOut: () => void;
  activeTab: NavTab;
  onTabChange: (t: NavTab) => void;
  onSearchOpen: () => void;
}) {
  const isMobile = useIsMobile();
  const [bellOpen,    setBellOpen]    = useState(false);
  const [notifs,      setNotifs]      = useState<ReportSummary[]>([]);
  const [notifLoading,setNotifLoading]= useState(false);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const bellDropRef = useRef<HTMLDivElement>(null);

  /* Close bell when clicking outside */
  useEffect(() => {
    if (!bellOpen) return;
    function handler(e: MouseEvent) {
      if (!bellBtnRef.current?.contains(e.target as Node) &&
          !bellDropRef.current?.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  async function toggleBell() {
    if (bellOpen) { setBellOpen(false); return; }
    setBellOpen(true);
    setNotifLoading(true);
    try {
      const r = await apiFetch("/api/v1/reports");
      if (r.ok) setNotifs((await r.json()).slice(0, 6));
    } finally { setNotifLoading(false); }
  }

  const recentNotifs = notifs.filter((n) => n.status === "complete" || n.status === "error");

  return (
    <header style={{
      height: 56, flexShrink: 0,
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: isMobile ? "0 12px" : "0 20px", gap: 4,
      zIndex: 100, minWidth: 0,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: isMobile ? 8 : 20, flexShrink: 0 }}>
        <LogoMark />
        {!isMobile && <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>AuditForge</span>}
        <Pill tone="brand">Vantage</Pill>
      </div>

      {/* Nav tabs — horizontal scroll on mobile */}
      <nav style={{
        display: "flex", alignItems: "stretch", height: "100%",
        overflowX: "auto", flex: isMobile ? 1 : undefined,
        scrollbarWidth: "none",
        // hide webkit scrollbar
      }}
        className="af-no-scrollbar"
      >
        {NAV_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                height: "100%", padding: isMobile ? "0 10px" : "0 14px",
                background: "none", border: "none",
                borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
                color: active ? "var(--brand)" : "var(--ink-4)",
                fontSize: isMobile ? 12.5 : 13.5, fontWeight: active ? 600 : 500,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--ink-2)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--ink-4)"; }}
            >{tab}</button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Search — icon only on mobile */}
      <button
        onClick={onSearchOpen}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 34, padding: isMobile ? "0 9px" : "0 12px",
          background: "var(--surface-2)", border: "1px solid var(--border-strong)",
          borderRadius: 8, cursor: "pointer", color: "var(--ink-4)", fontSize: 12.5,
          fontFamily: "Inter, sans-serif", marginRight: 6, flexShrink: 0,
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--ink)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--ink-4)"; }}
      >
        <Search size={13} />
        {!isMobile && <>
          <span>Search reports…</span>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: 18, padding: "0 5px", marginLeft: 6,
            background: "var(--surface-3)", borderRadius: 4,
            fontSize: 10, fontWeight: 700, color: "var(--ink-4)",
            fontFamily: "JetBrains Mono, monospace",
          }}>⌘K</span>
        </>}
      </button>

      {/* Bell */}
      <div style={{ position: "relative" }}>
        <button
          ref={bellBtnRef}
          onClick={toggleBell}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: bellOpen ? "var(--surface-2)" : "none", border: "none",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink-4)", cursor: "pointer", position: "relative",
            transition: "background 0.12s",
          }}
        >
          <Bell size={16} />
          <span style={{
            position: "absolute", top: 7, right: 7,
            width: 6, height: 6, borderRadius: 999,
            background: "var(--red)", border: "1.5px solid var(--surface)",
          }} />
        </button>

        {/* Bell dropdown */}
        {bellOpen && (
          <div
            ref={bellDropRef}
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              width: 300,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 999,
              overflow: "hidden",
              animation: "af-slide-up 0.15s ease-out",
            }}
          >
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              fontSize: 12.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em",
            }}>
              Notifications
            </div>
            {notifLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                <Spinner size={16} color="var(--brand)" />
              </div>
            ) : recentNotifs.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: 12.5, color: "var(--ink-4)", textAlign: "center" }}>
                No recent notifications
              </div>
            ) : recentNotifs.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "default",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                  background: n.status === "complete" ? "var(--green)" : "var(--red)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.company}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                    {n.status === "complete"
                      ? `Report completed${n.overall_score != null ? ` · ${n.overall_score.toFixed(1)}/10` : ""}`
                      : "Report failed"}
                  </div>
                </div>
                {n.generated_at && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-5)", whiteSpace: "nowrap" }}>
                    {(() => {
                      const d = Math.floor((Date.now() - new Date(n.generated_at).getTime()) / 86_400_000);
                      const h = Math.floor((Date.now() - new Date(n.generated_at).getTime()) / 3_600_000);
                      return d >= 1 ? `${d}d ago` : h >= 1 ? `${h}h ago` : "just now";
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        title="Sign out"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          height: 34, padding: "0 10px",
          background: "none", border: "1px solid var(--border)",
          borderRadius: 8, cursor: "pointer",
          color: "var(--ink-3)", fontSize: 12.5, fontWeight: 500,
          fontFamily: "Inter, sans-serif", marginLeft: 4,
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--ink)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--ink-3)"; }}
      >
        <LogOut size={13} /> Sign out
      </button>
    </header>
  );
}

/* ── StatusTicker ────────────────────────────────────────────────────────────── */
function StatusTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div style={{
      height: 30, flexShrink: 0,
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      overflow: "hidden", display: "flex", alignItems: "center",
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center",
        animation: "af-marquee 44s linear infinite",
        whiteSpace: "nowrap",
      }}>
        {items.map((item, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "0 22px", fontSize: 11.5,
            borderRight: "1px solid var(--border)", height: 30,
          }}>
            <ScoreChip score={item.score} size="sm" />
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{item.co}</span>
            <span style={{ color: "var(--ink-4)", fontFamily: "JetBrains Mono, monospace", fontSize: 10.5 }}>
              {item.ticker} · {item.when}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── ActiveRunBanner ─────────────────────────────────────────────────────────── */
function ActiveRunBanner({ req, onAbort }: { req: ReportRequest; onAbort: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", marginBottom: 18,
      background: "var(--brand-tint)",
      border: "1px solid var(--brand-soft)",
      borderRadius: 12,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: "var(--brand-soft)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <Zap size={14} color="var(--brand)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{req.company_name}</span>
        {req.ticker && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--brand)",
            fontFamily: "JetBrains Mono, monospace",
            background: "var(--brand-soft)", padding: "1px 6px", borderRadius: 4,
          }}>{req.ticker}</span>
        )}
        <span style={{ marginLeft: 10, display: "inline-flex", gap: 4 }}>
          {req.focus_areas.map((a) => <Pill key={a} tone="brand">{a}</Pill>)}
        </span>
      </div>
      <button onClick={onAbort} style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 28, padding: "0 12px",
        background: "none", border: "1px solid var(--border-strong)",
        borderRadius: 7, cursor: "pointer",
        fontSize: 12, fontWeight: 600, color: "var(--ink-3)",
        fontFamily: "Inter, sans-serif",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red-soft)"; e.currentTarget.style.color = "var(--red-ink)"; e.currentTarget.style.borderColor = "var(--red)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--ink-3)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      >
        <X size={11} /> Cancel
      </button>
    </div>
  );
}

/* ── StatusBar ───────────────────────────────────────────────────────────────── */
function StatusBar({ message, polling }: { message: string; polling: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", marginBottom: 16,
      background: polling ? "var(--amber-soft)" : "var(--brand-tint)",
      border: `1px solid ${polling ? "var(--amber)" : "var(--brand-soft)"}`,
      borderRadius: 10, fontSize: 13, fontWeight: 500,
      color: polling ? "var(--amber-ink)" : "var(--brand-ink)",
    }}>
      {polling
        ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--amber)", flexShrink: 0 }} />
        : <Spinner size={14} color="var(--brand)" />
      }
      {message}
    </div>
  );
}

/* ── PipelineProgress ────────────────────────────────────────────────────────── */
function PipelineProgress({ agents }: { agents: AgentStatus[] }) {
  const done = agents.filter((a) => a.state === "done").length;
  const total = agents.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(done / total) * 100}%`,
          background: done === total ? "var(--green)" : "var(--brand)",
          borderRadius: 999,
          transition: "width 0.6s cubic-bezier(.2,.7,.3,1)",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {done} / {total}
      </span>
    </div>
  );
}

/* ── AgentTile ───────────────────────────────────────────────────────────────── */
function AgentTile({ agent }: { agent: AgentStatus }) {
  const { icon: Icon, color, label, state, progress, logs, confidence } = agent;
  const isRunning = state === "running";
  const isDone    = state === "done";
  const isFailed  = state === "failed";
  const isWaiting = state === "waiting";

  const stateColor = isDone ? "var(--green)" : isFailed ? "var(--red)" : isRunning ? color : "var(--ink-5)";
  const stateBg    = isDone ? "var(--green-soft)" : isFailed ? "var(--red-soft)" : isRunning ? `${color}14` : "var(--surface-2)";
  const stateInk   = isDone ? "var(--green-ink)" : isFailed ? "var(--red-ink)" : isRunning ? color : "var(--ink-4)";
  const stateLabel = isDone ? "Complete" : isFailed ? "Failed" : isRunning ? "Running" : "Queued";

  return (
    <div style={{
      background: isRunning ? "var(--surface)" : "var(--surface)",
      border: `1.5px solid ${isRunning ? color + "55" : isDone ? "rgba(5,150,105,0.25)" : isFailed ? "rgba(220,38,38,0.2)" : "var(--border)"}`,
      borderRadius: 14,
      boxShadow: isRunning
        ? `0 0 0 4px ${color}12, var(--shadow-sm)`
        : isDone
          ? "0 0 0 3px rgba(5,150,105,0.08), var(--shadow-sm)"
          : "var(--shadow-xs)",
      padding: 14,
      display: "flex", flexDirection: "column", gap: 10,
      transition: "border-color 0.35s, box-shadow 0.35s",
      animation: "af-slide-up 0.3s ease-out",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {isRunning && (
            <div style={{
              position: "absolute", inset: -4, borderRadius: 11,
              border: `2px solid ${color}`,
              animation: "af-pulse-ring 1.8s ease-out infinite",
            }} />
          )}
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: stateBg, color: stateColor,
            border: `1px solid ${stateColor}22`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.35s",
          }}>
            <Icon size={14} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{label}</div>
          {isDone && confidence !== undefined && (
            <div style={{ fontSize: 10.5, color: "var(--green-ink)", fontWeight: 500 }}>
              {Math.round(confidence * 100)}% confidence
            </div>
          )}
          {isWaiting && (
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>Waiting…</div>
          )}
        </div>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 999,
          background: stateBg, color: stateInk,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em",
          flexShrink: 0,
          transition: "all 0.35s",
        }}>
          {isRunning && (
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: color,
              animation: "af-dot 1s ease-in-out infinite",
              display: "inline-block",
            }} />
          )}
          {stateLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, backgroundColor: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: isDone ? "100%" : isFailed ? `${progress}%` : `${progress}%`,
          backgroundColor: stateColor,
          borderRadius: 999,
          backgroundImage: isRunning
            ? "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,0.2) 4px,rgba(255,255,255,0.2) 8px)"
            : undefined,
          backgroundSize: isRunning ? "16px 16px" : undefined,
          animation: isRunning ? "af-bar 0.5s linear infinite" : "none",
          transition: "width 0.8s cubic-bezier(.2,.7,.3,1)",
        }} />
      </div>

      {/* Log feed */}
      {logs.length > 0 && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 8,
          padding: "7px 10px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9.5, lineHeight: 1.65,
          maxHeight: 56, overflow: "hidden",
        }}>
          {logs.slice(-3).map((line, i, arr) => (
            <div key={i} style={{ color: i === arr.length - 1 ? "var(--ink-2)" : "var(--ink-5)" }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AgentQuadrant ───────────────────────────────────────────────────────────── */
function AgentQuadrant({ agents, polling }: { agents: AgentStatus[]; polling: boolean }) {
  const doneCount = agents.filter((a) => a.state === "done" || a.state === "failed").length;
  const allDone   = doneCount === agents.length;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16, boxShadow: "var(--shadow-sm)",
      padding: 16,
      animation: "af-slide-up 0.4s ease-out",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Agent pipeline</span>
        {polling
          ? <Pill tone="amber" dot>Polling…</Pill>
          : allDone
            ? <Pill tone="green">Complete</Pill>
            : <Pill tone="brand" dot>Running</Pill>
        }
      </div>
      <PipelineProgress agents={agents} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {agents.map((a) => <AgentTile key={a.key} agent={a} />)}
      </div>
    </div>
  );
}

/* ── LiveActivity ────────────────────────────────────────────────────────────── */
function LiveActivity({ agents }: { agents: AgentStatus[] }) {
  const active = agents.filter((a) => a.logs.length > 0);
  if (active.length === 0) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: 14, marginBottom: 12,
      animation: "af-fade-in 0.4s ease-out",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em" }}>
        Live activity
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {active.map((a) => (
          <div key={a.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{
              width: 7, height: 7, borderRadius: 999, flexShrink: 0, marginTop: 4,
              background: a.state === "done" ? "var(--green)" : a.state === "failed" ? "var(--red)" : a.color,
              boxShadow: a.state === "running" ? `0 0 0 3px ${a.color}22` : "none",
            }} />
            <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "var(--ink-2)" }}>{a.label}</span>
              {" — "}
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                {a.logs[a.logs.length - 1]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── HomePage ────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const router    = useRouter();
  const isMobile  = useIsMobile();
  const [ready, setReady]         = useState(false);
  const [report, setReport]       = useState<Report | null>(null);
  const [loading, setLoading]     = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [agents, setAgents]       = useState<AgentStatus[]>([]);
  const [activeReq, setActiveReq] = useState<ReportRequest | null>(null);
  const [polling, setPolling]     = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab,  setActiveTab]  = useState<NavTab>("Reports");
  const [searchOpen, setSearchOpen] = useState(false);
  const [formKey,    setFormKey]    = useState(0);
  const [formInitialValues, setFormInitialValues] = useState<{ focus_areas?: string[]; context?: string } | undefined>();

  const abortRef    = useRef<AbortController | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiFetch("/api/v1/auth/me").then((res) => { if (res.ok) setReady(true); });
  }, [router]);

  function initAgents(): AgentStatus[] {
    return AGENT_DEFS.map(({ key, label, icon, color }) => ({
      key, label, icon, color, state: "waiting", progress: 0, logs: [],
    }));
  }

  function updateAgent(prev: AgentStatus[], key: string, patch: Partial<AgentStatus>): AgentStatus[] {
    return prev.map((a) => (a.key === key ? { ...a, ...patch } : a));
  }

  function startProgressTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setAgents((prev) => prev.map((a) => {
        if (a.state !== "running") return a;
        return { ...a, progress: Math.min(88, a.progress + 0.4 + Math.random() * 0.7) };
      }));
    }, 1000);
  }

  function stopProgressTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  function handleAbort() {
    if (!window.confirm("Cancel this report? The analysis will stop and progress will be lost.")) return;
    abortRef.current?.abort();
    stopProgressTick();
    if (reportIdRef.current) {
      apiFetch(`/api/v1/reports/${reportIdRef.current}`, { method: "DELETE" }).catch(() => {});
      reportIdRef.current = null;
    }
    setLoading(false);
    setStatusMsg("");
    setActiveReq(null);
    setPolling(false);
  }

  function handleSelectHistorical(selectedReport: Report) {
    abortRef.current?.abort();
    stopProgressTick();
    setReport(selectedReport);
    setLoading(false);
    setActiveReq(null);
    setAgents([]);
    setStatusMsg("");
    setError(null);
    setPolling(false);
    setActiveTab("Reports");
  }

  function handleUseTemplate(t: { focus_areas: string[]; context: string }) {
    setFormInitialValues(t);
    setFormKey((k) => k + 1);
    setActiveTab("Reports");
    setReport(null);
  }

  function handleOpenFromLibrary(r: Report) {
    handleSelectHistorical(r);
  }

  /* ⌘K keyboard shortcut */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleSubmit(req: ReportRequest) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setStatusMsg("Submitting request…");
    setError(null);
    setReport(null);
    setActiveReq(req);
    setAgents(initAgents());
    setPolling(false);

    try {
      const createRes = await apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify(req),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        throw new Error(d.detail ?? `HTTP ${createRes.status}`);
      }

      // 200 = cache hit
      if (createRes.status === 200) {
        const cached: Report = await createRes.json();
        stopProgressTick();
        setReport(cached);
        setLoading(false);
        setStatusMsg("");
        return;
      }

      const { id } = await createRes.json();
      reportIdRef.current = id;
      setStatusMsg("Agents are running — this takes 2–4 minutes…");
      startProgressTick();

      const sseRes = await apiFetch(`/api/v1/reports/${id}/events`, { signal: controller.signal });
      if (!sseRes.ok || !sseRes.body) {
        setAgents((prev) => prev.map((a) =>
          a.state === "waiting" || a.state === "running"
            ? { ...a, state: "failed", logs: [...a.logs, "✗ Stream connection failed"] }
            : a
        ));
        throw new Error(`SSE stream failed: HTTP ${sseRes.status}`);
      }

      const reader  = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamCompleted = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(raw); } catch { continue; }

          const agentKey = (ev.agent as string) ?? "";
          const type     = ev.type as string;
          const msg      = (ev.message as string) ?? "";

          if (type === "agent_start") {
            setAgents((prev) => updateAgent(prev, agentKey, {
              state: "running",
              logs: [`→ Starting ${AGENT_LABEL[agentKey] ?? agentKey} analysis…`],
            }));
          } else if (type === "agent_done") {
            const conf = ev.confidence as number | undefined;
            setAgents((prev) => {
              const existing = prev.find((a) => a.key === agentKey)?.logs ?? [];
              return updateAgent(prev, agentKey, {
                state: "done", confidence: conf, progress: 100,
                logs: [...existing, conf !== undefined
                  ? `✓ Complete — ${Math.round(conf * 100)}% confidence`
                  : "✓ Complete"],
              });
            });
          } else if (type === "agent_fail") {
            setAgents((prev) => {
              const existing = prev.find((a) => a.key === agentKey)?.logs ?? [];
              return updateAgent(prev, agentKey, {
                state: "failed",
                logs: [...existing, `✗ ${(ev.reason as string) ?? "Failed"}`],
              });
            });
          } else if (type === "status") {
            setStatusMsg(msg);
            if (agentKey) {
              setAgents((prev) => {
                const existing = prev.find((a) => a.key === agentKey)?.logs ?? [];
                return updateAgent(prev, agentKey, { logs: [...existing, msg] });
              });
            }
          } else if (type === "complete" || type === "error") {
            streamCompleted = true;
            break outer;
          }
        }
      }

      stopProgressTick();

      if (!streamCompleted) {
        setPolling(true);
        setStatusMsg("Connection dropped — polling for results…");
      }

      // Interval ladder: 5s for first 2 min, then 10s, then 15s
      const pollInterval = (attempt: number) =>
        attempt < 24 ? 5_000 : attempt < 48 ? 10_000 : 15_000;

      setStatusMsg("Waiting for report to finalise…");
      let data: Report | null = null;

      for (let attempt = 0; attempt < 80; attempt++) {
        if (controller.signal.aborted) break;
        const [pollRes, logRes] = await Promise.all([
          apiFetch(`/api/v1/reports/${id}`),
          apiFetch(`/api/v1/reports/${id}/event-log`).catch(() => null),
        ]);
        if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
        const fetched: Report = await pollRes.json();

        // Replay missed events from Redis log
        if (logRes?.ok) {
          const events: Array<Record<string, unknown>> = await logRes.json().catch(() => []);
          setAgents((prev) => {
            let next = prev;
            for (const ev of events) {
              const key  = (ev.agent as string) ?? "";
              const type = ev.type as string;
              const msg  = (ev.message as string) ?? "";
              const conf = ev.confidence as number | undefined;
              if (type === "agent_start") {
                next = next.map((a) =>
                  a.key === key && a.state === "waiting"
                    ? { ...a, state: "running" as const, logs: a.logs.length ? a.logs : [`→ Starting ${AGENT_LABEL[key] ?? key} analysis…`] }
                    : a
                );
              } else if (type === "agent_done") {
                next = next.map((a) =>
                  a.key === key && a.state !== "done"
                    ? { ...a, state: "done" as const, confidence: conf, progress: 100,
                        logs: [...(a.logs.length ? a.logs : []), conf !== undefined ? `✓ Complete — ${Math.round(conf * 100)}% confidence` : "✓ Complete"] }
                    : a
                );
              } else if (type === "agent_fail") {
                next = next.map((a) =>
                  a.key === key && a.state !== "failed"
                    ? { ...a, state: "failed" as const, logs: [...(a.logs.length ? a.logs : []), `✗ ${(ev.reason as string) ?? "Failed"}`] }
                    : a
                );
              } else if (type === "status" && key) {
                next = next.map((a) =>
                  a.key === key
                    ? { ...a, logs: a.logs.includes(msg) ? a.logs : [...a.logs, msg] }
                    : a
                );
              }
            }
            return next;
          });
        }

        if (fetched.status === "complete" || fetched.status === "error") {
          data = fetched;
          break;
        }

        const interval = pollInterval(attempt);
        const elapsedS = attempt < 24
          ? (attempt + 1) * 5
          : attempt < 48 ? 120 + (attempt - 24 + 1) * 10 : 360 + (attempt - 48 + 1) * 15;
        setStatusMsg(`Still processing… (~${Math.round(elapsedS / 60)}m elapsed)`);
        await new Promise((res) => setTimeout(res, interval));
      }

      if (!data) throw new Error("Report is taking longer than expected. Refresh the page to check if it completed.");

      // Backfill agent tiles from final report
      const reportMap = data as unknown as Record<string, Record<string, unknown> | undefined>;
      setAgents((prev) => prev.map((a) => {
        const section = reportMap[a.key];
        const conf = section?.confidence_score as number | undefined;
        if (section && typeof conf === "number" && conf > 0) {
          return {
            ...a, state: "done" as const, confidence: conf, progress: 100,
            logs: a.logs.length > 0
              ? [...a.logs, `✓ Complete — ${Math.round(conf * 100)}% confidence`]
              : [`✓ Complete — ${Math.round(conf * 100)}% confidence`],
          };
        } else if (a.state === "running" || a.state === "waiting") {
          return { ...a, state: "failed" as const, logs: [...a.logs, "✗ No output received"] };
        }
        return a;
      }));
      setPolling(false);
      setStatusMsg("Analysis complete — loading report…");
      await new Promise((res) => setTimeout(res, 1400));
      setReport(data);
      setRefreshKey((k) => k + 1);

    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      stopProgressTick();
      setLoading(false);
      setStatusMsg("");
    }
  }

  if (!ready) return null;

  const phase: "idle" | "generating" | "loaded" =
    loading ? "generating" : report ? "loaded" : "idle";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
      background: "var(--bg)",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <AppHeader
        onSignOut={() => { logout().finally(() => router.push("/login")); }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectHistorical}
      />
      <StatusTicker />

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: isMobile ? "column" : "row" }}>

        {/* Main */}
        <div className="af-scroll" style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 28px" }}>

          {/* ── Reports tab ── */}
          {activeTab === "Reports" && (
            <>
              {phase === "idle" && (
                <div style={{ maxWidth: 640, margin: "0 auto" }}>
                  <ReportForm
                    key={formKey}
                    onSubmit={handleSubmit}
                    loading={false}
                    initialValues={formInitialValues}
                  />
                </div>
              )}

              {(phase === "generating" || phase === "loaded") && activeReq && (
                <ActiveRunBanner req={activeReq} onAbort={handleAbort} />
              )}

              {phase === "generating" && (
                <>
                  {statusMsg && <StatusBar message={statusMsg} polling={polling} />}
                  {agents.length > 0 && <AgentQuadrant agents={agents} polling={polling} />}
                </>
              )}

              {phase === "loaded" && report && <ReportViewer report={report} />}

              {error && (
                <div style={{
                  marginTop: 14, padding: "12px 16px",
                  background: "var(--red-soft)", border: "1px solid #FECACA",
                  borderRadius: 10, fontSize: 13.5, color: "var(--red-ink)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>⚠</span>
                  {error}
                </div>
              )}
            </>
          )}

          {/* ── Library tab ── */}
          {activeTab === "Library" && (
            <LibraryView onOpen={handleOpenFromLibrary} />
          )}

          {/* ── Templates tab ── */}
          {activeTab === "Templates" && (
            <TemplatesView onUseTemplate={handleUseTemplate} />
          )}

          {/* ── Activity tab ── */}
          {activeTab === "Activity" && (
            <ActivityView />
          )}
        </div>

        {/* Sidebar — stacks below content on mobile */}
        {activeTab === "Reports" && (
          <div className="af-scroll" style={{
            width: isMobile ? "100%" : 288, flexShrink: 0,
            borderLeft: isMobile ? "none" : "1px solid var(--border)",
            borderTop: isMobile ? "1px solid var(--border)" : "none",
            overflowY: isMobile ? "visible" : "auto",
            padding: isMobile ? "16px 14px 24px" : "16px 14px",
            background: "var(--surface)",
          }}>
            {phase === "generating" && agents.length > 0 && (
              <LiveActivity agents={agents} />
            )}
            <RecentReports
              onSelect={handleSelectHistorical}
              refreshKey={refreshKey}
              onViewAll={() => setActiveTab("Library")}
            />
            <UploadDocument />
          </div>
        )}
      </div>
    </div>
  );
}
