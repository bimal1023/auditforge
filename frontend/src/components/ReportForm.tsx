"use client";

import { useState } from "react";
import { BarChart2, ShieldAlert, Globe, Scale, Building2, Zap, Clock, Check } from "lucide-react";
import { Spinner } from "./ui";
import { useIsMobile } from "@/lib/hooks";
import type { ReportRequest } from "@/lib/types";

const FOCUS_AREAS = [
  { key: "financial", label: "Financial", desc: "Revenue, EBITDA, cash flow", icon: BarChart2, color: "#1B3A6B" },
  { key: "risk",      label: "Risk",      desc: "Material risks, exposure",   icon: ShieldAlert, color: "#9A5800" },
  { key: "market",    label: "Market",    desc: "TAM, share, competitors",    icon: Globe,       color: "#0A6640" },
  { key: "legal",     label: "Legal",     desc: "Litigation, regulatory",     icon: Scale,       color: "#1554A6" },
] as const;

interface InitialValues {
  focus_areas?: string[];
  context?: string;
  company_name?: string;
  ticker?: string;
}

interface Props {
  onSubmit: (req: ReportRequest) => void;
  loading: boolean;
  initialValues?: InitialValues;
}

export function ReportForm({ onSubmit, loading, initialValues }: Props) {
  const isMobile = useIsMobile();
  const [company, setCompany] = useState(initialValues?.company_name ?? "");
  const [ticker, setTicker]   = useState(initialValues?.ticker ?? "");
  const [context, setContext] = useState(initialValues?.context ?? "");
  const [areas, setAreas]     = useState<string[]>(initialValues?.focus_areas ?? ["financial", "risk", "market", "legal"]);
  const [focused, setFocused] = useState<string | null>(null);

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

  const isReady = !!company.trim() && areas.length > 0 && !loading;
  const estSec  = areas.length * 60;

  return (
    <div style={{ animation: "af-slide-up 0.4s ease-out" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 48, height: 48, borderRadius: 14,
          background: "var(--brand-soft)",
          marginBottom: 16,
          boxShadow: "0 0 0 8px var(--brand-tint)",
        }}>
          <Zap size={22} color="var(--brand)" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          Generate a new report
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-3)" }}>
          Specialized agents pull SEC filings, market data, and legal records in parallel.
        </p>
      </div>

      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      }}>
        <form onSubmit={handleSubmit}>
          {/* Company + Ticker */}
          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={labelCss}>Company name <span style={{ color: "var(--red)" }}>*</span></label>
                <div
                  style={{
                    display: "flex", alignItems: "center",
                    height: 48,
                    background: focused === "company" ? "var(--surface)" : "var(--surface-2)",
                    border: `1.5px solid ${focused === "company" ? "var(--brand)" : "var(--border-strong)"}`,
                    borderRadius: 12,
                    boxShadow: focused === "company" ? "0 0 0 3px var(--brand-glow)" : "none",
                    transition: "all 0.15s",
                    paddingLeft: 14,
                    gap: 10,
                  }}
                >
                  <Building2 size={16} color={focused === "company" ? "var(--brand)" : "var(--ink-4)"} style={{ flexShrink: 0, transition: "color 0.15s" }} />
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onFocus={() => setFocused("company")}
                    onBlur={() => setFocused(null)}
                    placeholder="e.g. Apple Inc."
                    required
                    style={{ flex: 1, height: "100%", background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 500, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}
                  />
                </div>
              </div>
              <div style={{ width: isMobile ? "100%" : 100 }}>
                <label style={labelCss}>Ticker</label>
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onFocus={() => setFocused("ticker")}
                  onBlur={() => setFocused(null)}
                  placeholder="AAPL"
                  maxLength={10}
                  style={{
                    width: "100%", height: 48,
                    padding: "0 12px",
                    background: focused === "ticker" ? "var(--surface)" : "var(--surface-2)",
                    border: `1.5px solid ${focused === "ticker" ? "var(--brand)" : "var(--border-strong)"}`,
                    borderRadius: 12,
                    boxShadow: focused === "ticker" ? "0 0 0 3px var(--brand-glow)" : "none",
                    transition: "all 0.15s",
                    outline: "none", fontSize: 14, fontWeight: 700,
                    fontFamily: "JetBrains Mono, monospace",
                    color: "var(--ink)",
                    letterSpacing: "0.04em",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Focus areas */}
          <div style={{ padding: "18px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={labelCss}>Analysis focus</label>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                {areas.length} of {FOCUS_AREAS.length} selected
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
              {FOCUS_AREAS.map(({ key, label, desc, icon: Icon, color }) => {
                const on = areas.includes(key);
                return (
                  <button
                    key={key} type="button" onClick={() => toggle(key)}
                    style={{
                      position: "relative",
                      padding: "12px 10px",
                      background: on ? "var(--surface)" : "var(--surface-2)",
                      border: `1.5px solid ${on ? color : "var(--border)"}`,
                      boxShadow: on ? `0 0 0 3px ${color}18` : "none",
                      borderRadius: 12, cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface)"; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "var(--surface-2)"; }}
                  >
                    {on && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        width: 16, height: 16, borderRadius: 999,
                        background: color, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, marginBottom: 8,
                      background: on ? `${color}18` : "var(--surface-3)",
                      color: on ? color : "var(--ink-4)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? "var(--ink)" : "var(--ink-2)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.4 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context */}
          <div style={{ padding: "18px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={labelCss}>Additional context <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>· optional</span></label>
            </div>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onFocus={() => setFocused("context")}
              onBlur={() => setFocused(null)}
              rows={2}
              placeholder="e.g. Evaluating for acquisition at ~8x EBITDA. Focus on recurring revenue quality and customer concentration."
              style={{
                width: "100%",
                padding: "12px 14px",
                background: focused === "context" ? "var(--surface)" : "var(--surface-2)",
                border: `1.5px solid ${focused === "context" ? "var(--brand)" : "var(--border-strong)"}`,
                borderRadius: 12,
                boxShadow: focused === "context" ? "0 0 0 3px var(--brand-glow)" : "none",
                transition: "all 0.15s",
                outline: "none",
                fontSize: 13.5, color: "var(--ink)",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.55,
                resize: "vertical",
              }}
            />
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "16px 20px",
            marginTop: 18,
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}>
            <button
              type="submit"
              disabled={!isReady}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                height: 40, padding: "0 18px",
                width: isMobile ? "100%" : undefined,
                fontSize: 13.5, fontWeight: 700,
                background: isReady ? "var(--brand)" : "var(--surface-3)",
                color: isReady ? "#fff" : "var(--ink-4)",
                border: "none",
                borderRadius: 10,
                cursor: isReady ? "pointer" : "not-allowed",
                boxShadow: isReady ? "var(--shadow-brand)" : "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (isReady) e.currentTarget.style.background = "var(--brand-hover)"; }}
              onMouseLeave={(e) => { if (isReady) e.currentTarget.style.background = "var(--brand)"; }}
            >
              {loading ? (
                <><Spinner size={14} color="#fff" /> Generating…</>
              ) : (
                <><Zap size={14} /> Generate report</>
              )}
            </button>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-4)" }}>
              <Clock size={12} />
              <span>Est. {Math.round(estSec / 60)}&ndash;{Math.round(estSec / 60) + 1} min</span>
              <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 4, background: "var(--surface-3)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
                {areas.length} agent{areas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelCss: React.CSSProperties = {
  display: "block",
  fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)",
  marginBottom: 7,
};
