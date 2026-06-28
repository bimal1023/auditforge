"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Eyebrow, fmtUSD, fmtPct } from "../ui";
import type { MarketSection } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";
import { CitationFooter } from "./CitationFooter";

export function Market({ section }: { section: MarketSection }) {
  return (
    <>
      <SectionHeader
        title="Market Intelligence"
        subtitle="TAM · competitor share · momentum factors"
        confidence={section.confidence_score}
        citations={section.citations}
      />
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>
        {section.summary}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {section.market_size_usd != null && (
            <div style={{ padding: "18px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Total addressable market</Eyebrow>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                ${fmtUSD(section.market_size_usd)}
              </div>
            </div>
          )}
          {section.market_share != null && (
            <div style={{ padding: "16px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Estimated market share</Eyebrow>
              <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {fmtPct(section.market_share)}
              </div>
            </div>
          )}
        </div>

        {section.competitors.length > 0 && (
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Top competitors</Eyebrow>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {section.competitors.map((c, i) => {
                const maxShare = Math.max(...section.competitors.map((x) => x.estimated_market_share ?? 0), 0.3);
                return (
                  <div key={i} style={{
                    padding: "11px 14px",
                    borderBottom: i < section.competitors.length - 1 ? "1px solid var(--border)" : "none",
                    display: "grid", gridTemplateColumns: "1fr auto",
                    alignItems: "center", gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{c.name}</div>
                      <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: c.estimated_market_share != null ? `${Math.min(100, (c.estimated_market_share / maxShare) * 100)}%` : "0%",
                          background: "var(--green)", borderRadius: 999,
                          transition: "width 0.8s cubic-bezier(.2,.7,.3,1)",
                        }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                      {c.estimated_market_share != null ? fmtPct(c.estimated_market_share) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {section.growth_drivers.length > 0 && (
          <div style={{ padding: "16px", background: "var(--green-soft)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 12 }}>
            <Eyebrow style={{ color: "var(--green-ink)", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={10} /> Growth drivers
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {section.growth_drivers.map((d, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--green-ink)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: "var(--green)" }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {section.headwinds.length > 0 && (
          <div style={{ padding: "16px", background: "var(--red-soft)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12 }}>
            <Eyebrow style={{ color: "var(--red-ink)", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <TrendingDown size={10} /> Headwinds
              </span>
            </Eyebrow>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {section.headwinds.map((h, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--red-ink)", lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: "var(--red)" }} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CitationFooter citations={section.citations} />
    </>
  );
}
