"use client";

import { useState } from "react";
import {
  BarChart2, ShieldAlert, Globe, Scale,
  Building2, Zap, History, Clock, Check,
} from "lucide-react";
import { Pill } from "./ui";
import type { ReportRequest } from "@/lib/types";

const FOCUS_AREAS = [
  { key: "financial", label: "Financial", icon: BarChart2, color: "var(--brand)" },
  { key: "risk",      label: "Risk",      icon: ShieldAlert, color: "#F59E0B" },
  { key: "market",    label: "Market",    icon: Globe,     color: "#10B981" },
  { key: "legal",     label: "Legal",     icon: Scale,     color: "#0EA5E9" },
] as const;

interface Props {
  onSubmit: (req: ReportRequest) => void;
  loading: boolean;
}

const fieldStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  fontFamily: "Inter, sans-serif", fontSize: 13,
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 9, color: "var(--ink)", outline: "none",
  boxShadow: "var(--shadow-xs)",
};

export function ReportForm({ onSubmit, loading }: Props) {
  const [company, setCompany]     = useState("");
  const [ticker, setTicker]       = useState("");
  const [context, setContext]     = useState("");
  const [areas, setAreas]         = useState<string[]>(["financial", "risk", "market", "legal"]);

  function toggle(k: string) {
    setAreas((a) => a.includes(k) ? a.filter((x) => x !== k) : [...a, k]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || areas.length === 0) return;
    onSubmit({
      company_name: company.trim(),
      ticker: ticker.trim() || undefined,
      focus_areas: areas,
      context: context.trim() || undefined,
    });
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="var(--brand)" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              Generate a new report
            </h2>
          </div>
          <p style={{ margin: "4px 0 0 23px", fontSize: 12, color: "var(--ink-3)" }}>
            4 agents in parallel · 2–4 min · SEC EDGAR + web search
          </p>
        </div>
        <Pill tone="outline" dot>3 credits remaining</Pill>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Company + ticker */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>
                Company <span style={{ color: "var(--red)" }}>*</span>
              </label>
            </div>
            <div style={{ position: "relative" }}>
              <Building2 size={14} color="var(--ink-4)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Apple Inc." required
                style={{ ...fieldStyle, paddingLeft: 36 }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)", display: "block", marginBottom: 6 }}>Ticker</label>
            <input
              value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              style={{ ...fieldStyle, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}
            />
          </div>
        </div>

        {/* Focus areas */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Focus areas</label>
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>Each area dispatches one specialist agent</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {FOCUS_AREAS.map(({ key, label, icon: IconCmp, color }) => {
              const on = areas.includes(key);
              return (
                <button
                  key={key} type="button" onClick={() => toggle(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px",
                    background: on ? "var(--surface)" : "var(--surface-2)",
                    border: `1px solid ${on ? color : "var(--border)"}`,
                    boxShadow: on ? `0 0 0 3px ${color}1a, var(--shadow-xs)` : "none",
                    borderRadius: 9, cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: on ? `${color}1a` : "var(--surface)",
                    color: on ? color : "var(--ink-3)",
                    border: `1px solid ${on ? color + "33" : "var(--border)"}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IconCmp size={13} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? "var(--ink)" : "var(--ink-2)", flex: 1 }}>{label}</span>
                  {on && <Check size={12} color={color} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Context */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Additional context</label>
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>Optional — guides agents&apos; reasoning</span>
          </div>
          <textarea
            value={context} onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder="e.g. Evaluating for acquisition at ~8x EBITDA. Focus on recurring revenue quality."
            style={{
              ...fieldStyle, height: "auto",
              padding: "10px 12px", lineHeight: 1.5, resize: "vertical",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingTop: 6, borderTop: "1px solid var(--border)", marginTop: 4,
        }}>
          <button
            type="submit"
            disabled={loading || !company.trim() || areas.length === 0}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              gap: 7, height: 34, padding: "0 12px",
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
              background: "var(--brand)", color: "#fff",
              border: "1px solid var(--brand-hover)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(124,58,237,0.32)",
              borderRadius: 9, cursor: loading ? "not-allowed" : "pointer",
              opacity: (loading || !company.trim() || areas.length === 0) ? 0.6 : 1,
              transition: "opacity .15s",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 12, height: 12, borderRadius: 999,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }} />
                Generating…
              </>
            ) : (
              <>
                <Zap size={14} />
                Generate report
              </>
            )}
          </button>
          <button type="button" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 34, padding: "0 12px",
            fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
            background: "var(--surface)", color: "var(--ink)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xs)",
            borderRadius: 9, cursor: "pointer",
          }}>
            <History size={14} />
            Recent
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} />
            Est. {areas.length * 60}s · {areas.length} agent{areas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </form>
    </div>
  );
}
