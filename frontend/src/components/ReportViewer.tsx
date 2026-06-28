"use client";

import { useState } from "react";
import { useIsMobile } from "@/lib/hooks";
import {
  Printer, BarChart2, ShieldAlert, Globe, Scale,
  AlertTriangle, ArrowUp, ArrowDown, Database, ListChecks, MessageSquare, Braces, Sparkles,
} from "lucide-react";
import { ScoreGauge, fmtUSD, fmtPct, fmtSignedPct } from "./ui";
import type { Report } from "@/lib/types";

import { Financial } from "./report/Financial";
import { Risk } from "./report/Risk";
import { Market } from "./report/Market";
import { Legal } from "./report/Legal";
import { ActionQueue } from "./report/ActionQueue";
import { PrintReport } from "./report/PrintReport";
import { AskPanel } from "./report/AskPanel";
import CommentsPanel from "./CommentsPanel";

interface Props { report: Report }

type Tab = "financial" | "risk" | "market" | "legal" | "ask" | "actions" | "discussion";

const TABS: { key: Tab; label: string; icon: React.ElementType; accent: string }[] = [
  { key: "financial", label: "Financial",  icon: BarChart2,   accent: "var(--brand)" },
  { key: "risk",      label: "Risk",       icon: ShieldAlert, accent: "var(--amber)" },
  { key: "market",    label: "Market",     icon: Globe,       accent: "var(--green)" },
  { key: "legal",     label: "Legal",      icon: Scale,       accent: "var(--teal)" },
];

/** Conversational assistant grounded in this report — only useful once it's complete. */
const ASK_TAB: { key: Tab; label: string; icon: React.ElementType; accent: string } =
  { key: "ask", label: "Ask", icon: Sparkles, accent: "var(--brand)" };

/** Always-present synthesis tab — turns findings into next-step diligence tasks. */
const ACTIONS_TAB: { key: Tab; label: string; icon: React.ElementType; accent: string } =
  { key: "actions", label: "Action Queue", icon: ListChecks, accent: "var(--purple)" };

const DISCUSSION_TAB: { key: Tab; label: string; icon: React.ElementType; accent: string } =
  { key: "discussion", label: "Discussion", icon: MessageSquare, accent: "var(--teal)" };

export function ReportViewer({ report }: Props) {
  const isMobile = useIsMobile();
  const [showPrint, setShowPrint]     = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>("financial");

  /** Download the report as a typed JSON file (client-side — exact in-memory payload). */
  const handleExportJson = () => {
    const safe = (report.company || "report")
      .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 50) || "report";
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arthvion_${safe}_${report.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (report.status === "error") {
    return (
      <div style={{
        borderRadius: 14, border: "1px solid var(--red-soft)",
        background: "var(--red-soft)", padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>⚠</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red-ink)", marginBottom: 4 }}>
            Report generation failed
          </div>
          <div style={{ fontSize: 13, color: "var(--red-ink)", opacity: 0.8 }}>{report.error}</div>
        </div>
      </div>
    );
  }

  const { financial, risk, market, legal } = report;
  const totalCitations = [financial, risk, market, legal]
    .filter(Boolean)
    .reduce((n, s) => n + (s!.citations?.length ?? 0), 0);

  const sectionTabs = TABS.filter(({ key }) => !!report[key as keyof Report]);
  // "Ask" needs a finished report to ground answers against (the chat endpoint
  // 400s on incomplete reports), so only surface it once status is complete.
  const askTab = report.status === "complete" ? [ASK_TAB] : [];
  const availableTabs = [...sectionTabs, ...askTab, ACTIONS_TAB, DISCUSSION_TAB];
  const tab = availableTabs.find((t) => t.key === activeTab) ?? availableTabs[0];
  // The default `activeTab` ("financial") may not be one of the available tabs
  // when that section didn't come back (e.g. a Market-only report). Render off
  // the *resolved* tab so the content matches the highlighted tab — otherwise
  // the first section shows blank until the user clicks away and back.
  const currentTab = tab?.key ?? activeTab;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "af-slide-up 0.4s ease-out" }}>

      {/* ── Report header card ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, boxShadow: "var(--shadow-md)", overflow: "hidden",
      }}>
        {/* Top section: meta + score */}
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column-reverse" : "row",
          padding: isMobile ? "18px 16px" : "24px 28px",
          gap: isMobile ? 16 : 28, alignItems: "stretch",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {/* Badge row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", fontSize: 11, fontWeight: 700,
                background: "var(--brand-soft)", color: "var(--brand-ink)",
                borderRadius: 999, letterSpacing: "0.02em",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)" }} />
                Due Diligence Report
              </span>
              {totalCitations > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11, color: "var(--ink-4)",
                }}>
                  <Database size={11} /> {totalCitations} citations
                </span>
              )}
            </div>

            {/* Title */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{
                margin: 0, fontSize: 34, fontWeight: 800,
                letterSpacing: "-0.03em", color: "var(--ink)",
              }}>
                {report.company}
              </h1>
              {report.ticker && (
                <span style={{
                  fontSize: 13, fontWeight: 700, color: "var(--ink-3)",
                  padding: "3px 9px", border: "1px solid var(--border-strong)",
                  borderRadius: 6, background: "var(--surface-2)",
                  fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.04em",
                }}>{report.ticker}</span>
              )}
            </div>

            {/* Summary */}
            {report.executive_summary && (
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.7,
                color: "var(--ink-2)", maxWidth: 580,
              }}>
                {report.executive_summary}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              {report.status === "complete" && (
                <button
                  onClick={() => setShowPrint(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 14px",
                    fontSize: 13, fontWeight: 600,
                    background: "var(--ink)", color: "#fff",
                    border: "none", borderRadius: 9,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "opacity 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ink-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--ink)"; }}
                >
                  <Printer size={13} /> Print Report
                </button>
              )}
              {report.status === "complete" && (
                <button
                  onClick={handleExportJson}
                  title="Download the report as typed JSON"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 14px",
                    fontSize: 13, fontWeight: 600,
                    background: "var(--surface)", color: "var(--ink-2)",
                    border: "1px solid var(--border-strong)", borderRadius: 9,
                    cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
                >
                  <Braces size={13} /> Export JSON
                </button>
              )}
            </div>
          </div>

          {/* Score gauge */}
          {report.overall_score != null && (
            <div style={{
              flexShrink: 0,
              paddingLeft: isMobile ? 0 : 28,
              borderLeft: isMobile ? "none" : "1px solid var(--border)",
              borderBottom: isMobile ? "1px solid var(--border)" : "none",
              paddingBottom: isMobile ? 16 : 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minWidth: isMobile ? undefined : 220,
            }}>
              <ScoreGauge score={report.overall_score} size={isMobile ? 150 : 190} />
            </div>
          )}
        </div>

        {/* Key metrics strip */}
        {financial?.revenue?.[0] && (
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}>
            {[
              {
                label: "Revenue (TTM)",
                value: "$" + fmtUSD(financial.revenue[0].value),
                delta: fmtSignedPct(financial.revenue[0].growth_rate),
                up: (financial.revenue[0].growth_rate ?? 0) >= 0,
              },
              {
                label: "Net Income",
                value: financial.net_income?.[0] ? "$" + fmtUSD(financial.net_income[0].value) : "—",
                delta: fmtSignedPct(financial.net_income?.[0]?.growth_rate),
                up: (financial.net_income?.[0]?.growth_rate ?? 0) >= 0,
              },
              {
                label: "Market Share",
                value: market?.market_share ? fmtPct(market.market_share) : "—",
                delta: "",
                up: true,
              },
              {
                label: "Active Risks",
                value: risk ? `${risk.risks.length}` : "—",
                delta: risk ? `${risk.risks.filter((r) => r.severity === "high").length} high severity` : "",
                up: false,
                warn: true,
              },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "18px 22px",
                borderRight: i < 3 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                {s.delta && (
                  <div style={{
                    fontSize: 11.5, marginTop: 3,
                    color: s.warn ? "var(--amber-ink)" : s.up ? "var(--green-ink)" : "var(--red-ink)",
                    display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600,
                  }}>
                    {s.warn ? <AlertTriangle size={11} /> : s.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {s.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section tabs ── */}
      {availableTabs.length > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, boxShadow: "var(--shadow-sm)", overflow: "hidden",
        }}>
          {/* Tab bar */}
          <div style={{
            display: "flex", borderBottom: "1px solid var(--border)",
            padding: "0 6px", overflowX: "auto",
          }}>
            {availableTabs.map(({ key, label, icon: Icon, accent }) => {
              const active = currentTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    height: 48, padding: "0 16px",
                    background: "none", border: "none",
                    borderBottom: `2.5px solid ${active ? accent : "transparent"}`,
                    color: active ? "var(--ink)" : "var(--ink-4)",
                    fontSize: 13.5, fontWeight: active ? 700 : 500,
                    fontFamily: "Inter, sans-serif",
                    cursor: "pointer",
                    transition: "color 0.15s, border-color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={14} color={active ? accent : "var(--ink-4)"} style={{ transition: "color 0.15s" }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div key={currentTab} style={{ padding: isMobile ? "16px 14px" : 24, animation: "af-fade-in 0.2s ease-out" }}>
            {currentTab === "financial" && financial && <Financial section={financial} isMobile={isMobile} />}
            {currentTab === "risk"      && risk      && <Risk      section={risk} />}
            {currentTab === "market"    && market    && <Market    section={market} />}
            {currentTab === "legal"     && legal     && <Legal     section={legal} />}
            {currentTab === "ask"       && <AskPanel report={report} />}
            {currentTab === "actions"   && <ActionQueue reportId={report.id} isComplete={report.status === "complete"} />}
            {currentTab === "discussion" && <CommentsPanel targetType="report" targetId={report.id} />}
          </div>
        </div>
      )}

      {/* Print overlay — full-page view with all sections */}
      {showPrint && <PrintReport report={report} onClose={() => setShowPrint(false)} />}
    </div>
  );
}
