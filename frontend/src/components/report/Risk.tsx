"use client";

import { AlertTriangle, Info, Link as LinkIcon, ExternalLink } from "lucide-react";
import { Eyebrow } from "../ui";
import type { RiskSection } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";
import { CitationFooter } from "./CitationFooter";

/** Severity → color/icon mapping used by the risk cards. */
const SEV: Record<string, { color: string; bg: string; ink: string; icon: React.ElementType }> = {
  high:   { color: "var(--red)",   bg: "var(--red-soft)",   ink: "var(--red-ink)",   icon: AlertTriangle },
  medium: { color: "var(--amber)", bg: "var(--amber-soft)", ink: "var(--amber-ink)", icon: AlertTriangle },
  low:    { color: "var(--ink-3)", bg: "var(--surface-2)",  ink: "var(--ink-2)",     icon: Info },
};

export function Risk({ section }: { section: RiskSection }) {
  const high   = section.risks.filter((r) => r.severity === "high");
  const medium = section.risks.filter((r) => r.severity === "medium");
  const low    = section.risks.filter((r) => r.severity === "low");
  const grouped = [
    { sev: "high",   items: high },
    { sev: "medium", items: medium },
    { sev: "low",    items: low },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <SectionHeader
        title="Risk Assessment"
        subtitle="Material risk factors · severity-weighted"
        confidence={section.confidence_score}
        citations={section.citations}
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>
        {section.summary}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {grouped.map(({ sev, items }) => {
          const style = SEV[sev] ?? SEV.low;
          return (
            <div key={sev}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Eyebrow style={{ color: style.ink }}>
                  {sev.charAt(0).toUpperCase() + sev.slice(1)} severity
                </Eyebrow>
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
                            <LinkIcon size={10} /> {r.citation.source}
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
