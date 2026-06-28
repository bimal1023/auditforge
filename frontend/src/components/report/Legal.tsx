"use client";

import { ExternalLink } from "lucide-react";
import { useIsMobile } from "@/lib/hooks";
import { Eyebrow, fmtUSD } from "../ui";
import type { LegalSection } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";
import { CitationFooter } from "./CitationFooter";

export function Legal({ section }: { section: LegalSection }) {
  const isMobile = useIsMobile();
  return (
    <>
      <SectionHeader
        title="Legal & Regulatory"
        subtitle="Active litigation · regulatory exposure"
        confidence={section.confidence_score}
        citations={section.citations}
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>
        {section.summary}
      </p>

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
