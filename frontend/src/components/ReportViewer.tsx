"use client";

import { useState } from "react";
import {
  Download, Share2, Copy, Link, ExternalLink,
  BarChart2, ShieldAlert, Globe, Scale,
  AlertTriangle, Info, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Database, Clock,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import {
  ScoreGauge, ConfidencePill, Sparkline, Eyebrow, fmtUSD, fmtPct, fmtSignedPct,
} from "./ui";
import type {
  Report, FinancialSection, FinancialMetric,
  RiskSection, MarketSection, LegalSection, Citation,
} from "@/lib/types";

interface Props { report: Report }

export function ReportViewer({ report }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/reports/${report.id}/pdf`, { headers: authHeaders() });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: "Download failed" })); alert(e.detail ?? "Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `auditforge_${report.company}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("PDF download failed"); }
    finally { setDownloading(false); }
  }

  if (report.status === "error") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #FECACA", background: "var(--red-soft)", padding: 16, fontSize: 13, color: "var(--red-ink)" }}>
        Report generation failed: {report.error}
      </div>
    );
  }

  const financial = report.financial;
  const risk      = report.risk;
  const market    = report.market;
  const legal     = report.legal;

  const totalCitations = [financial, risk, market, legal]
    .filter(Boolean)
    .reduce((n, s) => n + (s!.citations?.length ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "af-slide-in 0.3s ease-out" }}>
      {/* ── Report header ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "20px 24px", gap: 24, alignItems: "stretch" }}>
          {/* Left: meta + title + actions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", fontSize: 11, fontWeight: 600,
                background: "var(--brand-soft)", color: "var(--brand-ink)",
                borderRadius: 999,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)" }} />
                Investment Thesis
              </span>
              {totalCitations > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-4)" }}>
                  <Clock size={11} />
                  <Database size={11} />
                  {totalCitations} citations
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
                {report.company}
              </h1>
              {report.ticker && (
                <span style={{
                  fontSize: 14, fontWeight: 600, color: "var(--ink-3)",
                  padding: "3px 8px", border: "1px solid var(--border-strong)",
                  borderRadius: 6, background: "var(--surface-2)",
                  fontFamily: "JetBrains Mono, monospace",
                }}>{report.ticker}</span>
              )}
            </div>

            {report.executive_summary && (
              <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620 }}>
                {report.executive_summary}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              {report.status === "complete" && (
                <button
                  onClick={downloadPdf} disabled={downloading}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    height: 34, padding: "0 12px",
                    fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
                    background: "var(--ink)", color: "#fff",
                    border: "1px solid var(--ink)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.18)",
                    borderRadius: 9, cursor: "pointer", opacity: downloading ? 0.6 : 1,
                  }}
                >
                  <Download size={14} />
                  {downloading ? "Downloading…" : "Export PDF"}
                </button>
              )}
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 34, padding: "0 12px",
                fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
                background: "var(--surface)", color: "var(--ink)",
                border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xs)",
                borderRadius: 9, cursor: "pointer",
              }}>
                <Share2 size={14} /> Share
              </button>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 34, padding: "0 10px",
                fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
                background: "transparent", color: "var(--ink-2)",
                border: "1px solid transparent", cursor: "pointer",
              }}>
                <Copy size={14} /> Duplicate
              </button>
            </div>
          </div>

          {/* Right: score gauge */}
          {report.overall_score != null && (
            <div style={{
              flexShrink: 0, paddingLeft: 24,
              borderLeft: "1px solid var(--border)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              minWidth: 230,
            }}>
              <ScoreGauge score={report.overall_score} size={200} />
            </div>
          )}
        </div>

        {/* Stat strip */}
        {financial?.revenue?.[0] && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            borderTop: "1px solid var(--border)", background: "var(--surface-2)",
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
                label: "Market share",
                value: market?.market_share ? fmtPct(market.market_share) : "—",
                delta: "",
                up: true,
              },
              {
                label: "Active risks",
                value: risk ? `${risk.risks.length} items` : "—",
                delta: risk ? `${risk.risks.filter((r) => r.severity === "high").length} high severity` : "",
                up: false,
                warn: true,
              },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "16px 20px",
                borderRight: i < 3 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                {s.delta && (
                  <div style={{
                    fontSize: 11.5, marginTop: 2,
                    color: s.warn ? "var(--amber-ink)" : s.up ? "var(--green-ink)" : "var(--red-ink)",
                    display: "inline-flex", alignItems: "center", gap: 4,
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

      {financial && <FinancialCard section={financial} />}
      {risk      && <RiskCard       section={risk} />}
      {market    && <MarketCard     section={market} />}
      {legal     && <LegalCard      section={legal} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic section card wrapper
// ---------------------------------------------------------------------------
function SectionCard({
  icon: IconCmp, title, subtitle, confidence, citations, accent = "var(--brand)", children,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  confidence: number; citations: Citation[]; accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${accent}14`, color: accent,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${accent}26`,
          }}>
            <IconCmp size={16} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.005em" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {citations.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-3)" }}>
              <Database size={11} />{citations.length} sources
            </span>
          )}
          <ConfidencePill score={confidence} />
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------
function FinancialCard({ section }: { section: FinancialSection }) {
  const rows: { label: string; arr: FinancialMetric[]; color: string }[] = [
    { label: "Revenue",       arr: section.revenue,            color: "var(--brand)" },
    { label: "Gross profit",  arr: section.gross_profit,       color: "var(--green)" },
    { label: "EBITDA",        arr: section.ebitda,             color: "#0EA5E9" },
    { label: "Net income",    arr: section.net_income,         color: "var(--ink)" },
    { label: "Total debt",    arr: section.total_debt,         color: "var(--amber)" },
    { label: "Cash & equiv.", arr: section.cash_and_equivalents, color: "#10B981" },
  ].filter((r) => r.arr?.length > 0);

  const keyRatios = Object.entries(section.key_ratios ?? {});

  return (
    <SectionCard
      icon={BarChart2} title="Financial Analysis"
      subtitle="Income statement · cash position · efficiency ratios"
      confidence={section.confidence_score} citations={section.citations}
      accent="var(--brand)"
    >
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)" }}>{section.summary}</p>

      <Eyebrow style={{ marginBottom: 8 }}>Key metrics · last fiscal years</Eyebrow>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ color: "var(--ink-4)", fontSize: 11, fontWeight: 600, textAlign: "left", letterSpacing: "0.02em" }}>
            <th style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--border)" }}>Metric</th>
            <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>Latest</th>
            <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>Prior</th>
            <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>YoY</th>
            <th style={{ padding: "8px 0 8px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const sorted = [...row.arr].sort((a, b) => b.year - a.year);
            const sparkData = [...row.arr].sort((a, b) => a.year - b.year).map((m) => m.value);
            return (
              <tr key={i} style={{ background: i % 2 === 1 ? "var(--surface-2)" : "transparent" }}>
                <td style={{ padding: "9px 8px 9px 0", fontWeight: 500, color: "var(--ink)" }}>{row.label}</td>
                <td style={{ padding: "9px 4px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums", color: sorted[0] ? "var(--ink)" : "var(--ink-5)" }}>
                  {sorted[0] ? "$" + fmtUSD(sorted[0].value) : "—"}
                </td>
                <td style={{ padding: "9px 4px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums", color: sorted[1] ? "var(--ink-3)" : "var(--ink-5)" }}>
                  {sorted[1] ? "$" + fmtUSD(sorted[1].value) : "—"}
                </td>
                <td style={{
                  padding: "9px 4px", textAlign: "right",
                  fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums",
                  color: (sorted[0]?.growth_rate ?? 0) >= 0 ? "var(--green-ink)" : "var(--red-ink)",
                  fontWeight: 600,
                }}>
                  {sorted[0]?.growth_rate != null ? fmtSignedPct(sorted[0].growth_rate) : "—"}
                </td>
                <td style={{ padding: "9px 0 9px 4px", textAlign: "right" }}>
                  <Sparkline data={sparkData} width={72} height={20} stroke={row.color} strokeWidth={1.4} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {keyRatios.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "18px 0" }} />
          <Eyebrow style={{ marginBottom: 10 }}>Key ratios</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {keyRatios.map(([k, v], i) => (
              <div key={i} style={{
                padding: "10px 12px", background: "var(--surface-2)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>
                  {v.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <CitationFooter citations={section.citations} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------
const SEV: Record<string, { color: string; bg: string; ink: string; icon: React.ElementType }> = {
  high:   { color: "var(--red)",   bg: "var(--red-soft)",   ink: "var(--red-ink)",   icon: AlertTriangle },
  medium: { color: "var(--amber)", bg: "var(--amber-soft)", ink: "var(--amber-ink)", icon: AlertTriangle },
  low:    { color: "var(--ink-3)", bg: "var(--surface-2)",  ink: "var(--ink-2)",     icon: Info },
};

function RiskCard({ section }: { section: RiskSection }) {
  return (
    <SectionCard
      icon={ShieldAlert} title="Risk Assessment"
      subtitle="Material risk factors · severity-weighted"
      confidence={section.confidence_score} citations={section.citations}
      accent="#F59E0B"
    >
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)" }}>{section.summary}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {section.risks.map((r, i) => {
          const sev = SEV[r.severity] ?? SEV.low;
          const SevIcon = sev.icon;
          return (
            <div
              key={i}
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                gap: 14, padding: "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${sev.color}`,
                borderRadius: 8, alignItems: "flex-start",
                transition: "background 0.15s", cursor: "default",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: sev.bg, color: sev.color,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <SevIcon size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.title}</span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
                    padding: "2px 6px", borderRadius: 4,
                    color: sev.ink, background: sev.bg,
                  }}>{r.severity.toUpperCase()}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--ink-3)" }}>{r.description}</p>
                {r.citation?.source && (
                  <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Link size={10} />
                    {r.citation.source}
                  </div>
                )}
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "var(--ink-4)" }}>
                <ExternalLink size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <CitationFooter citations={section.citations} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------
function MarketCard({ section }: { section: MarketSection }) {
  return (
    <SectionCard
      icon={Globe} title="Market Intelligence"
      subtitle="TAM · competitor share · momentum factors"
      confidence={section.confidence_score} citations={section.citations}
      accent="#10B981"
    >
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)" }}>{section.summary}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginBottom: 16 }}>
        {/* Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {section.market_size_usd != null && (
            <div style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <Eyebrow>Total addressable market</Eyebrow>
              <div style={{ marginTop: 4, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                ${fmtUSD(section.market_size_usd)}
              </div>
            </div>
          )}
          {section.market_share != null && (
            <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <Eyebrow>Estimated market share</Eyebrow>
              <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {fmtPct(section.market_share)}
              </div>
            </div>
          )}
        </div>

        {/* Competitors */}
        {section.competitors.length > 0 && (
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Top competitors</Eyebrow>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {section.competitors.map((c, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 56px 72px 14px",
                  alignItems: "center", gap: 10,
                  padding: "9px 12px",
                  borderBottom: i < section.competitors.length - 1 ? "1px solid var(--border)" : "none",
                  fontSize: 12.5,
                }}>
                  <span style={{ fontWeight: 500, color: "var(--ink)" }}>{c.name}</span>
                  <span style={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums", color: "var(--ink-2)", fontWeight: 600 }}>
                    {c.estimated_market_share != null ? fmtPct(c.estimated_market_share) : "—"}
                  </span>
                  {c.estimated_market_share != null ? (
                    <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, (c.estimated_market_share / 0.25) * 100)}%`,
                        background: "var(--ink-2)", borderRadius: 999,
                      }} />
                    </div>
                  ) : <div />}
                  <TrendingUp size={12} color="var(--ink-4)" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {section.growth_drivers.length > 0 && (
          <div>
            <Eyebrow style={{ color: "var(--green-ink)", marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={10} /> Growth drivers
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {section.growth_drivers.map((d, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: 999, background: "var(--green)" }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {section.headwinds.length > 0 && (
          <div>
            <Eyebrow style={{ color: "var(--red-ink)", marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingDown size={10} /> Headwinds
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {section.headwinds.map((h, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: 999, background: "var(--red)" }} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <CitationFooter citations={section.citations} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------
function LegalCard({ section }: { section: LegalSection }) {
  return (
    <SectionCard
      icon={Scale} title="Legal & Regulatory"
      subtitle="Active litigation · regulatory exposure"
      confidence={section.confidence_score} citations={section.citations}
      accent="#0EA5E9"
    >
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)" }}>{section.summary}</p>

      {section.litigations.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 8 }}>Active litigation</Eyebrow>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {section.litigations.map((l, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.5fr 0.9fr 0.7fr auto",
                gap: 12, padding: "12px 14px",
                borderBottom: i < section.litigations.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{l.case_name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.45 }}>{l.description}</div>
                </div>
                <div>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 8px", fontSize: 11, fontWeight: 600,
                    borderRadius: 999,
                    background: l.status === "Settled" ? "var(--green-soft)" : "var(--amber-soft)",
                    color: l.status === "Settled" ? "var(--green-ink)" : "var(--amber-ink)",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: l.status === "Settled" ? "var(--green)" : "var(--amber)" }} />
                    {l.status}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  {l.potential_liability_usd != null && (
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: "var(--red-ink)", fontVariantNumeric: "tabular-nums" }}>
                      ${fmtUSD(l.potential_liability_usd)}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>est. liability</div>
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "var(--ink-4)" }}>
                  <ExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {section.regulatory_issues.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
          <Eyebrow style={{ marginBottom: 8 }}>Regulatory issues</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {section.regulatory_issues.map((r, i) => (
              <div key={i} style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                {r.agency && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{r.agency}</div>}
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 }}>{String(r.description ?? "")}</div>
                {r.potential_fine_usd != null && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: "var(--red-ink)" }}>
                    ${fmtUSD(r.potential_fine_usd)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <CitationFooter citations={section.citations} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Citation footer
// ---------------------------------------------------------------------------
function CitationFooter({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div style={{
      marginTop: 16, padding: "10px 12px",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <Eyebrow style={{ flexShrink: 0 }}>Sources</Eyebrow>
      {citations.slice(0, 5).map((c, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 6,
          fontSize: 11, color: "var(--ink-2)",
        }}>
          <Link size={10} />
          {c.url
            ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.source}</a>
            : c.source
          }
        </span>
      ))}
      {citations.length > 5 && (
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>+{citations.length - 5} more</span>
      )}
    </div>
  );
}
