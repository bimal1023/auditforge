"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearToken, getToken } from "@/lib/auth";
import { ReportForm } from "@/components/ReportForm";
import { ReportViewer } from "@/components/ReportViewer";
import { UploadDocument } from "@/components/UploadDocument";
import type { Report, ReportRequest } from "@/lib/types";

type AgentStatus = {
  key: string;
  label: string;
  state: "waiting" | "running" | "done" | "failed";
  confidence?: number;
  message?: string;
};

const AGENT_LABELS: Record<string, string> = {
  financial: "Financial Analysis",
  risk: "Risk Assessment",
  market: "Market Intelligence",
  legal: "Legal & Regulatory",
};

const AGENT_ORDER = ["financial", "risk", "market", "legal"];

function AgentProgressPanel({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agent Progress</p>
      {agents.map((a) => (
        <div key={a.key} className="flex items-center gap-3">
          <div className="w-5 flex-shrink-0 text-center">
            {a.state === "running" && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            )}
            {a.state === "done" && <span className="text-green-500 text-sm">✓</span>}
            {a.state === "failed" && <span className="text-red-400 text-sm">✗</span>}
            {a.state === "waiting" && <span className="text-slate-300 text-sm">○</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${
              a.state === "done" ? "text-slate-700" :
              a.state === "running" ? "text-brand-700" :
              a.state === "failed" ? "text-red-600" :
              "text-slate-400"
            }`}>
              {a.label}
            </p>
            {a.message && a.state !== "waiting" && (
              <p className="text-xs text-slate-400 truncate">{a.message}</p>
            )}
          </div>
          {a.state === "done" && a.confidence !== undefined && (
            <span className="text-xs text-slate-500 flex-shrink-0">
              {Math.round(a.confidence * 100)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch("/api/v1/auth/me").then((res) => {
      if (res.ok) setReady(true);
    });
  }, [router]);

  function initAgents(): AgentStatus[] {
    return AGENT_ORDER.map((key) => ({
      key,
      label: AGENT_LABELS[key] ?? key,
      state: "waiting",
    }));
  }

  function updateAgent(
    prev: AgentStatus[],
    key: string,
    patch: Partial<AgentStatus>,
  ): AgentStatus[] {
    return prev.map((a) => (a.key === key ? { ...a, ...patch } : a));
  }

  async function handleSubmit(req: ReportRequest) {
    // Cancel any in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setStatusMsg("Submitting request…");
    setError(null);
    setReport(null);
    setAgents(initAgents());

    try {
      const createRes = await apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify(req),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        throw new Error(d.detail ?? `HTTP ${createRes.status}`);
      }
      const { id } = await createRes.json();

      setStatusMsg("Agents are running — this takes 2–4 minutes…");

      // Open SSE stream using fetch (EventSource doesn't support auth headers)
      const sseRes = await apiFetch(`/api/v1/reports/${id}/events`, {
        signal: controller.signal,
      });
      if (!sseRes.ok || !sseRes.body) {
        throw new Error(`SSE stream failed: HTTP ${sseRes.status}`);
      }

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

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

          const agent = (ev.agent as string) ?? "";
          const type = ev.type as string;
          const msg = (ev.message as string) ?? "";

          if (type === "agent_start") {
            setAgents((prev) => updateAgent(prev, agent, { state: "running", message: msg }));
          } else if (type === "agent_done") {
            const conf = ev.confidence as number | undefined;
            setAgents((prev) => updateAgent(prev, agent, {
              state: "done",
              confidence: conf,
              message: conf !== undefined ? `${Math.round(conf * 100)}% confidence` : "complete",
            }));
          } else if (type === "agent_fail") {
            setAgents((prev) => updateAgent(prev, agent, {
              state: "failed",
              message: (ev.reason as string) ?? "failed",
            }));
          } else if (type === "status") {
            setStatusMsg(msg);
          } else if (type === "complete" || type === "error") {
            break outer;
          }
        }
      }

      // Fetch final report
      setStatusMsg("Fetching results…");
      const pollRes = await apiFetch(`/api/v1/reports/${id}`);
      if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
      const data: Report = await pollRes.json();
      setReport(data);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Due Diligence Report</h1>
          <p className="mt-1 text-slate-500">
            Enter a company name to generate a multi-agent PE due diligence report.
          </p>
        </div>
        <button
          onClick={() => { clearToken(); router.push("/login"); }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ReportForm onSubmit={handleSubmit} loading={loading} />

          {loading && statusMsg && (
            <div className="flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              {statusMsg}
            </div>
          )}

          {loading && agents.length > 0 && (
            <AgentProgressPanel agents={agents} />
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {report && <ReportViewer report={report} />}
        </div>
        <div>
          <UploadDocument />
        </div>
      </div>
    </div>
  );
}
