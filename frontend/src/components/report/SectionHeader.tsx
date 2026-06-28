"use client";

import { Database } from "lucide-react";
import { ConfidencePill } from "../ui";
import type { Citation } from "@/lib/types";

interface Props {
  title: string;
  subtitle?: string;
  confidence: number;
  citations: Citation[];
}

/** Reusable header rendered at the top of each report section tab. */
export function SectionHeader({ title, subtitle, confidence, citations }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {citations.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-4)" }}>
            <Database size={11} /> {citations.length} sources
          </span>
        )}
        <ConfidencePill score={confidence} />
      </div>
    </div>
  );
}
