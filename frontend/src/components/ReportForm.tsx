"use client";

import { useState } from "react";
import type { ReportRequest } from "@/lib/types";

const FOCUS_AREAS = ["financial", "risk", "market", "legal"];

interface Props {
  onSubmit: (req: ReportRequest) => void;
  loading: boolean;
}

export function ReportForm({ onSubmit, loading }: Props) {
  const [company, setCompany] = useState("");
  const [ticker, setTicker] = useState("");
  const [context, setContext] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>(["financial"]);

  function toggleArea(area: string) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    onSubmit({
      company_name: company.trim(),
      ticker: ticker.trim() || undefined,
      focus_areas: focusAreas,
      context: context.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Apple Inc."
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Ticker (optional)
          </label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Focus Areas
        </label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                focusAreas.includes(area)
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Additional Context (optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          placeholder="e.g. Evaluating for acquisition at ~8x EBITDA. Focus on recurring revenue quality."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !company.trim() || focusAreas.length === 0}
        className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Generating…
          </>
        ) : (
          "Generate Report"
        )}
      </button>
    </form>
  );
}
