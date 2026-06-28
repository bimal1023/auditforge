"use client";

import { Link } from "lucide-react";
import { Eyebrow } from "../ui";
import type { Citation } from "@/lib/types";

/** Source chip row rendered at the bottom of each report section. */
export function CitationFooter({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div style={{
      marginTop: 20, padding: "12px 14px",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <Eyebrow style={{ flexShrink: 0, marginRight: 4 }}>Sources</Eyebrow>
      {citations.slice(0, 6).map((c, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, fontSize: 11.5, color: "var(--ink-2)",
          fontWeight: 500,
        }}>
          <Link size={10} color="var(--ink-4)" />
          {c.url
            ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.source}</a>
            : c.source}
        </span>
      ))}
      {citations.length > 6 && (
        <span style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 500 }}>
          +{citations.length - 6} more
        </span>
      )}
    </div>
  );
}
