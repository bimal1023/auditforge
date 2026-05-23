"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, HelpCircle, Search,
  BarChart2, ShieldAlert, Globe, Scale,
  Zap, X,
} from "lucide-react";
import { apiFetch, logout, getToken } from "@/lib/auth";
import { ReportForm } from "@/components/ReportForm";
import { ReportViewer } from "@/components/ReportViewer";
import { UploadDocument } from "@/components/UploadDocument";
import { ScoreChip, Pill } from "@/components/ui";
import type { Report, ReportRequest } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_DEFS: Pick<AgentStatus, "key" | "label" | "icon" | "color">[] = [
  { key: "financial", label: "Financial", icon: BarChart2,   color: "var(--brand)" },
  { key: "risk",      label: "Risk",      icon: ShieldAlert, color: "var(--amber)" },
  { key: "market",    label: "Market",    icon: Globe,       color: "var(--green)" },
  { key: "legal",     label: "Legal",     icon: Scale,       color: "var(--blue)"  },
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

// ── LogoMark ──────────────────────────────────────────────────────────────────

function LogoMark({ stroke = "var(--brand)", size = 24 }: { stroke?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z"
        fill={stroke} opacity="0.12" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8 L16 10.25 L16 14.75 L12 17 L8 14.75 L8 10.25 Z"
        stroke={stroke} strokeWidth="1.5" fill={stroke} />
    </svg>
  );
}

// ── AppHeader ─────────────────────────────────────────────────────────────────

const NAV_TABS = ["Reports", "Library", "Templates", "Activity"] as const;

function AppHeader({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header style={{
      height: 52, flexShrink: 0,
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", padding: "0 20px",
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 24 }}>
        <LogoMark />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>
          AuditForge
        </span>
        <Pill tone="brand">Vantage</Pill>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "stretch", gap: 2, height: "100%" }}>
        {NAV_TABS.map((tab) => {
          const active = tab === "Reports";
          return (
            <button key={tab} style={{
              height: "100%", padding: "0 12px",
              background: "none", border: "none",
              borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
              color: active ? "var(--brand)" : "var(--ink-3)",
              fontSize: 13, fontWeight: active ? 600 : 500,
              fontFamily: "Inter, sans-serif", cursor: "pointer",
              transition: "color 0.15s",
            }}>{tab}</button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <button style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 32, padding: "0 10px",
        background: "var(--surface-2)", border: "1px solid var(--border-strong)",
        borderRadius: 8, cursor: "pointer",
        color: "var(--ink-4)", fontSize: 12.5,
        fontFamily: "Inter, sans-serif", marginRight: 8,
      }}>
        <Search size={13} />
        <span>Search…</span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: 18, padding: "0 5px",
          background: "var(--surface-3)", borderRadius: 4,
          fontSize: 10, fontWeight: 600, color: "var(--ink-4)",
          fontFamily: "JetBrains Mono, monospace", marginLeft: 4,
        }}>⌘K</span>
      </button>

      {/* Icon buttons */}
      {([Bell, HelpCircle] as React.FC<{ size?: number }>[]).map((Icon, i) => (
        <button key={i} style={{
          width: 32, height: 32, borderRadius: 8,
          background: "none", border: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-4)", cursor: "pointer", marginRight: 4,
        }}>
          <Icon size={15} />
        </button>
      ))}

      {/* Avatar / sign out */}
      <button
        onClick={onSignOut}
        title="Sign out"
        style={{
          width: 30, height: 30, borderRadius: 999,
          background: "var(--brand-soft)", border: "1px solid var(--brand)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--brand)", fontSize: 11, fontWeight: 700,
          cursor: "pointer", marginLeft: 4,
          fontFamily: "Inter, sans-serif",
        }}>AU</button>
    </header>
  );
}

// ── StatusTicker ──────────────────────────────────────────────────────────────

function StatusTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div style={{
      height: 32, flexShrink: 0,
      background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
      overflow: "hidden", display: "flex", alignItems: "center",
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center",
        animation: "af-marquee 40s linear infinite",
        whiteSpace: "nowrap",
      }}>
        {items.map((item, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "0 20px", fontSize: 11.5,
            borderRight: "1px solid var(--border)", height: 32,
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

// ── ReportRequestStrip ────────────────────────────────────────────────────────

function ReportRequestStrip({ req, onAbort }: { req: ReportRequest; onAbort: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 14px", marginBottom: 16,
      background: "var(--brand-tint)", border: "1px solid var(--brand)",
      borderRadius: 10,
    }}>
      <Zap size={13} color="var(--brand)" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{req.company_name}</span>
      {req.ticker && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: "var(--brand)",
          fontFamily: "JetBrains Mono, monospace",
          background: "var(--brand-soft)", padding: "1px 6px", borderRadius: 4,
        }}>{req.ticker}</span>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        {req.focus_areas.map((a) => <Pill key={a} tone="brand">{a}</Pill>)}
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onAbort} style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 26, padding: "0 10px",
        background: "none", border: "1px solid var(--border-strong)",
        borderRadius: 6, cursor: "pointer",
        fontSize: 11.5, color: "var(--ink-3)",
        fontFamily: "Inter, sans-serif",
      }}>
        <X size={11} /> Cancel
      </button>
    </div>
  );
}

// ── PipelineConnector ─────────────────────────────────────────────────────────

function PipelineConnector({ agents }: { agents: AgentStatus[] }) {
  const done = agents.filter((a) => a.state === "done").length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1, height: 4, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(done / agents.length) * 100}%`,
          background: "var(--brand)", borderRadius: 999,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
        {done} / {agents.length} complete
      </span>
    </div>
  );
}

// ── AgentTile ─────────────────────────────────────────────────────────────────

function AgentTile({ agent }: { agent: AgentStatus }) {
  const { icon: Icon, color, label, state, progress, logs, confidence } = agent;
  const isRunning = state === "running";
  const isDone    = state === "done";
  const isFailed  = state === "failed";

  const badge = {
    waiting: { label: "Queued",   bg: "var(--surface-3)", fg: "var(--ink-4)"    },
    running: { label: "Running",  bg: "var(--brand-soft)", fg: "var(--brand)"   },
    done:    { label: "Complete", bg: "var(--green-soft)", fg: "var(--green-ink)" },
    failed:  { label: "Failed",   bg: "var(--red-soft)",  fg: "var(--red-ink)"  },
  }[state];

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isRunning ? color + "44" : "var(--border)"}`,
      borderRadius: 12,
      boxShadow: isRunning ? `0 0 0 3px ${color}18` : "var(--shadow-sm)",
      padding: 14,
      display: "flex", flexDirection: "column", gap: 10,
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {isRunning && (
            <div style={{
              position: "absolute", inset: -3, borderRadius: 9,
              border: `2px solid ${color}`,
              animation: "af-pulse-ring 1.5s ease-out infinite",
              opacity: 0.6,
            }} />
          )}
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: isDone ? "var(--green-soft)"
              : isFailed  ? "var(--red-soft)"
              : isRunning  ? `${color}1a`
              : "var(--surface-2)",
            color: isDone ? "var(--green-ink)"
              : isFailed  ? "var(--red-ink)"
              : isRunning  ? color
              : "var(--ink-4)",
            border: `1px solid ${
              isDone   ? "rgba(16,185,129,0.2)"
              : isFailed ? "rgba(239,68,68,0.2)"
              : isRunning ? `${color}33`
              : "var(--border)"
            }`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={13} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
          {isDone && confidence !== undefined && (
            <div style={{ fontSize: 10, color: "var(--ink-4)" }}>
              {Math.round(confidence * 100)}% confidence
            </div>
          )}
        </div>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 999,
          background: badge.bg, color: badge.fg,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          flexShrink: 0,
        }}>
          {isRunning && (
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: color,
              animation: "af-dot 1s ease-in-out infinite",
              display: "inline-block",
            }} />
          )}
          {badge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, backgroundColor: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          backgroundColor: isDone ? "var(--green)" : isFailed ? "var(--red)" : isRunning ? color : "var(--surface-3)",
          borderRadius: 999,
          backgroundImage: isRunning
            ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)"
            : undefined,
          backgroundSize: isRunning ? "16px 16px" : undefined,
          animation: isRunning ? "af-bar 0.5s linear infinite" : "none",
          transition: "width 0.8s ease",
        }} />
      </div>

      {/* Log feed */}
      {logs.length > 0 && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 6,
          padding: "6px 8px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9.5, lineHeight: 1.6,
          maxHeight: 58, overflow: "hidden",
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

// ── AgentQuadrant ─────────────────────────────────────────────────────────────

function AgentQuadrant({ agents, polling }: { agents: AgentStatus[]; polling: boolean }) {
  const allDone = agents.every((a) => a.state === "done" || a.state === "failed");
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, boxShadow: "var(--shadow-sm)", padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Agent pipeline</span>
        {polling
          ? <Pill tone="outline" dot>Polling…</Pill>
          : allDone
            ? <Pill tone="outline">Complete</Pill>
            : <Pill tone="brand" dot>Running</Pill>
        }
      </div>
      <PipelineConnector agents={agents} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {agents.map((a) => <AgentTile key={a.key} agent={a} />)}
      </div>
    </div>
  );
}

// ── LiveActivitySidebar ───────────────────────────────────────────────────────

function LiveActivity({ agents }: { agents: AgentStatus[] }) {
  const active = agents.filter((a) => a.logs.length > 0);
  if (active.length === 0) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
        Live activity
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map((a) => (
          <div key={a.key} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <div style={{
              width: 6, height: 6, borderRadius: 999, flexShrink: 0, marginTop: 4,
              background: a.state === "done" ? "var(--green)" : a.state === "failed" ? "var(--red)" : a.color,
            }} />
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{a.label}</span>
              {" — "}
              {a.logs[a.logs.length - 1]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router   = useRouter();
  const [ready, setReady]         = useState(false);
  const [report, setReport]       = useState<Report | null>(null);
  const [loading, setLoading]     = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [agents, setAgents]       = useState<AgentStatus[]>([]);
  const [activeReq, setActiveReq] = useState<ReportRequest | null>(null);
  const [polling, setPolling]     = useState(false);
  const abortRef    = useRef<AbortController | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiFetch("/api/v1/auth/me").then((res) => { if (res.ok) setReady(true); });
  }, [router]);

  function initAgents(): AgentStatus[] {
    return AGENT_DEFS.map(({ key, label, icon, color }) => ({
      key, label, icon, color,
      state: "waiting", progress: 0, logs: [],
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
        return { ...a, progress: Math.min(85, a.progress + 0.5 + Math.random() * 0.8) };
      }));
    }, 1000);
  }

  function stopProgressTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  function handleAbort() {
    if (!window.confirm("Cancel this report? The analysis will stop.")) return;
    abortRef.current?.abort();
    stopProgressTick();
    // Tell the backend to revoke the Celery task — fire-and-forget
    if (reportIdRef.current) {
      apiFetch(`/api/v1/reports/${reportIdRef.current}`, { method: "DELETE" }).catch(() => {});
      reportIdRef.current = null;
    }
    setLoading(false);
    setStatusMsg("");
    setActiveReq(null);
  }

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

      // 200 = cache hit — report is already complete, skip SSE
      if (createRes.status === 200) {
        const cached: Report = await createRes.json();
        setReport(cached);
        stopProgressTick();
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
        // Mark all still-waiting/running agents as failed
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

      // Stream closed without a terminal event — agents are still running in the
      // background. Keep their last known state and let the poll loop below resolve it.
      if (!streamCompleted) {
        setPolling(true);
        setStatusMsg("Connection dropped — polling for results…");
      }

      // Poll until complete — SSE may break before synthesis finishes on long runs.
      // On each iteration we also fetch the event log so agent tiles stay current
      // even when the SSE stream has dropped.
      setStatusMsg("Waiting for report to finalise…");
      // Interval ladder: 5s for first 24 ticks (2 min), then 10s, then 15s
      const pollInterval = (attempt: number) =>
        attempt < 24 ? 5_000 : attempt < 48 ? 10_000 : 15_000;

      let data: Report | null = null;
      for (let attempt = 0; attempt < 80; attempt++) {
        // Fetch report status + event log in parallel
        const [pollRes, logRes] = await Promise.all([
          apiFetch(`/api/v1/reports/${id}`),
          apiFetch(`/api/v1/reports/${id}/event-log`).catch(() => null),
        ]);
        if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
        const fetched: Report = await pollRes.json();

        // Replay any events we may have missed while SSE was down
        if (logRes?.ok) {
          const events: Array<Record<string, unknown>> = await logRes.json().catch(() => []);
          setAgents((prev) => {
            let next = prev;
            for (const ev of events) {
              const key   = (ev.agent as string) ?? "";
              const type  = ev.type as string;
              const msg   = (ev.message as string) ?? "";
              const conf  = ev.confidence as number | undefined;
              if (type === "agent_start") {
                next = next.map((a) =>
                  a.key === key && a.state === "waiting"
                    ? { ...a, state: "running" as const,
                        logs: a.logs.length ? a.logs : [`→ Starting ${AGENT_LABEL[key] ?? key} analysis…`] }
                    : a
                );
              } else if (type === "agent_done") {
                next = next.map((a) =>
                  a.key === key && a.state !== "done"
                    ? { ...a, state: "done" as const, confidence: conf, progress: 100,
                        logs: [...(a.logs.length ? a.logs : []),
                          conf !== undefined ? `✓ Complete — ${Math.round(conf * 100)}% confidence` : "✓ Complete"] }
                    : a
                );
              } else if (type === "agent_fail") {
                next = next.map((a) =>
                  a.key === key && a.state !== "failed"
                    ? { ...a, state: "failed" as const,
                        logs: [...(a.logs.length ? a.logs : []), `✗ ${(ev.reason as string) ?? "Failed"}`] }
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
          : attempt < 48
            ? 120 + (attempt - 24 + 1) * 10
            : 360 + (attempt - 48 + 1) * 15;
        setStatusMsg(`Still processing… (~${Math.round(elapsedS / 60)}m elapsed)`);
        await new Promise((res) => setTimeout(res, interval));
      }
      if (!data) throw new Error("Report is taking longer than expected. Refresh the page to check if it completed.");

      // Backfill agent tiles from the completed report data.
      // SSE may have dropped before agent_done events arrived, so we reconcile
      // the final states here rather than leaving tiles stuck on "Running".
      const reportMap = data as unknown as Record<string, Record<string, unknown> | undefined>;
      setAgents((prev) => prev.map((a) => {
        const section = reportMap[a.key];
        const conf = section?.confidence_score as number | undefined;
        if (section && typeof conf === "number" && conf > 0) {
          // Agent completed successfully — mark done (update even if already "done" to set confidence)
          return {
            ...a,
            state: "done" as const,
            confidence: conf,
            progress: 100,
            logs: a.logs.length > 0
              ? [...a.logs, `✓ Complete — ${Math.round(conf * 100)}% confidence`]
              : [`✓ Complete — ${Math.round(conf * 100)}% confidence`],
          };
        } else if (a.state === "running" || a.state === "waiting") {
          // Agent didn't produce output — mark failed
          return {
            ...a,
            state: "failed" as const,
            logs: [...a.logs, "✗ No output received"],
          };
        }
        return a;
      }));
      setPolling(false);
      setStatusMsg("Analysis complete — loading report…");

      // Let the tile flip animation play (~1.4s) before showing the report viewer.
      // Without this pause, React batches setAgents + setReport in one render and
      // users never see the "Complete" state — they jump straight to the viewer.
      await new Promise((res) => setTimeout(res, 1400));

      setReport(data);
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
      background: "var(--bg)", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <AppHeader onSignOut={() => { logout().finally(() => router.push("/login")); }} />
      <StatusTicker />

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Idle — show form */}
          {phase === "idle" && (
            <ReportForm onSubmit={handleSubmit} loading={false} />
          )}

          {/* Generating / Loaded — show request strip */}
          {(phase === "generating" || phase === "loaded") && activeReq && (
            <ReportRequestStrip req={activeReq} onAbort={handleAbort} />
          )}

          {/* Generating — status + agent quadrant */}
          {phase === "generating" && (
            <>
              {statusMsg && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", marginBottom: 14,
                  background: "var(--brand-tint)", border: "1px solid var(--brand)",
                  borderRadius: 9, fontSize: 12.5, color: "var(--brand)", fontWeight: 500,
                }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 999, flexShrink: 0,
                    border: "2px solid var(--brand-soft)", borderTopColor: "var(--brand)",
                    animation: "spin 0.7s linear infinite", display: "inline-block",
                  }} />
                  {statusMsg}
                </div>
              )}
              {agents.length > 0 && <AgentQuadrant agents={agents} polling={polling} />}
            </>
          )}

          {/* Loaded — report */}
          {phase === "loaded" && report && <ReportViewer report={report} />}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "var(--red-soft)", border: "1px solid var(--red)",
              borderRadius: 9, fontSize: 13, color: "var(--red-ink)",
            }}>{error}</div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{
          width: 280, flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          overflowY: "auto", padding: "16px 14px",
          background: "var(--bg)",
        }}>
          {phase === "generating" && agents.length > 0 && (
            <LiveActivity agents={agents} />
          )}
          <UploadDocument />
        </div>
      </div>
    </div>
  );
}
