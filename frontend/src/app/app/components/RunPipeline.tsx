"use client";

import { Zap, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import type { ReportRequest } from "@/lib/types";
import type { AgentStatus } from "../types";

interface RunPipelineProps {
  req: ReportRequest;
  agents: AgentStatus[];
  statusMsg: string;
  polling: boolean;
  onAbort: () => void;
}

export function RunPipeline({
  req, agents, statusMsg, polling, onAbort,
}: RunPipelineProps) {
  const done = agents.filter((a) => a.state === "done").length;
  const total = agents.length;
  const allDone = done === total;

  return (
    <div className="run-wrap slide-up">
      {/* Run banner */}
      <div className="run-banner">
        <div className="agent-icon blue"><Zap size={15} /></div>
        <div className="run-banner-name">
          {req.company_name}
          {req.ticker && <span className="run-banner-tick" style={{ marginLeft: 10 }}>{req.ticker}</span>}
        </div>
        <button className="cancel-btn" type="button" onClick={onAbort}>
          <X size={12} /> Cancel
        </button>
      </div>

      {/* Status pill */}
      {statusMsg && (
        <div className="status-pill">
          {polling
            ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--y500)" }} />
            : <Spinner size={13} color="var(--b500)" />}
          {statusMsg}
        </div>
      )}

      {/* Pipeline */}
      <div className="pipeline">
        <div className="pipeline-head">
          <span className="pipeline-title">Agent pipeline</span>
          <span className={`tile-state ${allDone ? "done" : "running"}`}>
            {allDone ? "Complete" : polling ? "Polling" : "Running"}
            <span className="dot" />
          </span>
        </div>
        <div className="pipeline-bar">
          <div
            className={`pipeline-bar-fill${allDone ? " done" : ""}`}
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <div className="agent-grid">
          {agents.map((a) => <AgentTile key={a.key} agent={a} />)}
        </div>
      </div>
    </div>
  );
}

function AgentTile({ agent }: { agent: AgentStatus }) {
  const { icon: Icon, tone, label, state, progress, logs, confidence } = agent;
  const isRunning = state === "running";
  const isDone    = state === "done";
  const isFailed  = state === "failed";

  const tileClass  = isRunning ? "running" : isDone ? "done" : isFailed ? "failed" : "";
  const stateClass = isRunning ? "running" : isDone ? "done" : isFailed ? "failed" : "waiting";
  const barClass   = isDone ? "g" : isFailed ? "r" : isRunning ? "b" : "n";
  const stateLabel = isDone ? "Done" : isFailed ? "Failed" : isRunning ? "Running" : "Queued";

  return (
    <div className={`agent-tile ${tileClass}`}>
      <div className="tile-head">
        <span className={`agent-icon ${tone}`}><Icon size={14} /></span>
        <span className="tile-name">{label}</span>
        <span className={`tile-state ${stateClass}`}>
          {isRunning && <span className="dot" />}
          {stateLabel}
        </span>
      </div>
      <div className="tile-bar">
        <div
          className={`tile-bar-fill ${barClass}`}
          style={{ width: `${isDone ? 100 : progress}%` }}
        />
      </div>
      {isDone && confidence !== undefined && (
        <div style={{ fontSize: 10.5, color: "var(--g700)", fontWeight: 600 }}>
          {Math.round(confidence * 100)}% confidence
        </div>
      )}
      {logs.length > 0 && (
        <div className="tile-logs">
          {logs.slice(-2).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
