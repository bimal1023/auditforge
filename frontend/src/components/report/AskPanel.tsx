"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square, Sparkles, FileText, Trash2 } from "lucide-react";
import type { Report } from "@/lib/types";
import { useReportChat } from "./useReportChat";
import { Markdown } from "./Markdown";

interface Props {
  report: Report;
}

/** Build a few report-aware starter questions so the empty state isn't a dead box. */
function suggestions(report: Report): string[] {
  const out: string[] = [];
  if (report.risk?.risks?.length) out.push("What are the most severe risks?");
  if (report.financial) out.push("Summarize the financial health in three points.");
  if (report.market) out.push("Who are the main competitors and what's the TAM?");
  if (report.legal?.litigations?.length) out.push("What litigation is outstanding?");
  out.push("What's the bull case and the bear case?");
  return out.slice(0, 4);
}

export function AskPanel({ report }: Props) {
  const { messages, streaming, status, error, hydrating, send, abort, clear } = useReportChat(report.id);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest turn in view as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (text: string) => {
    if (!text.trim() || streaming) return;
    send(text);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 540, maxHeight: "70vh" }}>
      {/* Header — only once there's a conversation to clear */}
      {!empty && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingBottom: 8, marginBottom: 4, borderBottom: "1px solid var(--border)",
        }}>
          <button
            onClick={clear}
            disabled={streaming}
            title="Clear conversation"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 500, color: "var(--ink-3)",
              background: "none", border: "none",
              cursor: streaming ? "not-allowed" : "pointer", padding: "4px 6px",
            }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
      )}

      {/* Scrollable conversation */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 2px" }}>
        {empty && hydrating ? (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink-4)", fontSize: 13,
          }}>
            Loading conversation…
          </div>
        ) : empty ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center",
              background: "var(--teal-soft, var(--brand-soft))", color: "var(--teal, var(--brand))",
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                Ask about {report.company}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4, maxWidth: 380 }}>
                Answers are grounded only in this report&apos;s findings and cite the section they came from.
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 480 }}>
              {suggestions(report).map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  style={{
                    fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)",
                    padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                    background: "var(--surface)", border: "1px solid var(--border-strong)",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "84%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  // User text is plain (preserve their line breaks); assistant
                  // text is Markdown-rendered, which manages its own spacing.
                  whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                  wordBreak: "break-word",
                  background: m.role === "user" ? "var(--brand)" : "var(--surface-2)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                  borderBottomRightRadius: m.role === "user" ? 4 : 14,
                  borderBottomLeftRadius: m.role === "user" ? 14 : 4,
                }}>
                  {m.role === "assistant"
                    ? (m.content
                        ? <Markdown text={m.content} />
                        : <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>
                            {status ?? "Thinking…"}
                          </span>)
                    : m.content}

                  {/* Document sources consulted for this answer */}
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10,
                      paddingTop: 8, borderTop: "1px solid var(--border)",
                    }}>
                      {m.sources.map((s, si) => (
                        <span key={si} title={`Relevance ${(s.score * 100).toFixed(0)}%`} style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
                          background: "var(--surface)", border: "1px solid var(--border)",
                          borderRadius: 6, padding: "3px 8px",
                        }}>
                          <FileText size={11} /> {s.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, fontSize: 12.5, color: "var(--red-ink)",
            background: "var(--red-soft)", border: "1px solid var(--red-soft)",
            borderRadius: 10, padding: "8px 12px",
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{
        marginTop: 12, display: "flex", alignItems: "flex-end", gap: 8,
        borderTop: "1px solid var(--border)", paddingTop: 12,
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Ask about ${report.company}…`}
          rows={1}
          style={{
            flex: 1, resize: "none", maxHeight: 120, minHeight: 42,
            padding: "11px 14px", fontSize: 13.5, lineHeight: 1.5,
            fontFamily: "Inter, sans-serif", color: "var(--ink)",
            background: "var(--surface)", border: "1px solid var(--border-strong)",
            borderRadius: 10, outline: "none",
          }}
        />
        {streaming ? (
          <button
            onClick={abort}
            title="Stop"
            style={{
              flexShrink: 0, height: 42, width: 42, borderRadius: 10, cursor: "pointer",
              display: "grid", placeItems: "center",
              background: "var(--surface)", color: "var(--ink-2)",
              border: "1px solid var(--border-strong)",
            }}
          >
            <Square size={15} />
          </button>
        ) : (
          <button
            onClick={() => submit(input)}
            disabled={!input.trim()}
            title="Send"
            style={{
              flexShrink: 0, height: 42, width: 42, borderRadius: 10,
              display: "grid", placeItems: "center", border: "none",
              cursor: input.trim() ? "pointer" : "not-allowed",
              background: input.trim() ? "var(--ink)" : "var(--border-strong)",
              color: "#fff",
              transition: "background 0.15s",
            }}
          >
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
