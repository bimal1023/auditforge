"use client";

import React from "react";

/**
 * A tiny, dependency-free Markdown renderer for chat answers.
 *
 * Deliberately minimal — it covers exactly what the model emits in this app:
 * headings (##/###), unordered + ordered lists, **bold**, `inline code`, and
 * paragraphs. Everything is rendered to real React nodes (no
 * dangerouslySetInnerHTML), so model output can never inject markup.
 */

/** Parse inline spans: **bold** and `code`. Returns an array of React nodes. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** or `code`, keeping the delimiters via capture groups.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={key} style={{ fontWeight: 700, color: "var(--ink)" }}>
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.88em",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
    }
  });
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l-${key++}`} style={{ margin: "4px 0", paddingLeft: 20, display: "grid", gap: 3 }}>
        {items.map((it, i) => (
          <li key={i} style={{ lineHeight: 1.6 }}>{inline(it, `li-${key}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Blank line → paragraph/list break
    if (!trimmed) {
      flushList();
      return;
    }

    // Headings
    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const big = heading[1].length === 2;
      blocks.push(
        <div
          key={`h-${key++}`}
          style={{
            fontSize: big ? 14.5 : 13.5,
            fontWeight: 700,
            color: "var(--ink)",
            margin: "8px 0 2px",
          }}
        >
          {inline(heading[2], `h-${key}`)}
        </div>,
      );
      return;
    }

    // Unordered list item
    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ul) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
      return;
    }

    // Ordered list item
    const ol = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ol) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
      return;
    }

    // Plain paragraph
    flushList();
    blocks.push(
      <p key={`p-${key++}`} style={{ margin: "4px 0", lineHeight: 1.65 }}>
        {inline(trimmed, `p-${key}`)}
      </p>,
    );
  });

  flushList();
  return <div>{blocks}</div>;
}
