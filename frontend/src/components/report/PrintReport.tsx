"use client";

import { useEffect, useRef } from "react";
import { ScoreGauge, fmtUSD, fmtSignedPct, Eyebrow } from "../ui";
import { Financial } from "./Financial";
import { Risk } from "./Risk";
import { Market } from "./Market";
import { Legal } from "./Legal";
import type { Report } from "@/lib/types";

interface Props {
  report: Report;
  onClose: () => void;
}

/* ── Print-specific CSS injected into the overlay ──────────────────────── */
const PRINT_CSS = `
  @media print {
    /* 1. Make everything invisible but keep layout so ancestors stay in flow */
    body * { visibility: hidden !important; }
    /* 2. Make the print overlay and ALL its descendants visible */
    .print-overlay,
    .print-overlay * { visibility: visible !important; }
    /* 3. Pull overlay to top-left so it fills the printed page */
    .print-overlay {
      position: absolute !important; inset: 0 !important;
      overflow: visible !important; background: #fff !important;
      z-index: 99999 !important;
    }
    /* 4. Hide the toolbar */
    .print-toolbar,
    .print-toolbar * { display: none !important; visibility: hidden !important; }
    /* 5. Layout resets */
    .print-body { padding: 0 !important; max-width: none !important; }
    .print-page {
      box-shadow: none !important; border: none !important;
      margin: 0 !important; padding: 12mm 10mm !important;
    }
    .print-page-break { page-break-before: always; }
    .print-header { break-inside: avoid; }
    .print-section { break-inside: avoid-page; }
    /* 6. Force background colors/graphics to print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    @page {
      size: A4;
      margin: 8mm;
    }
  }

  /* Screen preview — looks like stacked A4 pages */
  .print-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--n100, #f1f5f9);
    overflow-y: auto; overflow-x: hidden;
  }
  .print-toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 24px;
    background: var(--ink, #0f172a); color: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  }
  .print-toolbar button {
    display: inline-flex; align-items: center; gap: 7px;
    height: 36px; padding: 0 16px;
    font-size: 13px; font-weight: 600; font-family: Inter, sans-serif;
    border: none; border-radius: 8px; cursor: pointer;
    transition: opacity 0.15s;
  }
  .print-toolbar button:hover { opacity: 0.85; }
  .print-btn-primary { background: #2563eb; color: #fff; }
  .print-btn-ghost { background: rgba(255,255,255,0.12); color: #fff; }

  .print-body {
    max-width: 850px; margin: 24px auto; padding: 0 16px 60px;
  }
  .print-page {
    background: #fff; border-radius: 8px;
    box-shadow: 0 1px 8px rgba(0,0,0,0.08);
    padding: 48px 40px; margin-bottom: 24px;
  }
  .print-cover-strip {
    display: flex; align-items: center; gap: 24px;
    padding: 20px 0; margin-bottom: 16px;
    border-bottom: 2px solid var(--ink, #0f172a);
  }
  .print-meta-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin: 20px 0;
  }
  .print-meta-card {
    padding: 14px 16px;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
  }
  .print-meta-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; color: #64748b; margin-bottom: 4px;
  }
  .print-meta-value {
    font-size: 20px; font-weight: 800; color: #0f172a;
    font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  }
  .print-meta-delta {
    font-size: 11px; font-weight: 600; margin-top: 2px;
  }
  .print-section-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 32px 0 20px; page-break-after: avoid;
  }
  .print-section-divider::after {
    content: ""; flex: 1; height: 1px; background: #e2e8f0;
  }
  .print-section-number {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 999px;
    font-size: 12px; font-weight: 700; color: #fff;
  }
  .print-footer {
    text-align: center; font-size: 10px; color: #94a3b8;
    padding: 20px 0 0; margin-top: 32px;
    border-top: 1px solid #e2e8f0;
  }
  .print-confidential {
    display: inline-block; font-size: 9px; font-weight: 700;
    letter-spacing: 0.08em; color: #dc2626;
    border: 1px solid #fecaca; border-radius: 4px;
    padding: 2px 8px; margin-bottom: 8px;
  }
`;

const SECTION_COLORS: Record<string, string> = {
  financial: "#2563eb",
  risk: "#d97706",
  market: "#16a34a",
  legal: "#0d9488",
};

export function PrintReport({ report, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to top on mount */
  useEffect(() => {
    overlayRef.current?.scrollTo(0, 0);
    /* Trap focus inside overlay */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handlePrint() {
    window.print();
  }

  const { financial, risk, market, legal } = report;
  const generated = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const sections: { key: string; label: string; node: React.ReactNode }[] = [];
  if (financial) sections.push({ key: "financial", label: "Financial Analysis", node: <Financial section={financial} isMobile={false} /> });
  if (risk)      sections.push({ key: "risk",      label: "Risk Assessment",    node: <Risk section={risk} /> });
  if (market)    sections.push({ key: "market",     label: "Market & Competitive Landscape", node: <Market section={market} /> });
  if (legal)     sections.push({ key: "legal",      label: "Legal & Regulatory Review",      node: <Legal section={legal} /> });

  return (
    <div className="print-overlay" ref={overlayRef}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Toolbar (hidden in print) ── */}
      <div className="print-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Print Preview
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {report.company}{report.ticker ? ` (${report.ticker})` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="print-btn-ghost" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Close
          </button>
          <button className="print-btn-primary" onClick={handlePrint}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="print-body">

        {/* ── Cover / header page ── */}
        <div className="print-page print-header">
          <div className="print-confidential">CONFIDENTIAL</div>

          {/* Company strip */}
          <div className="print-cover-strip">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
                Due Diligence Investment Memo
              </div>
              <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
                {report.company}
              </h1>
              {report.ticker && (
                <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                  {report.ticker}
                </span>
              )}
            </div>
            {report.overall_score != null && (
              <div style={{ flexShrink: 0 }}>
                <ScoreGauge score={report.overall_score} size={140} />
              </div>
            )}
          </div>

          {/* Executive summary */}
          {report.executive_summary && (
            <div style={{ margin: "16px 0 20px" }}>
              <Eyebrow style={{ marginBottom: 8 }}>Executive Summary</Eyebrow>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: "#334155" }}>
                {report.executive_summary}
              </p>
            </div>
          )}

          {/* Key metrics strip */}
          {financial?.revenue?.[0] && (
            <div className="print-meta-grid">
              {[
                { label: "Revenue", value: "$" + fmtUSD(financial.revenue[0].value), delta: fmtSignedPct(financial.revenue[0].growth_rate), up: (financial.revenue[0].growth_rate ?? 0) >= 0 },
                { label: "Net Income", value: financial.net_income?.[0] ? "$" + fmtUSD(financial.net_income[0].value) : "—", delta: fmtSignedPct(financial.net_income?.[0]?.growth_rate), up: (financial.net_income?.[0]?.growth_rate ?? 0) >= 0 },
                { label: "Market Share", value: market?.market_share ? (market.market_share * 100).toFixed(1) + "%" : "—", delta: "", up: true },
                { label: "Active Risks", value: risk ? `${risk.risks.length}` : "—", delta: risk ? `${risk.risks.filter(r => r.severity === "high").length} high severity` : "", up: false },
              ].map((m, i) => (
                <div key={i} className="print-meta-card">
                  <div className="print-meta-label">{m.label}</div>
                  <div className="print-meta-value">{m.value}</div>
                  {m.delta && (
                    <div className="print-meta-delta" style={{ color: m.up ? "#16a34a" : "#dc2626" }}>
                      {m.delta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Report metadata */}
          <div style={{ display: "flex", gap: 24, fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            <span>Generated: {generated}</span>
            <span>Platform: Arthvion</span>
            <span>Sections: {sections.length}</span>
          </div>
        </div>

        {/* ── Each report section ── */}
        {sections.map((sec, i) => (
          <div key={sec.key} className={`print-page print-section ${i > 0 ? "print-page-break" : ""}`}>
            {/* Section label with numbered circle */}
            <div className="print-section-divider">
              <span
                className="print-section-number"
                style={{ background: SECTION_COLORS[sec.key] ?? "#64748b" }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                {sec.label}
              </span>
            </div>
            {sec.node}
          </div>
        ))}

        {/* ── Footer page ── */}
        <div className="print-page">
          <div className="print-footer">
            <div className="print-confidential">CONFIDENTIAL</div>
            <p style={{ margin: "6px 0 0" }}>
              This document was generated by Arthvion using automated analysis of public filings,
              market data, and litigation records. It is intended for informational purposes only and does
              not constitute investment advice. All data should be independently verified.
            </p>
            <p style={{ margin: "8px 0 0", fontWeight: 600, color: "#64748b" }}>
              {report.company} &middot; {generated} &middot; Arthvion
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
