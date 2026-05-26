"use client";

import { useState } from "react";
import { useIsMobile } from "@/lib/hooks";
import {
  Download, Share2, BarChart2, ShieldAlert, Globe, Scale,
  AlertTriangle, Info, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Database, Link, ExternalLink,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import {
  ScoreGauge, ConfidencePill, Sparkline, Eyebrow,
  fmtUSD, fmtPct, fmtSignedPct, Spinner,
} from "./ui";
import type {
  Report, FinancialSection, FinancialMetric,
  RiskSection, MarketSection, LegalSection, Citation,
} from "@/lib/types";

interface Props { report: Report }

type Tab = "financial" | "risk" | "market" | "legal";

const TABS: { key: Tab; label: string; icon: React.ElementType; accent: string }[] = [
  { key: "financial", label: "Financial",  icon: BarChart2,   accent: "#1B3A6B" },
  { key: "risk",      label: "Risk",       icon: ShieldAlert, accent: "#9A5800" },
  { key: "market",    label: "Market",     icon: Globe,       accent: "#0A6640" },
  { key: "legal",     label: "Legal",      icon: Scale,       accent: "#1554A6" },
];

export function ReportViewer({ report }: Props) {
  const isMobile = useIsMobile();
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>("financial");

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/reports/${report.id}/pdf`, { headers: authHeaders() });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: "Download failed" })); alert(e.detail ?? "Download failed"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `auditforge_${report.company}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("PDF download failed"); }
    finally { setDownloading(false); }
  }

  if (report.status === "error") {
    return (
      <div style={{
        borderRadius: 14, border: "1px solid #FECACA",
        background: "var(--red-soft)", padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>⚠</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red-ink)", marginBottom: 4 }}>Report generation failed</div>
          <div style={{ fontSize: 13, color: "var(--red-ink)", opacity: 0.8 }}>{report.error}</div>
        </div>
      </div>
    );
  }

  const { financial, risk, market, legal } = report;
  const totalCitations = [financial, risk, market, legal]
    .filter(Boolean)
    .reduce((n, s) => n + (s!.citations?.length ?? 0), 0);

  const availableTabs = TABS.filter(({ key }) => !!report[key as keyof Report]);
  const tab = availableTabs.find((t) => t.key === activeTab) ?? availableTabs[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "af-slide-up 0.4s ease-out" }}>

      {/* ── Report header card ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, boxShadow: "var(--shadow-md)", overflow: "hidden",
      }}>
        {/* Top section: meta + score */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column-reverse" : "row", padding: isMobile ? "18px 16px" : "24px 28px", gap: isMobile ? 16 : 28, alignItems: "stretch" }}>
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
                  onClick={downloadPdf} disabled={downloading}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 14px",
                    fontSize: 13, fontWeight: 600,
                    background: "var(--ink)", color: "#fff",
                    border: "none", borderRadius: 9,
                    cursor: downloading ? "not-allowed" : "pointer",
                    opacity: downloading ? 0.7 : 1,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "opacity 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.background = "#1A1A1F"; }}
                  onMouseLeave={(e) => { if (!downloading) e.currentTarget.style.background = "var(--ink)"; }}
                >
                  {downloading ? <><Spinner size={13} color="#fff" /> Exporting…</> : <><Download size={13} /> Export PDF</>}
                </button>
              )}
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 36, padding: "0 14px",
                fontSize: 13, fontWeight: 600,
                background: "var(--surface)", color: "var(--ink)",
                border: "1px solid var(--border-strong)",
                borderRadius: 9, cursor: "pointer",
                boxShadow: "var(--shadow-xs)",
              }}>
                <Share2 size={13} /> Share
              </button>
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
            padding: "0 6px",
            overflowX: "auto",
          }}>
            {availableTabs.map(({ key, label, icon: Icon, accent }) => {
              const active = (tab?.key ?? activeTab) === key;
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
          <div key={activeTab} style={{ padding: isMobile ? "16px 14px" : 24, animation: "af-fade-in 0.2s ease-out" }}>
            {activeTab === "financial" && financial && <FinancialContent section={financial} isMobile={isMobile} />}
            {activeTab === "risk"      && risk      && <RiskContent      section={risk} />}
            {activeTab === "market"    && market    && <MarketContent    section={market} />}
            {activeTab === "legal"     && legal     && <LegalContent     section={legal} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section header (used inside each tab) ── */
function SectionHeader({ title, subtitle, confidence, citations, accent }: {
  title: string; subtitle?: string;
  confidence: number; citations: Citation[]; accent: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {citations.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-4)" }}>
            <Database size={11} /> {citations.length} sources
          </span>
        )}
        <ConfidencePill score={confidence} />
      </div>
    </div>
  );
}

/* ── Financial ── */
function FinancialContent({ section, isMobile }: { section: FinancialSection; isMobile: boolean }) {
  const rows: { label: string; arr: FinancialMetric[]; color: string }[] = [
    { label: "Revenue",         arr: section.revenue,              color: "#2563EB" },   /* royal blue       */
    { label: "Gross profit",    arr: section.gross_profit,         color: "#16A34A" },   /* leaf green       */
    { label: "EBITDA",          arr: section.ebitda,               color: "#0891B2" },   /* ocean teal       */
    { label: "Net income",      arr: section.net_income,           color: "#7C5CFC" },   /* rich violet      */
    { label: "Total debt",      arr: section.total_debt,           color: "#EA580C" },   /* warm orange      */
    { label: "Cash & equiv.",   arr: section.cash_and_equivalents, color: "#0D9488" },   /* teal-green       */
  ].filter((r) => r.arr?.length > 0);

  const keyRatios = Object.entries(section.key_ratios ?? {});

  return (
    <>
      <SectionHeader
        title="Financial Analysis"
        subtitle="Income statement · cash position · key ratios"
        confidence={section.confidence_score}
        citations={section.citations}
        accent="#1B3A6B"
      />
      <p style={{ margin: "0 0 22px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{section.summary}</p>

      {rows.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Key metrics — last fiscal years</Eyebrow>
          <div className="af-table-scroll" style={{
            border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
            marginBottom: 20,
          }}>
            <table style={{ width: "100%", minWidth: isMobile ? 480 : undefined, borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Metric", "Latest", "Prior", "YoY", "Trend"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: "var(--ink-4)",
                      textAlign: i === 0 ? "left" : "right",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const sorted   = [...row.arr].sort((a, b) => b.year - a.year);
                  const sparkData = [...row.arr].sort((a, b) => a.year - b.year).map((m) => m.value);
                  const yoy      = sorted[0]?.growth_rate;
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--ink)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 3, height: 14, borderRadius: 999, background: row.color, flexShrink: 0 }} />
                          {row.label}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--ink)" }}>
                        {sorted[0] ? "$" + fmtUSD(sorted[0].value) : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>
                        {sorted[1] ? "$" + fmtUSD(sorted[1].value) : "—"}
                      </td>
                      <td style={{
                        padding: "11px 14px", textAlign: "right",
                        fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                        color: yoy == null ? "var(--ink-4)" : yoy >= 0 ? "var(--green-ink)" : "var(--red-ink)",
                      }}>
                        {yoy != null ? fmtSignedPct(yoy) : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <Sparkline data={sparkData} width={72} height={22} stroke={row.color} strokeWidth={1.5} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {keyRatios.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 12 }}>Key ratios</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {keyRatios.map(([k, v], i) => (
              <div key={i} style={{
                padding: "14px 16px",
                background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10,
              }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600, marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "-0.02em" }}>
                  {v.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CitationFooter citations={section.citations} />
    </>
  );
}

/* ── Risk ── */
const SEV: Record<string, { color: string; bg: string; ink: string; icon: React.ElementType }> = {
  high:   { color: "var(--red)",   bg: "var(--red-soft)",   ink: "var(--red-ink)",   icon: AlertTriangle },
  medium: { color: "var(--amber)", bg: "var(--amber-soft)", ink: "var(--amber-ink)", icon: AlertTriangle },
  low:    { color: "var(--ink-3)", bg: "var(--surface-2)",  ink: "var(--ink-2)",     icon: Info },
};

function RiskContent({ section }: { section: RiskSection }) {
  const high   = section.risks.filter((r) => r.severity === "high");
  const medium = section.risks.filter((r) => r.severity === "medium");
  const low    = section.risks.filter((r) => r.severity === "low");
  const grouped = [
    { sev: "high", items: high },
    { sev: "medium", items: medium },
    { sev: "low", items: low },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <SectionHeader
        title="Risk Assessment"
        subtitle="Material risk factors · severity-weighted"
        confidence={section.confidence_score}
        citations={section.citations}
        accent="#D97706"
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{section.summary}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {grouped.map(({ sev, items }) => {
          const style = SEV[sev] ?? SEV.low;
          return (
            <div key={sev}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              }}>
                <Eyebrow style={{ color: style.ink }}>{sev.charAt(0).toUpperCase() + sev.slice(1)} severity</Eyebrow>
                <div style={{
                  width: 18, height: 18, borderRadius: 999,
                  background: style.bg, color: style.ink,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800,
                }}>{items.length}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((r, i) => {
                  const s = SEV[r.severity] ?? SEV.low;
                  const SevIcon = s.icon;
                  return (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "auto 1fr auto",
                      gap: 12, padding: "14px 16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${s.color}`,
                      borderRadius: 10, alignItems: "flex-start",
                      transition: "background 0.15s",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 7,
                        background: s.bg, color: s.color,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <SevIcon size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{r.title}</div>
                        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-3)" }}>{r.description}</p>
                        {r.citation?.source && (
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Link size={10} /> {r.citation.source}
                          </div>
                        )}
                      </div>
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "var(--ink-5)" }}>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <CitationFooter citations={section.citations} />
    </>
  );
}

/* ── Market ── */
function MarketContent({ section }: { section: MarketSection }) {
  return (
    <>
      <SectionHeader
        title="Market Intelligence"
        subtitle="TAM · competitor share · momentum factors"
        confidence={section.confidence_score}
        citations={section.citations}
        accent="#059669"
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{section.summary}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {section.market_size_usd != null && (
            <div style={{ padding: "18px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Total addressable market</Eyebrow>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                ${fmtUSD(section.market_size_usd)}
              </div>
            </div>
          )}
          {section.market_share != null && (
            <div style={{ padding: "16px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Estimated market share</Eyebrow>
              <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {fmtPct(section.market_share)}
              </div>
            </div>
          )}
        </div>

        {section.competitors.length > 0 && (
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Top competitors</Eyebrow>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {section.competitors.map((c, i) => {
                const maxShare = Math.max(...section.competitors.map((x) => x.estimated_market_share ?? 0), 0.3);
                return (
                  <div key={i} style={{
                    padding: "11px 14px",
                    borderBottom: i < section.competitors.length - 1 ? "1px solid var(--border)" : "none",
                    display: "grid", gridTemplateColumns: "1fr auto",
                    alignItems: "center", gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{c.name}</div>
                      <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: c.estimated_market_share != null ? `${Math.min(100, (c.estimated_market_share / maxShare) * 100)}%` : "0%",
                          background: "#059669", borderRadius: 999,
                          transition: "width 0.8s cubic-bezier(.2,.7,.3,1)",
                        }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                      {c.estimated_market_share != null ? fmtPct(c.estimated_market_share) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {section.growth_drivers.length > 0 && (
          <div style={{ padding: "16px", background: "var(--green-soft)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 12 }}>
            <Eyebrow style={{ color: "var(--green-ink)", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={10} /> Growth drivers
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {section.growth_drivers.map((d, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--green-ink)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: "var(--green)" }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {section.headwinds.length > 0 && (
          <div style={{ padding: "16px", background: "var(--red-soft)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12 }}>
            <Eyebrow style={{ color: "var(--red-ink)", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingDown size={10} /> Headwinds
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {section.headwinds.map((h, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--red-ink)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: "var(--red)" }} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CitationFooter citations={section.citations} />
    </>
  );
}

/* ── Legal ── */
function LegalContent({ section }: { section: LegalSection }) {
  const isMobile = useIsMobile();
  return (
    <>
      <SectionHeader
        title="Legal & Regulatory"
        subtitle="Active litigation · regulatory exposure"
        confidence={section.confidence_score}
        citations={section.citations}
        accent="#2563EB"
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{section.summary}</p>

      {section.litigations.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Active litigation</Eyebrow>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            {section.litigations.map((l, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto",
                gap: 16, padding: "14px 16px",
                borderBottom: i < section.litigations.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
                background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{l.case_name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>{l.description}</div>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", fontSize: 11, fontWeight: 700,
                  borderRadius: 999, whiteSpace: "nowrap",
                  background: l.status === "Settled" ? "var(--green-soft)" : "var(--amber-soft)",
                  color: l.status === "Settled" ? "var(--green-ink)" : "var(--amber-ink)",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: l.status === "Settled" ? "var(--green)" : "var(--amber)" }} />
                  {l.status}
                </span>
                {l.potential_liability_usd != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--red-ink)", fontVariantNumeric: "tabular-nums" }}>
                      ${fmtUSD(l.potential_liability_usd)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)" }}>est. liability</div>
                  </div>
                )}
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "var(--ink-5)" }}>
                  <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {section.regulatory_issues.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Regulatory issues</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {section.regulatory_issues.map((r, i) => (
              <div key={i} style={{ padding: "14px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                {r.agency && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{r.agency}</div>}
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>{String(r.description ?? "")}</div>
                {r.potential_fine_usd != null && (
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--red-ink)", fontVariantNumeric: "tabular-nums" }}>
                    ${fmtUSD(r.potential_fine_usd)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <CitationFooter citations={section.citations} />
    </>
  );
}

/* ── Citation footer ── */
function CitationFooter({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div style={{
      marginTop: 20, padding: "12px 14px",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <Eyebrow style={{ flexShrink: 0, marginRight: 4 }}>Sources</Eyebrow>
      {citations.slice(0, 6).map((c, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, fontSize: 11.5, color: "var(--ink-2)",
          fontWeight: 500,
        }}>
          <Link size={10} color="var(--ink-4)" />
          {c.url
            ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.source}</a>
            : c.source
          }
        </span>
      ))}
      {citations.length > 6 && (
        <span style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 500 }}>+{citations.length - 6} more</span>
      )}
    </div>
  );
}
