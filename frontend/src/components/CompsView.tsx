"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart2, Plus, X, TrendingUp, TrendingDown, Minus,
  Trash2, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";

/* ── Types ──────────────────────────────────────────────────── */

interface CompsEntry {
  id: string;
  target_ticker: string;
  peer_tickers: string[];
  analysis: CompsAnalysis | null;
  created_at: string;
}

interface CompanyRow {
  ticker: string;
  company_name: string;
  market_cap_b: number | null;
  ev_b: number | null;
  revenue_b: number | null;
  ebitda_b: number | null;
  pe_ratio: number | null;
  ev_ebitda: number | null;
  ev_revenue: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
}

interface CompsAnalysis {
  target?: CompanyRow;
  peers?: CompanyRow[];
  median_multiples?: Record<string, number | null>;
  implied_valuation?: {
    based_on_ev_ebitda?: string;
    based_on_ev_revenue?: string;
    based_on_pe?: string;
    current_vs_implied?: string;
    premium_discount_pct?: number;
  };
  analysis?: string;
  key_differences?: string[];
  raw_analysis?: string;
  parse_error?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────── */

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "—";
  if (suffix === "x") return `${v.toFixed(1)}x`;
  if (suffix === "%") return `${(v * 100).toFixed(1)}%`;
  if (suffix === "$B") return `$${v.toFixed(1)}B`;
  return v.toFixed(2);
}

function ValBadge({ label }: { label: string | undefined }) {
  if (!label) return null;
  const colors: Record<string, { bg: string; fg: string }> = {
    premium:  { bg: "var(--r50)",  fg: "var(--r700)" },
    discount: { bg: "var(--g50)",  fg: "var(--g700)" },
    inline:   { bg: "var(--n50)",  fg: "var(--n600)" },
  };
  const c = colors[label] || colors.inline;
  return (
    <span style={{
      display: "inline-flex", padding: "2px 10px", borderRadius: "var(--r-1)",
      background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700,
      textTransform: "capitalize",
    }}>
      {label}
    </span>
  );
}

/* ── Component ──────────────────────────────────────────────── */

export function CompsView() {
  const [targetTicker, setTargetTicker] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [peers, setPeers] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<CompsEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/v1/comps/history")
      .then(async (r) => { if (r.ok) setHistory(await r.json()); })
      .finally(() => setLoading(false));
  }, []);

  const addPeer = useCallback(() => {
    const t = peerInput.trim().toUpperCase();
    if (t && !peers.includes(t) && t !== targetTicker.toUpperCase() && peers.length < 8) {
      setPeers((p) => [...p, t]);
      setPeerInput("");
    }
  }, [peerInput, peers, targetTicker]);

  const removePeer = useCallback((t: string) => {
    setPeers((p) => p.filter((x) => x !== t));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!targetTicker.trim() || peers.length < 1) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/comps/analyze", {
        method: "POST",
        body: JSON.stringify({
          target_ticker: targetTicker.trim(),
          peer_tickers: peers,
        }),
      });
      if (res.ok) {
        const data: CompsEntry = await res.json();
        setHistory((prev) => [data, ...prev]);
        setExpanded(data.id);
        setTargetTicker("");
        setPeers([]);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.detail || "Analysis failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }, [targetTicker, peers]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/comps/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setHistory((p) => p.filter((e) => e.id !== id));
  }, []);

  /* ── Styles ──── */
  const card: React.CSSProperties = {
    background: "var(--n0)", border: "1px solid var(--n50)",
    borderRadius: "var(--r-2)", padding: "var(--s-300)",
    marginBottom: "var(--s-200)",
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 10px", fontSize: 11, fontWeight: 700,
    color: "var(--n400)", textTransform: "uppercase",
    letterSpacing: "0.05em", textAlign: "right",
    borderBottom: "2px solid var(--n50)", whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 10px", fontSize: 12, textAlign: "right",
    borderBottom: "1px solid var(--n25)", fontFamily: "var(--font-mono, monospace)",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ── Input form ──────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--s-200)" }}>
          <BarChart2 size={16} style={{ color: "var(--b600)" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--n900)" }}>
            Comparable companies analysis
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Target
            </label>
            <input
              style={{
                width: 100, padding: "8px 10px", fontSize: 13,
                borderRadius: "var(--r-1)", border: "1px solid var(--n100)",
                textTransform: "uppercase", fontWeight: 600,
              }}
              value={targetTicker}
              onChange={(e) => setTargetTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={10}
            />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Peers (press Enter to add)
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {peers.map((p) => (
                <span key={p} style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "3px 8px", borderRadius: "var(--r-1)",
                  background: "var(--b50)", color: "var(--b700)",
                  fontSize: 12, fontWeight: 600,
                }}>
                  {p}
                  <button
                    onClick={() => removePeer(p)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--b400)", padding: 0 }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                style={{
                  width: 80, padding: "8px 10px", fontSize: 13,
                  borderRadius: "var(--r-1)", border: "1px solid var(--n100)",
                  textTransform: "uppercase", fontWeight: 600,
                }}
                value={peerInput}
                onChange={(e) => setPeerInput(e.target.value.toUpperCase())}
                placeholder="MSFT"
                maxLength={10}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPeer(); } }}
              />
              <button
                onClick={addPeer}
                style={{
                  padding: "6px 10px", borderRadius: "var(--r-1)",
                  border: "1px solid var(--n100)", background: "var(--n0)",
                  cursor: "pointer", color: "var(--n500)", fontSize: 12,
                }}
                type="button"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <button
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--r-1)", border: "none", cursor: "pointer",
              background: "var(--b600)", color: "#fff",
              display: "flex", alignItems: "center", gap: 6,
              opacity: analyzing || !targetTicker.trim() || peers.length < 1 ? 0.6 : 1,
            }}
            onClick={handleAnalyze}
            disabled={analyzing || !targetTicker.trim() || peers.length < 1}
          >
            {analyzing ? (
              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Building comps...</>
            ) : (
              <><BarChart2 size={14} /> Run comps</>
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

      {/* ── History ──────────────────────────────── */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--n300)" }} />
        </div>
      )}

      {history.map((entry) => {
        const a = entry.analysis;
        const isExpanded = expanded === entry.id;
        const allRows: CompanyRow[] = [];
        if (a?.target) allRows.push(a.target);
        if (a?.peers) allRows.push(...a.peers);

        return (
          <div key={entry.id} style={{
            ...card, borderColor: isExpanded ? "var(--b200)" : "var(--n50)",
          }}>
            {/* Header row */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setExpanded(isExpanded ? null : entry.id)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--n900)" }}>
                {entry.target_ticker}
              </span>
              <span style={{ fontSize: 12, color: "var(--n400)" }}>vs</span>
              {entry.peer_tickers.map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 6px",
                  borderRadius: "var(--r-1)", background: "var(--n25)", color: "var(--n600)",
                }}>
                  {t}
                </span>
              ))}
              {a?.implied_valuation?.current_vs_implied && (
                <ValBadge label={a.implied_valuation.current_vs_implied} />
              )}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--n300)" }}>
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n200)", padding: 4 }}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Analysis text */}
            {a?.analysis && (
              <p style={{
                fontSize: 13, color: "var(--n600)", lineHeight: 1.6,
                marginTop: 8, paddingLeft: 24,
              }}>
                {a.analysis}
              </p>
            )}

            {/* Expanded: comps table + implied valuation */}
            {isExpanded && a && !a.parse_error && (
              <div style={{ paddingLeft: 10, marginTop: 12, overflowX: "auto" }}>
                {/* Comps table */}
                {allRows.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left" }}>Company</th>
                        <th style={thStyle}>Mkt Cap</th>
                        <th style={thStyle}>EV</th>
                        <th style={thStyle}>Rev</th>
                        <th style={thStyle}>P/E</th>
                        <th style={thStyle}>EV/EBITDA</th>
                        <th style={thStyle}>EV/Rev</th>
                        <th style={thStyle}>Gross</th>
                        <th style={thStyle}>Net</th>
                        <th style={thStyle}>Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row, i) => {
                        const isTarget = row.ticker === entry.target_ticker;
                        return (
                          <tr key={i} style={{
                            background: isTarget ? "var(--b50)" : "transparent",
                          }}>
                            <td style={{
                              ...tdStyle, textAlign: "left", fontFamily: "inherit",
                              fontWeight: isTarget ? 700 : 400,
                              color: isTarget ? "var(--b700)" : "var(--n700)",
                            }}>
                              {row.ticker}
                              {isTarget && <span style={{ fontSize: 9, marginLeft: 4, color: "var(--b500)" }}>TARGET</span>}
                            </td>
                            <td style={tdStyle}>{fmt(row.market_cap_b, "$B")}</td>
                            <td style={tdStyle}>{fmt(row.ev_b, "$B")}</td>
                            <td style={tdStyle}>{fmt(row.revenue_b, "$B")}</td>
                            <td style={tdStyle}>{fmt(row.pe_ratio, "x")}</td>
                            <td style={tdStyle}>{fmt(row.ev_ebitda, "x")}</td>
                            <td style={tdStyle}>{fmt(row.ev_revenue, "x")}</td>
                            <td style={tdStyle}>{fmt(row.gross_margin, "%")}</td>
                            <td style={tdStyle}>{fmt(row.net_margin, "%")}</td>
                            <td style={{
                              ...tdStyle,
                              color: row.revenue_growth != null
                                ? row.revenue_growth > 0 ? "var(--g600)" : "var(--r600)"
                                : "var(--n300)",
                            }}>
                              {fmt(row.revenue_growth, "%")}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Median row */}
                      {a.median_multiples && (
                        <tr style={{ borderTop: "2px solid var(--n100)" }}>
                          <td style={{ ...tdStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 700, color: "var(--n500)" }}>
                            Peer median
                          </td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>{fmt(a.median_multiples.pe_ratio, "x")}</td>
                          <td style={tdStyle}>{fmt(a.median_multiples.ev_ebitda, "x")}</td>
                          <td style={tdStyle}>{fmt(a.median_multiples.ev_revenue, "x")}</td>
                          <td style={tdStyle}>{fmt(a.median_multiples.gross_margin, "%")}</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>{fmt(a.median_multiples.revenue_growth, "%")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Implied valuation */}
                {a.implied_valuation && (
                  <div style={{
                    display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12,
                  }}>
                    {[
                      { label: "EV/EBITDA implied", val: a.implied_valuation.based_on_ev_ebitda },
                      { label: "EV/Revenue implied", val: a.implied_valuation.based_on_ev_revenue },
                      { label: "P/E implied", val: a.implied_valuation.based_on_pe },
                    ].filter((v) => v.val).map((v, i) => (
                      <div key={i} style={{
                        flex: 1, minWidth: 140, padding: "10px 12px",
                        borderRadius: "var(--r-1)", background: "var(--n10)",
                        border: "1px solid var(--n50)",
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--n400)", textTransform: "uppercase" }}>
                          {v.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--n900)", marginTop: 2 }}>
                          {v.val}
                        </div>
                      </div>
                    ))}
                    {a.implied_valuation.premium_discount_pct != null && (
                      <div style={{
                        flex: 1, minWidth: 140, padding: "10px 12px",
                        borderRadius: "var(--r-1)",
                        background: a.implied_valuation.current_vs_implied === "discount" ? "var(--g50)" : "var(--r50)",
                        border: "1px solid " + (a.implied_valuation.current_vs_implied === "discount" ? "var(--g200)" : "var(--r200)"),
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--n400)", textTransform: "uppercase" }}>
                          vs peers
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700, marginTop: 2,
                          color: a.implied_valuation.current_vs_implied === "discount" ? "var(--g700)" : "var(--r700)",
                        }}>
                          {a.implied_valuation.premium_discount_pct > 0 ? "+" : ""}
                          {a.implied_valuation.premium_discount_pct.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Key differences */}
                {a.key_differences && a.key_differences.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "var(--n400)",
                      textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                    }}>
                      Key differences
                    </div>
                    {a.key_differences.map((d, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: "var(--n600)", padding: "3px 0",
                        display: "flex", gap: 6,
                      }}>
                        <span style={{ color: "var(--n300)", flexShrink: 0 }}>-</span>
                        {d}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fallback */}
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
        <div style={{ textAlign: "center", padding: 40, color: "var(--n300)", fontSize: 13 }}>
          No comps analyses yet. Enter a target and peers above.
        </div>
      )}
    </div>
  );
}
