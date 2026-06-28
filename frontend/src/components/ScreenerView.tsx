"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Filter, Loader2, TrendingUp, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/auth";

/* ── Types ──────────────────────────────────────────────────── */

interface ScreenResult {
  ticker: string;
  company: string;
  market_cap: number | null;
  price: number | null;
  sector: string;
  industry: string;
  exchange: string;
}

interface Filters {
  sectors: string[];
  exchanges: string[];
  cap_ranges: { label: string; min: number | null; max: number | null }[];
}

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

/* ── Component ──────────────────────────────────────────────── */

export function ScreenerView() {
  // Filters
  const [filterOpts, setFilterOpts] = useState<Filters | null>(null);
  const [sector, setSector] = useState("");
  const [exchange, setExchange] = useState("");
  const [capRange, setCapRange] = useState<number>(-1);  // index into cap_ranges
  const [resultLimit, setResultLimit] = useState(20);

  // Results
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  // Load filter options
  useEffect(() => {
    apiFetch("/api/v1/screener/filters")
      .then(async (r) => { if (r.ok) setFilterOpts(await r.json()); })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setError("");
    setAiSummary(null);

    const body: Record<string, unknown> = { limit: resultLimit };
    if (sector) body.sector = sector;
    if (exchange) body.exchange = exchange;
    if (capRange >= 0 && filterOpts) {
      const range = filterOpts.cap_ranges[capRange];
      if (range.min != null) body.market_cap_min = range.min;
      if (range.max != null) body.market_cap_max = range.max;
    }

    try {
      const res = await apiFetch("/api/v1/screener/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAiSummary(data.ai_summary || null);
        setSearched(true);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.detail || "Search failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSearching(false);
    }
  }, [sector, exchange, capRange, resultLimit, filterOpts]);

  const card: React.CSSProperties = {
    background: "var(--n0)", border: "1px solid var(--n50)",
    borderRadius: "var(--r-2)", padding: "var(--s-300)",
    marginBottom: "var(--s-200)",
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px 10px", fontSize: 13, borderRadius: "var(--r-1)",
    border: "1px solid var(--n100)", background: "var(--n0)", color: "var(--n900)",
    minWidth: 140,
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700,
    color: "var(--n400)", textTransform: "uppercase",
    letterSpacing: "0.05em", textAlign: "left",
    borderBottom: "2px solid var(--n50)", whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 13, borderBottom: "1px solid var(--n25)",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ── Filters ─────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--s-200)" }}>
          <Filter size={16} style={{ color: "var(--b600)" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--n900)" }}>
            Stock screener
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Sector
            </label>
            <select style={selectStyle} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">All sectors</option>
              {filterOpts?.sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Exchange
            </label>
            <select style={selectStyle} value={exchange} onChange={(e) => setExchange(e.target.value)}>
              <option value="">All exchanges</option>
              {filterOpts?.exchanges.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Market cap
            </label>
            <select
              style={selectStyle}
              value={capRange}
              onChange={(e) => setCapRange(Number(e.target.value))}
            >
              <option value={-1}>Any size</option>
              {filterOpts?.cap_ranges.map((r, i) => (
                <option key={i} value={i}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--n400)", display: "block", marginBottom: 3 }}>
              Results
            </label>
            <select style={{ ...selectStyle, minWidth: 70 }} value={resultLimit} onChange={(e) => setResultLimit(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--r-1)", border: "none", cursor: "pointer",
              background: "var(--b600)", color: "#fff",
              display: "flex", alignItems: "center", gap: 6,
              opacity: searching ? 0.6 : 1,
            }}
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Screening...</>
            ) : (
              <><Search size={14} /> Screen</>
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

      {/* ── AI Summary ──────────────────────────── */}
      {aiSummary && (
        <div style={{
          ...card, background: "var(--b50)", borderColor: "var(--b100)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <Sparkles size={16} style={{ color: "var(--b600)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: "var(--n700)", lineHeight: 1.6, margin: 0 }}>
            {aiSummary}
          </p>
        </div>
      )}

      {/* ── Results table ───────────────────────── */}
      {results.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--n10)" }}>
                <th style={thStyle}>Ticker</th>
                <th style={thStyle}>Company</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Market cap</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                <th style={thStyle}>Sector</th>
                <th style={thStyle}>Industry</th>
                <th style={thStyle}>Exchange</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{
                  background: i % 2 === 0 ? "transparent" : "var(--n5, var(--n0))",
                }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "var(--b700)" }}>
                    {r.ticker}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--n700)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.company}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                    {fmtCap(r.market_cap)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                    {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--n500)" }}>
                    {r.sector}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "var(--n400)" }}>
                    {r.industry}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px",
                      borderRadius: "var(--r-1)", background: "var(--n25)", color: "var(--n500)",
                    }}>
                      {r.exchange}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            padding: "10px 16px", fontSize: 11, color: "var(--n300)",
            borderTop: "1px solid var(--n50)", background: "var(--n10)",
          }}>
            Showing {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {searched && results.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--n300)", fontSize: 13 }}>
          No companies matched. Try broadening your filters.
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--n300)", fontSize: 13 }}>
          <TrendingUp size={20} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
          Select filters above and click Screen to find companies.
        </div>
      )}
    </div>
  );
}
