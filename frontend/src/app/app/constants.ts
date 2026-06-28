import { BarChart2, ShieldAlert, Globe, Scale } from "lucide-react";
import type { AgentKey, AgentTone, NavTab } from "./types";

/** Static metadata for each specialist agent. Drives the form, run pipeline, and labels. */
export const AGENT_DEFS: {
  key: AgentKey;
  label: string;
  icon: React.FC<{ size?: number }>;
  tone: AgentTone;
  blurb: string;
  sources: string[];
  eta: string;
}[] = [
  { key: "financial", label: "Financial", icon: BarChart2, tone: "blue",
    blurb: "Revenue, margins, segments, cash flow",
    sources: ["SEC EDGAR", "10-K", "10-Q", "earnings"], eta: "~38s" },
  { key: "risk", label: "Risk", icon: ShieldAlert, tone: "amber",
    blurb: "Material risks, concentration, going-concern",
    sources: ["Item 1A", "8-K", "litigation index"], eta: "~42s" },
  { key: "market", label: "Market", icon: Globe, tone: "green",
    blurb: "TAM, share, competitive moat, demand signals",
    sources: ["Web", "IDC", "industry refs"], eta: "~31s" },
  { key: "legal", label: "Legal & Regulatory", icon: Scale, tone: "teal",
    blurb: "Litigation, regulatory, IP, antitrust exposure",
    sources: ["PACER", "DOJ", "FTC", "USPTO"], eta: "~48s" },
];

export const AGENT_LABEL: Record<string, string> = Object.fromEntries(
  AGENT_DEFS.map((d) => [d.key, d.label]),
);

/** Breadcrumb labels for the topbar (current page). */
export const TAB_LABELS: Record<NavTab, string> = {
  "new-report": "New report",
  "memos": "Memos",
  "live-monitor": "Live monitor",
  "watchlist": "Portfolio",
  "pipeline": "Pipeline",
  "earnings": "Earnings",
  "comps": "Comps",
  "screener": "Screener",
  "knowledge-base": "Knowledge base",
  "templates": "Templates",
  "citations": "Citations",
  "activity": "Activity",
  "team": "Team",
  "usage": "Usage",
  "settings": "Settings",
};

/** Breadcrumb parent group for each tab. */
export const TAB_PARENT: Record<NavTab, string> = {
  "new-report": "Reports",
  "memos": "Reports",
  "live-monitor": "Reports",
  "watchlist": "Reports",
  "pipeline": "Reports",
  "earnings": "Reports",
  "comps": "Reports",
  "screener": "Reports",
  "knowledge-base": "Library",
  "templates": "Library",
  "citations": "Library",
  "activity": "Desk",
  "team": "Desk",
  "usage": "Desk",
  "settings": "Desk",
};

/** Recently-viewed company chips shown on the new-report form. */
export const RECENTS: { name: string; ticker: string }[] = [
  { name: "NVIDIA Corporation", ticker: "NVDA" },
  { name: "Microsoft",          ticker: "MSFT" },
  { name: "Tesla, Inc.",        ticker: "TSLA" },
  { name: "Stripe",             ticker: "PRIV" },
];
