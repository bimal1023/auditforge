"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, FileText, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Spinner } from "./ui";

interface SourceChunk {
  text: string;
  source: string;
  score: number;
}

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  sources: SourceChunk[];
  created_at: string;
}

/**
 * Lightweight inline Markdown renderer — handles **bold**, *italic*,
 * `code`, and [Source N] citation badges. No external deps.
 */
/** Render inline Markdown tokens within a single line. */
function renderInline(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[Sources?\s[\d,\s\-–]+\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let ki = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) parts.push(line.slice(last, match.index));
    if (match[1]) {
      parts.push(<strong key={ki++} style={{ fontWeight: 700, color: "var(--n900)" }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={ki++}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <code key={ki++} className="mono" style={{
          fontSize: "0.92em", padding: "1px 5px",
          background: "var(--n20)", borderRadius: "var(--r-1)",
        }}>{match[6]}</code>
      );
    } else if (match[7]) {
      parts.push(
        <span key={ki++} className="mono" style={{
          fontSize: 10, fontWeight: 600, color: "var(--b700)",
          background: "var(--b50)", padding: "1px 5px",
          borderRadius: "var(--r-1)", whiteSpace: "nowrap",
        }}>{match[7]}</span>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

/**
 * Lightweight Markdown renderer — handles # headings, **bold**, *italic*,
 * `code`, - bullet lists, and [Source N] citation badges.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line.trim()) { i++; continue; }

    // Horizontal rule: --- or *** or ___
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push(
        <hr key={i} style={{
          border: "none", borderTop: "1px solid var(--n30)",
          margin: "0.6em 0",
        }} />
      );
      i++;
      continue;
    }

    // Headings: # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? 15 : level === 2 ? 13.5 : 12.5;
      blocks.push(
        <div key={i} style={{
          fontSize, fontWeight: 700, color: "var(--n900)",
          marginTop: blocks.length > 0 ? "0.8em" : 0,
          marginBottom: "0.3em", letterSpacing: "-0.01em",
        }}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Markdown table: | col | col | ... lines
    if (/^\|(.+\|)+\s*$/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|(.+\|)+\s*$/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // Skip separator row (|---|---|)
      const dataRows = tableLines.filter((r) => !/^\|[\s\-:]+\|$/.test(r.replace(/\|/g, (m, o, s) => s[o - 1] === "-" || s[o + 1] === "-" ? m : m).trim()));
      const headerRow = dataRows[0];
      const bodyRows = dataRows.slice(1);
      const parseCells = (row: string) =>
        row.split("|").filter((_, ci, a) => ci > 0 && ci < a.length - 1).map((c) => c.trim());

      // Also filter the separator row more robustly
      const isSep = (row: string) => parseCells(row).every((c) => /^[-:]+$/.test(c));
      const filteredBody = bodyRows.filter((r) => !isSep(r));

      if (headerRow) {
        const headers = parseCells(headerRow);
        blocks.push(
          <div key={`tbl-${i}`} style={{
            margin: "0.5em 0", overflowX: "auto",
            border: "1px solid var(--n30)", borderRadius: "var(--r-2)",
          }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: 11.5, lineHeight: 1.5,
            }}>
              <thead>
                <tr style={{ background: "var(--n20)" }}>
                  {headers.map((h, hi) => (
                    <th key={hi} style={{
                      padding: "6px 10px", textAlign: "left",
                      fontWeight: 700, color: "var(--n900)",
                      borderBottom: "1px solid var(--n30)",
                    }}>{renderInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBody.map((row, ri) => {
                  const cells = parseCells(row);
                  return (
                    <tr key={ri} style={{ background: ri % 2 ? "var(--n10)" : "var(--n0)" }}>
                      {cells.map((c, ci) => (
                        <td key={ci} style={{
                          padding: "5px 10px", color: "var(--n800)",
                          borderBottom: "1px solid var(--n20)",
                        }}>{renderInline(c)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list: collect consecutive - or * lines
    if (/^\s*[-*]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(
          <li key={i} style={{ marginBottom: 2 }}>
            {renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}
          </li>
        );
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} style={{
          margin: "0.4em 0", paddingLeft: 20,
          fontSize: "inherit", lineHeight: "inherit",
        }}>
          {items}
        </ul>
      );
      continue;
    }

    // Numbered list: collect consecutive 1. 2. lines
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(
          <li key={i} style={{ marginBottom: 2 }}>
            {renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}
          </li>
        );
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} style={{
          margin: "0.4em 0", paddingLeft: 20,
          fontSize: "inherit", lineHeight: "inherit",
        }}>
          {items}
        </ol>
      );
      continue;
    }

    // Regular paragraph: collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*[-*]\s/.test(lines[i]) &&
      !/^\s*\d+[.)]\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} style={{ margin: blocks.length > 0 ? "0.5em 0 0" : 0 }}>
        {paraLines.map((pl, pli) => (
          <span key={pli}>
            {renderInline(pl)}
            {pli < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
}

export function DealRoomQA() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [history, setHistory]     = useState<QAEntry[]>([]);
  const [error, setError]         = useState<string | null>(null);

  // Load persisted history on mount
  useEffect(() => {
    apiFetch("/api/v1/documents/query/history")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: QAEntry[]) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v1/documents/query", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Query failed");
        return;
      }
      const entry: QAEntry = {
        id: data.id,
        question: data.question,
        answer: data.answer,
        sources: data.sources ?? [],
        created_at: data.created_at,
      };
      setHistory((prev) => [entry, ...prev]);
      setQuestion("");
    } catch {
      setError("Query failed — network error");
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  }

  async function handleDelete(id: string) {
    setHistory((prev) => prev.filter((e) => e.id !== id));
    try {
      await apiFetch(`/api/v1/documents/query/${id}`, { method: "DELETE" });
    } catch { /* optimistic — already removed from UI */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-100)" }}>
      {/* ── Card ── */}
      <div style={{
        background: "var(--n0)", border: "1px solid var(--n30)",
        borderRadius: "var(--r-3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "var(--s-150) var(--s-200)",
          borderBottom: "1px solid var(--n30)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-100)" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "var(--r-2)",
              background: "var(--p50)", color: "var(--p500)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageSquare size={12} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n900)", letterSpacing: "-0.01em" }}>
              Deal Room Q&A
            </span>
          </div>
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: "var(--n200)",
            background: "var(--n20)", padding: "2px 8px", borderRadius: "var(--r-1)",
          }}>
            {histLoading ? "..." : `${history.length} ${history.length === 1 ? "query" : "queries"}`}
          </span>
        </div>

        <div style={{ padding: "var(--s-150)" }}>
          <p style={{ margin: "0 0 var(--s-100)", fontSize: 12, color: "var(--n300)", lineHeight: 1.55 }}>
            Ask questions about your uploaded documents. Answers are grounded in your PDFs and CSVs with source citations.
          </p>

          {/* ── Input area ── */}
          <div style={{
            display: "flex", gap: "var(--s-100)", alignItems: "flex-end",
          }}>
            <div style={{
              flex: 1, position: "relative",
              background: "var(--n10)", border: "1px solid var(--n30)",
              borderRadius: "var(--r-2)", transition: "border-color 0.15s",
            }}>
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents..."
                disabled={loading}
                rows={2}
                style={{
                  width: "100%", padding: "var(--s-100) var(--s-150)",
                  background: "transparent", border: "none", outline: "none",
                  fontSize: 13, color: "var(--n800)", resize: "none",
                  lineHeight: 1.55, fontFamily: "inherit",
                }}
              />
            </div>
            <button
              onClick={handleAsk}
              disabled={!question.trim() || loading}
              style={{
                width: 36, height: 36, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: question.trim() && !loading ? "var(--b500)" : "var(--n30)",
                color: question.trim() && !loading ? "#fff" : "var(--n200)",
                border: "none", borderRadius: "var(--r-2)",
                cursor: question.trim() && !loading ? "pointer" : "not-allowed",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {loading ? <Spinner size={14} color="#fff" /> : <Send size={14} />}
            </button>
          </div>

          {error && (
            <p style={{ margin: "var(--s-100) 0 0", fontSize: 12, color: "var(--r500)", fontWeight: 500 }}>
              {error}
            </p>
          )}

          {/* ── Loading indicator ── */}
          {loading && (
            <div style={{
              display: "flex", alignItems: "center", gap: "var(--s-100)",
              marginTop: "var(--s-150)", padding: "var(--s-100) var(--s-150)",
              background: "var(--b50)", border: "1px solid var(--b75)",
              borderRadius: "var(--r-2)",
            }}>
              <Spinner size={13} color="var(--b500)" />
              <span style={{ fontSize: 12, color: "var(--b700)", fontWeight: 500 }}>
                Searching documents and generating answer...
              </span>
            </div>
          )}

          {/* ── History ── */}
          <div ref={scrollRef} style={{
            marginTop: "var(--s-150)", display: "flex", flexDirection: "column", gap: "var(--s-150)",
            overflowY: "auto",
          }}>
            {history.length === 0 && !loading && (
              <div style={{
                textAlign: "center", padding: "var(--s-300) var(--s-150)",
                color: "var(--n200)",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--r-3)",
                  background: "var(--n20)", color: "var(--n100)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "var(--s-100)",
                }}>
                  <MessageSquare size={18} />
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
                  No queries yet. Upload some documents above, then ask a question.
                </p>
              </div>
            )}

            {history.map((entry, i) => (
              <QACard key={entry.id} entry={entry} isLatest={i === 0} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Single Q&A card ── */
function QACard({ entry, isLatest, onDelete }: {
  entry: QAEntry; isLatest: boolean; onDelete: (id: string) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(isLatest);

  return (
    <div style={{
      background: "var(--n10)", border: "1px solid var(--n20)",
      borderRadius: "var(--r-2)", overflow: "hidden",
    }}>
      {/* Question */}
      <div style={{
        padding: "var(--s-100) var(--s-150)",
        borderBottom: "1px solid var(--n20)",
        display: "flex", alignItems: "flex-start", gap: "var(--s-100)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "var(--r-1)", flexShrink: 0, marginTop: 1,
          background: "var(--b50)", color: "var(--b500)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Send size={10} />
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--n800)", lineHeight: 1.55 }}>
          {entry.question}
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          title="Remove from history"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--n200)", padding: 4, display: "flex",
            borderRadius: "var(--r-1)", flexShrink: 0,
            transition: "color 0.12s",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Answer */}
      <div style={{ padding: "var(--s-150)" }}>
        <div style={{
          fontSize: 12.5, color: "var(--n800)", lineHeight: 1.7,
          wordBreak: "break-word",
        }}>
          {renderMarkdown(entry.answer)}
        </div>

        {/* Sources toggle */}
        {entry.sources.length > 0 && (
          <div style={{ marginTop: "var(--s-100)" }}>
            <button
              onClick={() => setSourcesOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--s-50)",
                background: "none", border: "none", padding: 0,
                fontSize: 11, fontWeight: 600, color: "var(--b500)",
                cursor: "pointer",
              }}
            >
              <FileText size={11} />
              {entry.sources.length} {entry.sources.length === 1 ? "source" : "sources"}
              {sourcesOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {sourcesOpen && (
              <div style={{
                marginTop: "var(--s-75)", display: "flex", flexDirection: "column", gap: "var(--s-50)",
              }}>
                {entry.sources.map((src, j) => (
                  <div key={j} style={{
                    padding: "var(--s-75) var(--s-100)",
                    background: "var(--n0)", border: "1px solid var(--n20)",
                    borderRadius: "var(--r-1)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-75)", marginBottom: 2 }}>
                      <FileText size={10} style={{ color: "var(--n200)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--n800)" }}>
                        {src.source}
                      </span>
                      <span className="mono" style={{
                        fontSize: 10, color: "var(--n200)", marginLeft: "auto",
                      }}>
                        {(src.score * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 11, color: "var(--n300)", lineHeight: 1.5,
                      display: "-webkit-box", WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {src.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
