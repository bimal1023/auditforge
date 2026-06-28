"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/auth";
import type { Report, ReportRequest } from "@/lib/types";
import type { AgentKey, AgentStatus, Phase, RunStatus } from "../types";
import { AGENT_DEFS, AGENT_LABEL } from "../constants";

/**
 * Encapsulates the entire "submit a report → stream → poll → land" lifecycle.
 *
 * Returns:
 *  - State the UI reads: report, agents, loading, statusMsg, polling, error, activeReq, phase, runStatus
 *  - Actions the UI calls: handleSubmit, handleAbort, handleSelectHistorical
 *  - setReport / setError so the page can clear them when navigating
 *  - refreshKey: bumps when a report completes; pass to RecentReports to force a refetch
 */
export function useReportRun() {
  const [report,    setReport]    = useState<Report | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [agents,    setAgents]    = useState<AgentStatus[]>([]);
  const [activeReq, setActiveReq] = useState<ReportRequest | null>(null);
  const [polling,   setPolling]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const abortRef    = useRef<AbortController | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportIdRef = useRef<string | null>(null);

  function initAgents(focus: AgentKey[]): AgentStatus[] {
    return AGENT_DEFS
      .filter((d) => focus.includes(d.key))
      .map(({ key, label, icon, tone }) => ({
        key, label, icon, tone, state: "waiting", progress: 0, logs: [],
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
    if (!window.confirm("Cancel this report? Progress will be lost.")) return;
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

  function handleSelectHistorical(r: Report) {
    abortRef.current?.abort();
    stopProgressTick();
    setReport(r);
    setLoading(false);
    setActiveReq(null);
    setAgents([]);
    setStatusMsg("");
    setError(null);
    setPolling(false);
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
    setAgents(initAgents(req.focus_areas as AgentKey[]));
    setPolling(false);

    try {
      const createRes = await apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify(req),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        // 402 Payment Required = out of memo credits. Bubble up the backend's
        // message verbatim so the dashboard can render an upgrade prompt
        // instead of a generic error.
        const msg = createRes.status === 402
          ? (d.detail ?? "Out of memo credits. Please upgrade your plan.")
          : (d.detail ?? `HTTP ${createRes.status}`);
        throw new Error(msg);
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

      await streamEvents(id, controller);
      stopProgressTick();

      const data = await pollUntilDone(id, controller);
      if (!data) {
        throw new Error("Report is taking longer than expected. Refresh the page to check if it completed.");
      }

      // Backfill agent state from the final report
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

  // ── SSE stream ───────────────────────────────────────────────────────────────
  // The live event stream is BEST-EFFORT. The backend job runs regardless of
  // whether the browser can hold this connection open. So on ANY failure here
  // (can't connect, non-200, mid-stream drop) we must NOT throw — we fall back
  // to polling, which is the real source of truth. Throwing would surface a
  // false "error" to the user even though their report is completing fine.
  async function streamEvents(id: string, controller: AbortController): Promise<void> {
    let sseRes: Response;
    try {
      sseRes = await apiFetch(`/api/v1/reports/${id}/events`, { signal: controller.signal });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      // Couldn't even open the stream — let polling take over silently.
      setPolling(true);
      setStatusMsg("Live updates unavailable — polling for results…");
      return;
    }

    if (!sseRes.ok || !sseRes.body) {
      // SSE endpoint unavailable (proxy hiccup, 5xx). The job is still running;
      // fall back to polling instead of erroring out. Leave agent tiles as-is
      // so polling's event-log replay can backfill their real state.
      setPolling(true);
      setStatusMsg("Live updates unavailable — polling for results…");
      return;
    }

    const reader  = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let streamCompleted = false;

    try {
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
    } catch (err) {
      // A mid-stream network drop rejects reader.read(). That's fine — polling
      // picks up from here. Only re-raise a genuine user abort.
      if ((err as Error)?.name === "AbortError") throw err;
    }

    if (!streamCompleted) {
      setPolling(true);
      setStatusMsg("Connection dropped — polling for results…");
    }
  }

  // ── Polling fallback ─────────────────────────────────────────────────────────
  async function pollUntilDone(id: string, controller: AbortController): Promise<Report | null> {
    const pollInterval = (attempt: number) =>
      attempt < 24 ? 5_000 : attempt < 48 ? 10_000 : 15_000;

    setStatusMsg("Waiting for report to finalise…");
    let data: Report | null = null;
    let consecutiveErrors = 0;

    for (let attempt = 0; attempt < 80; attempt++) {
      if (controller.signal.aborted) break;

      let fetched: Report | null = null;
      try {
        const [pollRes, logRes] = await Promise.all([
          apiFetch(`/api/v1/reports/${id}`),
          apiFetch(`/api/v1/reports/${id}/event-log`).catch(() => null),
        ]);
        if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
        fetched = await pollRes.json();
        consecutiveErrors = 0;

        // Replay any events we may have missed during a connection drop
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
                    : a,
                );
              } else if (type === "agent_done") {
                next = next.map((a) =>
                  a.key === key && a.state !== "done"
                    ? { ...a, state: "done" as const, confidence: conf, progress: 100,
                        logs: [...(a.logs.length ? a.logs : []), conf !== undefined ? `✓ Complete — ${Math.round(conf * 100)}% confidence` : "✓ Complete"] }
                    : a,
                );
              } else if (type === "agent_fail") {
                next = next.map((a) =>
                  a.key === key && a.state !== "failed"
                    ? { ...a, state: "failed" as const, logs: [...(a.logs.length ? a.logs : []), `✗ ${(ev.reason as string) ?? "Failed"}`] }
                    : a,
                );
              } else if (type === "status" && key) {
                next = next.map((a) =>
                  a.key === key ? { ...a, logs: a.logs.includes(msg) ? a.logs : [...a.logs, msg] } : a,
                );
              }
            }
            return next;
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") break;
        // Transient network/proxy blip — don't kill the run. Tolerate a few in
        // a row, then give up (caller surfaces a "refresh to check" message).
        if (++consecutiveErrors >= 6) throw err;
      }

      if (fetched && (fetched.status === "complete" || fetched.status === "error")) {
        data = fetched;
        break;
      }

      const interval = pollInterval(attempt);
      const elapsedS = attempt < 24 ? (attempt + 1) * 5
        : attempt < 48 ? 120 + (attempt - 24 + 1) * 10
        : 360 + (attempt - 48 + 1) * 15;
      setStatusMsg(`Still processing… (~${Math.round(elapsedS / 60)}m elapsed)`);
      await new Promise((res) => setTimeout(res, interval));
    }

    return data;
  }

  const phase: Phase =
    loading ? "generating" : report ? "loaded" : "idle";
  const runStatus: RunStatus =
    phase === "generating" ? "running"
    : phase === "loaded" ? "complete"
    : error ? "error" : "idle";

  return {
    // state
    report, loading, statusMsg, error, agents, activeReq, polling, refreshKey, phase, runStatus,
    // setters
    setReport, setError,
    // actions
    handleSubmit, handleAbort, handleSelectHistorical,
  };
}
