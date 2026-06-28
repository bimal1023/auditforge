/**
 * Dashboard-local types. Imported by components/hooks/page.tsx.
 * Domain-wide types (Report, ReportRequest, etc.) live in @/lib/types.
 */

export type AgentKey = "financial" | "risk" | "market" | "legal";
export type AgentTone = "blue" | "amber" | "green" | "teal";

export type AgentState = "waiting" | "running" | "done" | "failed";

export interface AgentStatus {
  key: AgentKey;
  label: string;
  icon: React.FC<{ size?: number }>;
  tone: AgentTone;
  state: AgentState;
  confidence?: number;
  progress: number;
  logs: string[];
}

export type NavTab =
  | "new-report" | "memos" | "live-monitor" | "watchlist" | "pipeline" | "earnings" | "comps" | "screener"
  | "knowledge-base" | "templates" | "citations"
  | "activity" | "team" | "usage" | "settings";

export interface NewReportInitial {
  company_name?: string;
  ticker?: string;
  focus_areas?: string[];
  context?: string;
}

export type RunStatus = "idle" | "running" | "complete" | "error";
export type Phase = "idle" | "generating" | "loaded";
