"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mic, Search, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Sparkles, ChevronDown, ChevronRight,
  Trash2, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";

/* ── Types ──────────────────────────────────────────────────── */

interface EarningsEntry {
  id: string;
  ticker: string;
  company: string;
  year: number;
  quarter: number;
  transcript_date: string | null;
  analysis: EarningsAnalysis | null;
  created_at: string;
}

interface KeyMetric {
  metric: string;
  value: string;
  yoy_change?: string;
  context?: string;
}

interface KeyTopic {
  topic: string;
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
}

interface QAHighlight {
  analyst?: string;
  question_topic: string;
  management_response: string;
  notable?: boolean;
}

interface EarningsAnalysis {
  company_name?: string;
  key_metrics?: KeyMetric[];
  guidance?: {
    revenue_guidance?: string;
    eps_guidance?: string;
    outlook_tone?: string;
    changes_from_prior?: string;
  };
  management_tone?: {
    overall?: string;
    notable_quotes?: string[];
    red_flags?: string[];
    positive_signals?: string[];
  };
  key_topics?: KeyTopic[];
  analyst_qa_highlights?: QAHighlight[];
  risks_mentioned?: string[];
  catalysts?: string[];
  executive_summary?: string;
  raw_analysis?: string;
  parse_error?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────── */

const TONE_COLORS: Record<string, { bg: string; fg: string }> = {
  bullish:   { bg: "var(--g50)",  fg: "var(--g700)" },
  confident: { bg: "var(--g50)",  fg: "var(--g700)" },
  neutral:   { bg: "var(--n50)",  fg: "var(--n600)" },
  cautious:  { bg: "var(--y50)",  fg: "var(--y700)" },
  defensive: { bg: "var(--r50)",  fg: "var(--r700)" },
  bearish:   { bg: "var(--r50)",  fg: "var(--r700)" },
};

const SENTIMENT_ICON: Record<string, React.ReactNode> = {
  positive: <TrendingUp size={12} style={{ color: "var(--g600)" }} />,
  neutral:  <Minus size={12} style={{ color: "var(--n400)" }} />,
  negative: <TrendingDown size={12} style={{ color: "var(--r600)" }} />,
};

function ToneBadge({ tone }: { tone: string }) {
  const t = TONE_COLORS[tone] || TONE_COLORS.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: "var(--r-1)",
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 700, textTransform: "capitalize",
    }}>
      {tone}
    </span>
  );
}

const currentYear = new Date().getFullYear();
const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

/* ── Component ──────────────────────────────────────────────── */

export function EarningsView() {
  // Form state
  const [ticker, setTicker] = useState("");
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQ > 1 ? currentQ - 1 : 4);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // Results
  const [history, setHistory] = useState<EarningsEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    apiFetch("/api/v1/earnings/history")
      .then(async (r) => {
        if (r.ok) setHistory(await r.json());
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!ticker.trim()) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/earnings/analyze", {
        method: "POST",
        body: JSON.stringify({ ticker: ticker.trim(), year, quarter }),
      });
      if (res.ok) {
        const data: EarningsEntry = await res.json();
        setHistory((prev) => [data, ...prev]);
        setExpanded(data.id);
        setTicker("");
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.detail || "Analysis failed. Check the ticker and try again.");
      }
    } catch {
      setError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }, [ticker, year, quarter]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/earnings/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setHistory((prev) => prev.filter((e) => e.id !== id));
    }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => prev === id ? null : id);
  }, []);

  /* ── Card styles ──── */
  const card: React.CSSProperties = {
    background: "var(--n0)", border: "1px solid var(--n50)",
    borderRadius: "var(--r-2)", padding: "var(--s-300)",
    marginBottom: "var(--s-200)",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "var(--n500)",
    textTransform: "uppercase" as const, letterSpacing: "0.05em",
    marginBottom: 8, marginTop: 16,
  };

  return (
    <div style={{ maxWidth: 780 }}>
      {/* ── Input form ──────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--s-200)" }}>
          <Mic size={16} style={{ color: "var(--b600)" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--n900)" }}>
            Analyze earnings call
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Ticker
            </label>
            <input
              style={{
                width: 100, padding: "8px 10px", fontSize: 13,
                borderRadius: "var(--r-1)", border: "1px solid var(--n100)",
                background: "var(--n0)", color: "var(--n900)",
                textTransform: "uppercase", fontWeight: 600,
              }}
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={10}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Year
            </label>
            <select
              style={{
                padding: "8px 10px", fontSize: 13, borderRadius: "var(--r-1)",
                border: "1px solid var(--n100)", background: "var(--n0)", color: "var(--n900)",
              }}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Quarter
            </label>
            <select
              style={{
                padding: "8px 10px", fontSize: 13, borderRadius: "var(--r-1)",
                border: "1px solid var(--n100)", background: "var(--n0)", color: "var(--n900)",
              }}
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
          </div>

          <button
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--r-1)", border: "none", cursor: "pointer",
              background: "var(--b600)", color: "#fff",
              display: "flex", alignItems: "center", gap: 6,
              opacity: analyzing || !ticker.trim() ? 0.6 : 1,
            }}
            onClick={handleAnalyze}
            disabled={analyzing || !ticker.trim()}
          >
            {analyzing ? (
              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing...</>
            ) : (
              <><Search size={14} /> Analyze</>
            )}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: "var(--r-1)",
            background: "var(--r50)", color: "var(--r700)", fontSize: 12, fontWeight: 600,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Results list ────────────────────────── */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--n300)" }} />
        </div>
      )}

      {history.map((entry) => {
        const a = entry.analysis;
        const isExpanded = expanded === entry.id;
        const tone = a?.guidance?.outlook_tone || a?.management_tone?.overall || "neutral";

        return (
          <div key={entry.id} style={{
            ...card,
            borderColor: isExpanded ? "var(--b200)" : "var(--n50)",
          }}>
            {/* Header */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => toggleExpand(entry.id)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--n900)" }}>
                {entry.ticker}
              </span>
              <span style={{ fontSize: 13, color: "var(--n500)" }}>
                {a?.company_name || entry.company}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "var(--n400)",
                background: "var(--n25)", padding: "2px 8px", borderRadius: "var(--r-1)",
              }}>
                Q{entry.quarter} {entry.year}
              </span>
              <ToneBadge tone={tone} />
              <div style={{ flex: 1 }} />
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--n200)", padding: 4,
                }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Executive summary (always visible) */}
            {a?.executive_summary && (
              <p style={{
                fontSize: 13, color: "var(--n600)", lineHeight: 1.6,
                marginTop: 8, paddingLeft: 24,
              }}>
                {a.executive_summary}
              </p>
            )}

            {/* Expanded details */}
            {isExpanded && a && !a.parse_error && (
              <div style={{ paddingLeft: 24, marginTop: 8 }}>

                {/* Key Metrics */}
                {a.key_metrics && a.key_metrics.length > 0 && (
                  <>
                    <div style={sectionTitle}>Key metrics</div>
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                      gap: 8,
                    }}>
                      {a.key_metrics.map((m, i) => (
                        <div key={i} style={{
                          padding: "10px 12px", borderRadius: "var(--r-1)",
                          background: "var(--n10)", border: "1px solid var(--n50)",
                        }}>
                          <div style={{ fontSize: 11, color: "var(--n400)", fontWeight: 600, marginBottom: 2 }}>
                            {m.metric}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--n900)" }}>
                            {m.value}
                          </div>
                          {m.yoy_change && (
                            <div style={{
                              fontSize: 11, fontWeight: 600, marginTop: 2,
                              color: m.yoy_change.startsWith("+") ? "var(--g600)" :
                                     m.yoy_change.startsWith("-") ? "var(--r600)" : "var(--n400)",
                            }}>
                              {m.yoy_change} YoY
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Guidance */}
                {a.guidance && (
                  <>
                    <div style={sectionTitle}>Guidance</div>
                    <div style={{
                      padding: 12, borderRadius: "var(--r-1)",
                      background: "var(--n10)", border: "1px solid var(--n50)",
                    }}>
                      {a.guidance.revenue_guidance && (
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <strong>Revenue:</strong> {a.guidance.revenue_guidance}
                        </div>
                      )}
                      {a.guidance.eps_guidance && (
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <strong>EPS:</strong> {a.guidance.eps_guidance}
                        </div>
                      )}
                      {a.guidance.changes_from_prior && (
                        <div style={{ fontSize: 13, color: "var(--n500)", marginTop: 6 }}>
                          <em>vs. prior:</em> {a.guidance.changes_from_prior}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Key Topics */}
                {a.key_topics && a.key_topics.length > 0 && (
                  <>
                    <div style={sectionTitle}>Key topics discussed</div>
                    {a.key_topics.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 8, alignItems: "flex-start",
                        padding: "8px 0", borderBottom: i < a.key_topics!.length - 1 ? "1px solid var(--n25)" : "none",
                      }}>
                        {SENTIMENT_ICON[t.sentiment] || SENTIMENT_ICON.neutral}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--n800)" }}>{t.topic}</div>
                          <div style={{ fontSize: 12, color: "var(--n500)", lineHeight: 1.5 }}>{t.summary}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Management Tone */}
                {a.management_tone && (
                  <>
                    <div style={sectionTitle}>Management tone</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {a.management_tone.positive_signals && a.management_tone.positive_signals.length > 0 && (
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g600)", marginBottom: 4 }}>
                            <Sparkles size={11} style={{ verticalAlign: -1 }} /> Positive signals
                          </div>
                          {a.management_tone.positive_signals.map((s, i) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--n600)", marginBottom: 3, paddingLeft: 8 }}>
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                      {a.management_tone.red_flags && a.management_tone.red_flags.length > 0 && (
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--r600)", marginBottom: 4 }}>
                            <AlertTriangle size={11} style={{ verticalAlign: -1 }} /> Red flags
                          </div>
                          {a.management_tone.red_flags.map((s, i) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--n600)", marginBottom: 3, paddingLeft: 8 }}>
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Analyst Q&A Highlights */}
                {a.analyst_qa_highlights && a.analyst_qa_highlights.length > 0 && (
                  <>
                    <div style={sectionTitle}>Analyst Q&A highlights</div>
                    {a.analyst_qa_highlights.filter((q) => q.notable !== false).slice(0, 5).map((q, i) => (
                      <div key={i} style={{
                        padding: "8px 10px", marginBottom: 6,
                        borderRadius: "var(--r-1)", background: "var(--n10)",
                        border: q.notable ? "1px solid var(--b100)" : "1px solid var(--n25)",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--n700)" }}>
                          {q.analyst ? `${q.analyst}: ` : ""}{q.question_topic}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--n500)", marginTop: 2 }}>
                          {q.management_response}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Risks + Catalysts */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  {a.risks_mentioned && a.risks_mentioned.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={sectionTitle}>Risks mentioned</div>
                      {a.risks_mentioned.map((r, i) => (
                        <div key={i} style={{
                          fontSize: 12, color: "var(--r700)", padding: "3px 0",
                          display: "flex", alignItems: "flex-start", gap: 4,
                        }}>
                          <span style={{ color: "var(--r400)", flexShrink: 0 }}>-</span> {r}
                        </div>
                      ))}
                    </div>
                  )}
                  {a.catalysts && a.catalysts.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={sectionTitle}>Catalysts</div>
                      {a.catalysts.map((c, i) => (
                        <div key={i} style={{
                          fontSize: 12, color: "var(--g700)", padding: "3px 0",
                          display: "flex", alignItems: "flex-start", gap: 4,
                        }}>
                          <span style={{ color: "var(--g400)", flexShrink: 0 }}>+</span> {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback for parse errors */}
            {isExpanded && a?.parse_error && a?.raw_analysis && (
              <pre style={{
                paddingLeft: 24, marginTop: 8, fontSize: 12,
                color: "var(--n600)", whiteSpace: "pre-wrap", lineHeight: 1.6,
              }}>
                {a.raw_analysis}
              </pre>
            )}
          </div>
        );
      })}

      {!loading && history.length === 0 && (
        <div style={{
          textAlign: "center", padding: 40, color: "var(--n300)", fontSize: 13,
        }}>
          No earnings analyses yet. Enter a ticker above to get started.
        </div>
      )}
    </div>
  );
}
