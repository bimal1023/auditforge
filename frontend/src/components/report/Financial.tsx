"use client";

import { Sparkline, Eyebrow, fmtUSD, fmtSignedPct, formatRatio, humanizeRatioKey } from "../ui";
import type { FinancialSection, FinancialMetric } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";
import { CitationFooter } from "./CitationFooter";

interface Props { section: FinancialSection; isMobile: boolean }

const SERIES: { key: keyof FinancialSection; label: string; color: string }[] = [
  { key: "revenue",              label: "Revenue",          color: "#2563EB" },
  { key: "gross_profit",         label: "Gross profit",     color: "#16A34A" },
  { key: "operating_income",     label: "Operating income", color: "#0284C7" },
  { key: "ebitda",               label: "EBITDA",           color: "#0891B2" },
  { key: "net_income",           label: "Net income",       color: "#7C5CFC" },
  { key: "eps_diluted",          label: "EPS (diluted)",    color: "#8B5CF6" },
  { key: "total_debt",           label: "Total debt",       color: "#EA580C" },
  { key: "cash_and_equivalents", label: "Cash & equiv.",    color: "#0D9488" },
];

/* ── tiny helpers ─────────────────────────────────────────────────────── */
const pct = (v?: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
const usd = (v?: number | null) => v != null ? "$" + fmtUSD(v) : "—";
const card = { padding: "13px 15px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10 } as const;
const mono = { fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums" as const } as const;
const periodShort = (label?: string) => (label ?? "").replace(/^Qtr ended\s+/i, "").replace(/^As of\s+/i, "");

export function Financial({ section: s, isMobile }: Props) {
  const rows = SERIES
    .map((x) => ({ ...x, arr: (s[x.key] as FinancialMetric[] | undefined) ?? [] }))
    .filter((r) => r.arr.length > 0);

  const keyRatios = Object.entries(s.key_ratios ?? {});
  const rep = rows.find((r) => r.arr.some((m) => m.period));
  const repS = rep ? [...rep.arr].sort((a, b) => b.year - a.year) : [];
  const cols = [
    { label: "Metric", sub: "" }, { label: "Latest", sub: periodShort(repS[0]?.period) },
    { label: "Prior", sub: periodShort(repS[1]?.period) }, { label: "YoY", sub: "" }, { label: "Trend", sub: "" },
  ];
  const cf = s.cash_flow; const bs = s.balance_sheet; const mg = s.margins;
  const highlights = s.investment_highlights ?? []; const concerns = s.key_concerns ?? [];
  const segments = s.segments ?? [];

  return (
    <>
      <SectionHeader title="Financial Analysis" subtitle="PE-grade due diligence · income · cash flow · balance sheet" confidence={s.confidence_score} citations={s.citations} />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{s.summary}</p>

      {/* ── Period badges ─────────────────────────────────────────────── */}
      {(s.period_of_report || s.filing_type) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          {s.period_of_report && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--b600,#2563EB)", background: "var(--b50,#EFF6FF)", border: "1px solid var(--b200,#BFDBFE)", borderRadius: 6, padding: "3px 9px", ...mono }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Data as of {s.period_of_report}
          </span>}
          {s.filing_type && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-4)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 8px", textTransform: "uppercase" }}>{s.filing_type}</span>}
        </div>
      )}

      {/* ── Investment highlights / Key concerns ──────────────────────── */}
      {(highlights.length > 0 || concerns.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 22 }}>
          {highlights.length > 0 && (
            <div style={{ ...card, borderLeft: "3px solid var(--green-ink,#16A34A)" }}>
              <Eyebrow style={{ marginBottom: 8, color: "var(--green-ink,#16A34A)" }}>Investment highlights</Eyebrow>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-2)" }}>
                {highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          {concerns.length > 0 && (
            <div style={{ ...card, borderLeft: "3px solid var(--red-ink,#DC2626)" }}>
              <Eyebrow style={{ marginBottom: 8, color: "var(--red-ink,#DC2626)" }}>Key concerns</Eyebrow>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-2)" }}>
                {concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Key metrics table ─────────────────────────────────────────── */}
      {rows.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>{s.filing_type === "10-Q" ? "Key metrics — most recent quarter (YoY)" : "Key metrics — last fiscal years"}</Eyebrow>
          <div className="af-table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", minWidth: isMobile ? 480 : undefined, borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ background: "var(--surface-2)" }}>
                {cols.map((c, i) => <th key={c.label} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", textAlign: i === 0 ? "left" : "right" }}>
                  {c.label}{c.sub && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.01em", textTransform: "none", color: "var(--ink-3)", ...mono, marginTop: 2 }}>{c.sub}</div>}
                </th>)}
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const sorted = [...row.arr].sort((a, b) => b.year - a.year);
                const spark = [...row.arr].sort((a, b) => a.year - b.year).map((m) => m.value);
                const yoy = sorted[0]?.growth_rate;
                return <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--ink)" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 3, height: 14, borderRadius: 999, background: row.color, flexShrink: 0 }} />{row.label}</div></td>
                  <td style={{ padding: "11px 14px", textAlign: "right", ...mono, fontWeight: 700, color: "var(--ink)" }}>{sorted[0] ? "$" + fmtUSD(sorted[0].value) : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right", ...mono, color: "var(--ink-3)" }}>{sorted[1] ? "$" + fmtUSD(sorted[1].value) : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right", ...mono, fontWeight: 700, color: yoy == null ? "var(--ink-4)" : yoy >= 0 ? "var(--green-ink)" : "var(--red-ink)" }}>{yoy != null ? fmtSignedPct(yoy) : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}><Sparkline data={spark} width={72} height={22} stroke={row.color} strokeWidth={1.5} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Cash flow & capital allocation ─────────────────────────────── */}
      {cf && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Cash flow &amp; capital allocation {cf.period ? `— ${cf.period}` : ""}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
            {([["Operating CF", cf.operating_cash_flow], ["CapEx", cf.capital_expenditure], ["Free CF", cf.free_cash_flow], ["Dividends", cf.dividends_paid], ["Buybacks", cf.share_repurchases]] as [string, number | undefined | null][]).map(([label, val]) => (
              <div key={label} style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", ...mono, letterSpacing: "-0.02em" }}>{usd(val)}</span>
              </div>
            ))}
          </div>
          {cf.fcf_margin != null && <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "0 0 8px" }}>FCF margin: <strong style={{ color: "var(--ink)" }}>{pct(cf.fcf_margin)}</strong></p>}
        </>
      )}

      {s.capital_allocation && (
        <div style={{ ...card, marginBottom: 20 }}>
          <Eyebrow style={{ marginBottom: 6 }}>Capital allocation strategy</Eyebrow>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)" }}>{s.capital_allocation}</p>
        </div>
      )}

      {/* ── Margins ───────────────────────────────────────────────────── */}
      {mg && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Margin analysis {mg.period ? `— ${mg.period}` : ""}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {([["Gross margin", mg.gross_margin], ["Operating margin", mg.operating_margin], ["Net margin", mg.net_margin], ["FCF margin", mg.fcf_margin], ["R&D intensity", mg.rnd_intensity], ["SG&A ratio", mg.sga_ratio]] as [string, number | undefined | null][]).filter(([, v]) => v != null).map(([label, val]) => (
              <div key={label} style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", ...mono, letterSpacing: "-0.02em" }}>{pct(val)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Balance sheet health ───────────────────────────────────────── */}
      {bs && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Balance sheet health {bs.period ? `— ${bs.period}` : ""}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {([["Current ratio", bs.current_ratio, "x"], ["Debt / Equity", bs.debt_to_equity, "x"], ["Net debt", bs.net_debt, "$"], ["Interest coverage", bs.interest_coverage, "x"], ["Total assets", bs.total_assets, "$"], ["Equity", bs.stockholders_equity, "$"]] as [string, number | undefined | null, string][]).filter(([, v]) => v != null).map(([label, val, fmt]) => (
              <div key={label} style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", ...mono, letterSpacing: "-0.02em" }}>
                  {fmt === "$" ? usd(val) : `${val!.toFixed(2)}×`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Segments ──────────────────────────────────────────────────── */}
      {segments.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10 }}>Business segments</Eyebrow>
          <div className="af-table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ background: "var(--surface-2)" }}>
                {["Segment", "Revenue", "Op. income", "Margin", "YoY"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{segments.map((seg, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--ink)" }}>{seg.name}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", ...mono }}>{usd(seg.revenue)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", ...mono }}>{usd(seg.operating_income)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", ...mono }}>{pct(seg.margin)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", ...mono, fontWeight: 700, color: seg.growth_rate == null ? "var(--ink-4)" : seg.growth_rate >= 0 ? "var(--green-ink)" : "var(--red-ink)" }}>{seg.growth_rate != null ? fmtSignedPct(seg.growth_rate) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Management notes ──────────────────────────────────────────── */}
      {s.management_notes && (
        <div style={{ ...card, marginBottom: 20 }}>
          <Eyebrow style={{ marginBottom: 6 }}>Management &amp; governance</Eyebrow>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)" }}>{s.management_notes}</p>
        </div>
      )}

      {/* ── Key ratios ────────────────────────────────────────────────── */}
      {keyRatios.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 12 }}>Key ratios</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {keyRatios.map(([k, v], i) => {
              const { label, period } = humanizeRatioKey(k);
              return (
                <div key={i} style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
                    {period && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.03em", color: "var(--ink-4)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px", ...mono, whiteSpace: "nowrap" }}>{period}</span>}
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", ...mono, letterSpacing: "-0.02em" }}>{formatRatio(k, v)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <CitationFooter citations={s.citations} />
    </>
  );
}
