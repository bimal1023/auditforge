"use client";

import { BarChart2, ShieldAlert, Globe, Scale, Zap, ArrowRight } from "lucide-react";
import { useIsMobile } from "@/lib/hooks";

const AREA_META: Record<string, { icon: React.ElementType; color: string }> = {
  financial: { icon: BarChart2,   color: "#1B3A6B" },
  risk:      { icon: ShieldAlert, color: "#9A5800" },
  market:    { icon: Globe,       color: "#0A6640" },
  legal:     { icon: Scale,       color: "#1554A6" },
};

interface Template {
  id: string;
  name: string;
  description: string;
  focus_areas: string[];
  context: string;
  badge?: string;
  color: string;
  icon: React.ElementType;
  est_min: number;
}

const TEMPLATES: Template[] = [
  {
    id: "full-dd",
    name: "Full Due Diligence",
    description: "Complete PE-grade analysis across financials, risk, market position, and legal exposure.",
    focus_areas: ["financial", "risk", "market", "legal"],
    context: "Comprehensive PE due diligence. Evaluate acquisition attractiveness at typical PE multiples. Identify any deal-breakers.",
    badge: "Most used",
    color: "#1B3A6B",
    icon: Zap,
    est_min: 4,
  },
  {
    id: "quick-financial",
    name: "Quick Financial Scan",
    description: "Revenue trajectory, EBITDA margins, and key ratio snapshot for fast screening.",
    focus_areas: ["financial"],
    context: "Focus on last 3 years of financials. Highlight revenue quality, margin trends, and any concerning debt levels.",
    badge: "Fast",
    color: "#059669",
    icon: BarChart2,
    est_min: 1,
  },
  {
    id: "risk-legal",
    name: "Risk & Legal Screen",
    description: "Material risk factors, regulatory exposure, and active litigation overview.",
    focus_areas: ["risk", "legal"],
    context: "Identify all material risks and regulatory issues that could affect valuation or deal close timeline.",
    color: "#D97706",
    icon: ShieldAlert,
    est_min: 2,
  },
  {
    id: "market-intel",
    name: "Market Intelligence",
    description: "TAM sizing, competitor landscape, growth drivers and headwinds.",
    focus_areas: ["market"],
    context: "Focus on total addressable market, key competitors and their relative positioning, and growth momentum.",
    color: "#2563EB",
    icon: Globe,
    est_min: 1,
  },
  {
    id: "acquisition",
    name: "Acquisition Target",
    description: "Financial health + risk screening optimised for M&A evaluation.",
    focus_areas: ["financial", "risk"],
    context: "Evaluating as a potential acquisition target. Focus on clean financials, manageable leverage, and risk factors that affect deal certainty.",
    color: "#DB2777",
    icon: BarChart2,
    est_min: 2,
  },
  {
    id: "competitive",
    name: "Competitive Landscape",
    description: "Market position, share dynamics, and strategic differentiation deep-dive.",
    focus_areas: ["market", "risk"],
    context: "Focus on competitive positioning, market share trends, key differentiators, and risks from new entrants or incumbents.",
    color: "#0891B2",
    icon: Globe,
    est_min: 2,
  },
];

interface Props {
  onUseTemplate: (t: { focus_areas: string[]; context: string }) => void;
}

export function TemplatesView({ onUseTemplate }: Props) {
  const isMobile = useIsMobile();
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", animation: "af-slide-up 0.3s ease-out" }}>

      {/* ── Template grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 14, padding: "18px 18px 16px",
                boxShadow: "var(--shadow-xs)",
                display: "flex", flexDirection: "column", gap: 14,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = t.color + "77";
                (e.currentTarget as HTMLDivElement).style.boxShadow   = `0 0 0 3px ${t.color}12, var(--shadow-sm)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow   = "var(--shadow-xs)";
              }}
            >
              {/* Icon + badge row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: t.color + "18", color: t.color,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={17} />
                </div>
                {t.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                    padding: "3px 9px", borderRadius: 999,
                    background: t.color + "18", color: t.color,
                  }}>{t.badge}</span>
                )}
              </div>

              {/* Name + description */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 5, letterSpacing: "-0.01em" }}>
                  {t.name}
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
                  {t.description}
                </p>
              </div>

              {/* Focus area pills */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {t.focus_areas.map((area) => {
                  const meta = AREA_META[area];
                  const AreaIcon = meta.icon;
                  return (
                    <div key={area} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 9px", borderRadius: 999,
                      background: meta.color + "14", color: meta.color,
                      fontSize: 10.5, fontWeight: 600,
                    }}>
                      <AreaIcon size={10} />
                      {area.charAt(0).toUpperCase() + area.slice(1)}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                paddingTop: 12, borderTop: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
                  Est. {t.est_min}–{t.est_min + 1} min
                </span>
                <button
                  onClick={() => onUseTemplate({ focus_areas: t.focus_areas, context: t.context })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 30, padding: "0 13px",
                    background: t.color, color: "#fff",
                    border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                    cursor: "pointer", transition: "opacity 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.82"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  Use template <ArrowRight size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
