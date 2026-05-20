"use client";

import { useState } from "react";
import { authHeaders } from "@/lib/auth";
import type {
  Report, FinancialSection, FinancialMetric,
  RiskSection, MarketSection, LegalSection, Citation,
} from "@/lib/types";

interface Props { report: Report }

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export function ReportViewer({ report }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/reports/${report.id}/pdf`, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Download failed" }));
        alert(err.detail ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditforge_${report.company}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF download failed — check network");
    } finally {
      setDownloading(false);
    }
  }

  if (report.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Report generation failed: {report.error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{report.company}</h2>
            {report.ticker && (
              <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{report.ticker}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {report.overall_score !== undefined && <ScoreBadge score={report.overall_score} />}
            {report.status === "complete" && (
              <button
                onClick={downloadPdf}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {downloading ? "Downloading…" : "↓ PDF"}
              </button>
            )}
          </div>
        </div>
        {report.executive_summary && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">{report.executive_summary}</p>
        )}
      </div>

      {report.financial && <FinancialCard section={report.financial} />}
      {report.risk && <RiskCard section={report.risk} />}
      {report.market && <MarketCard section={report.market} />}
      {report.legal && <LegalCard section={report.legal} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? "text-green-700 bg-green-100" : score >= 4 ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100";
  return (
    <div className={`flex flex-col items-center rounded-xl px-4 py-2 ${color}`}>
      <span className="text-2xl font-bold">{score.toFixed(1)}</span>
      <span className="text-xs font-medium">/ 10.0</span>
    </div>
  );
}

function ConfidencePill({ score }: { score: number }) {
  const color = score >= 0.7 ? "bg-green-100 text-green-700" : score >= 0.4 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{PCT.format(score)} confidence</span>;
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h4>
      <ul className="space-y-1">
        {citations.map((c, i) => (
          <li key={i} className="text-xs text-slate-500">
            {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-600">{c.source}</a> : c.source}
            {c.filing_date && ` · ${c.filing_date}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionCard({ title, confidence, summary, children, citations }: {
  title: string; confidence: number; summary: string;
  children?: React.ReactNode; citations: Citation[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <ConfidencePill score={confidence} />
      </div>
      <p className="mb-5 text-sm leading-relaxed text-slate-600">{summary}</p>
      {children}
      <CitationList citations={citations} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------

function FinancialCard({ section }: { section: FinancialSection }) {
  return (
    <SectionCard title="Financial Analysis" confidence={section.confidence_score} summary={section.summary} citations={section.citations}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTable label="Revenue" metrics={section.revenue} />
        <MetricTable label="Gross Profit" metrics={section.gross_profit} />
        <MetricTable label="EBITDA" metrics={section.ebitda} />
        <MetricTable label="Net Income" metrics={section.net_income} />
        <MetricTable label="Total Debt" metrics={section.total_debt} />
        <MetricTable label="Cash & Equivalents" metrics={section.cash_and_equivalents} />
      </div>
      {Object.keys(section.key_ratios).length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Key Ratios</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(section.key_ratios).map(([k, v]) => (
              <span key={k} className="rounded-lg bg-slate-100 px-3 py-1 text-xs">
                <span className="font-medium">{k}:</span> {v.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MetricTable({ label, metrics }: { label: string; metrics: FinancialMetric[] }) {
  if (!metrics?.length) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h4>
      <table className="w-full text-sm">
        <tbody>
          {[...metrics].sort((a, b) => b.year - a.year).map((m) => (
            <tr key={m.year} className="border-b border-slate-50">
              <td className="py-1 text-slate-500">{m.year}</td>
              <td className="py-1 text-right font-mono font-medium text-slate-900">{USD.format(m.value)}</td>
              {m.growth_rate !== undefined && (
                <td className={`py-1 pl-2 text-right text-xs ${m.growth_rate >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {m.growth_rate >= 0 ? "+" : ""}{PCT.format(m.growth_rate)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

function RiskCard({ section }: { section: RiskSection }) {
  return (
    <SectionCard title="Risk Analysis" confidence={section.confidence_score} summary={section.summary} citations={section.citations}>
      {section.risks.length > 0 && (
        <div className="space-y-3">
          {section.risks.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[r.severity] ?? SEVERITY_STYLE.low}`}>
                  {r.severity}
                </span>
                <span className="text-sm font-medium text-slate-800">{r.title}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.description}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

function MarketCard({ section }: { section: MarketSection }) {
  return (
    <SectionCard title="Market Analysis" confidence={section.confidence_score} summary={section.summary} citations={section.citations}>
      <div className="grid gap-4 sm:grid-cols-2">
        {section.market_size_usd !== undefined && (
          <Stat label="Total Addressable Market" value={USD.format(section.market_size_usd)} />
        )}
        {section.market_share !== undefined && (
          <Stat label="Estimated Market Share" value={PCT.format(section.market_share)} />
        )}
      </div>

      {section.competitors.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Competitors</h4>
          <div className="space-y-1">
            {section.competitors.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.estimated_market_share !== undefined && (
                  <span className="text-xs text-slate-500">{PCT.format(c.estimated_market_share)} share</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {section.growth_drivers.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">Growth Drivers</h4>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {section.growth_drivers.map((d, i) => <li key={i}>↑ {d}</li>)}
            </ul>
          </div>
        )}
        {section.headwinds.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-500">Headwinds</h4>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {section.headwinds.map((h, i) => <li key={i}>↓ {h}</li>)}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

function LegalCard({ section }: { section: LegalSection }) {
  return (
    <SectionCard title="Legal Analysis" confidence={section.confidence_score} summary={section.summary} citations={section.citations}>
      {section.litigations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Active Litigation</h4>
          {section.litigations.map((l, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{l.case_name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{l.status}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{l.description}</p>
              {l.potential_liability_usd !== undefined && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Potential liability: {USD.format(l.potential_liability_usd)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {section.regulatory_issues.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Regulatory Issues</h4>
          {section.regulatory_issues.map((r, i) => (
            <div key={i} className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
              {r.agency && <span className="font-semibold">{String(r.agency)}: </span>}
              {String(r.description ?? "")}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
