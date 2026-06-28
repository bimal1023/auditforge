"use client";
// Shared design-system primitives
import React, { useId } from "react";

/* ── Formatters ────────────────────────────────────────────────────────────── */
export function fmtUSD(n: number | undefined | null, precision = 1): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(precision) + "T";
  if (abs >= 1e9)  return (n / 1e9 ).toFixed(precision) + "B";
  if (abs >= 1e6)  return (n / 1e6 ).toFixed(precision) + "M";
  if (abs >= 1e3)  return (n / 1e3 ).toFixed(precision) + "K";
  return n.toLocaleString();
}
export function fmtPct(n: number | undefined | null, p = 1): string {
  return n == null ? "—" : (n * 100).toFixed(p) + "%";
}
export function fmtSignedPct(n: number | undefined | null, p = 1): string {
  return n == null ? "—" : (n >= 0 ? "+" : "") + (n * 100).toFixed(p) + "%";
}

/* ── Financial-ratio formatting ───────────────────────────────────────────────
 * key_ratios arrives as a Record<string, number> with model-generated keys like
 * "gross_margin_2025", "debt_to_ebitda_2026_q2", "pe_ratio_current". These two
 * helpers turn those into a clean label + a period tag, and format the value as
 * a percent / multiple / plain number depending on the metric type.            */

const _METRIC_NAMES: Record<string, string> = {
  pe_ratio: "P/E Ratio", pe: "P/E", peg_ratio: "PEG Ratio",
  ps_ratio: "P/S Ratio", pb_ratio: "P/B Ratio",
  ev_ebitda: "EV / EBITDA", ev_to_ebitda: "EV / EBITDA",
  ev_revenue: "EV / Revenue", ev_to_revenue: "EV / Revenue", ev_sales: "EV / Sales",
  debt_to_ebitda: "Debt / EBITDA", net_debt_to_ebitda: "Net Debt / EBITDA",
  debt_to_equity: "Debt / Equity",
  roe: "ROE", roa: "ROA", roic: "ROIC",
  fcf_margin: "FCF Margin", current_ratio: "Current Ratio", quick_ratio: "Quick Ratio",
  interest_coverage: "Interest Coverage",
};

const _WORD_NAMES: Record<string, string> = {
  ebitda: "EBITDA", ebit: "EBIT", fcf: "FCF", roe: "ROE", roa: "ROA",
  roic: "ROIC", pe: "P/E", ev: "EV", yoy: "YoY", ttm: "TTM", capex: "CapEx",
};

function _prettyMetric(k: string): string {
  const lower = k.toLowerCase();
  if (_METRIC_NAMES[lower]) return _METRIC_NAMES[lower];
  return lower
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => _WORD_NAMES[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Split a ratio key into a human label and an optional period tag (e.g. "2026 Q2", "Current"). */
export function humanizeRatioKey(key: string): { label: string; period: string | null } {
  let k = key.trim();
  let period: string | null = null;

  const named = k.match(/_(current|ttm|ltm|fwd|forward|now)$/i);
  const yr = k.match(/_(\d{4})(?:_(q[1-4]|h[12]))?$/i);

  if (named && named.index != null) {
    const map: Record<string, string> = {
      current: "Current", ttm: "TTM", ltm: "LTM",
      fwd: "Fwd", forward: "Fwd", now: "Current",
    };
    period = map[named[1].toLowerCase()] ?? named[1];
    k = k.slice(0, named.index);
  } else if (yr && yr.index != null) {
    period = yr[2] ? `${yr[1]} ${yr[2].toUpperCase()}` : yr[1];
    k = k.slice(0, yr.index);
  }

  return { label: _prettyMetric(k), period };
}

/** Format a ratio value as a percent, a multiple (×), or a plain number based on its key. */
export function formatRatio(key: string, value: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const k = key.toLowerCase();

  const isPercent = /margin|roe|roa|roic|yield|payout|growth|tax_rate|rate$/.test(k);
  const isMultiple =
    /pe_ratio|^pe(_|$)|peg|p[sb]_ratio|ev_|_ebitda|_ratio$|debt_to|price_to|coverage/.test(k);

  if (isPercent) {
    // Margins/returns usually arrive fractional (0.69 → 69%); guard already-percent values.
    const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
    const signed = /growth/.test(k);
    return (signed && pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  }
  if (isMultiple) {
    const dp = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
    return value.toFixed(dp) + "×";
  }
  return value.toFixed(2);
}

/* ── Score band ─────────────────────────────────────────────────────────────  */
export function scoreBand(s: number) {
  if (s >= 7) return { label: "BUY",   color: "var(--green)",  bg: "var(--green-soft)",  ink: "var(--green-ink)"  };
  if (s >= 4) return { label: "HOLD",  color: "var(--amber)",  bg: "var(--amber-soft)",  ink: "var(--amber-ink)"  };
  return       { label: "AVOID", color: "var(--red)",    bg: "var(--red-soft)",    ink: "var(--red-ink)"    };
}

/* ── ScoreGauge ─────────────────────────────────────────────────────────────  */
export function ScoreGauge({ score: rawScore, size = 200 }: { score: number | null | undefined; size?: number }) {
  const score = rawScore ?? 0;
  const band  = scoreBand(score);
  const cx = size / 2, cy = size / 2;
  const strokeW = Math.max(10, size * 0.08);
  const r = (size - strokeW) / 2 - 2;

  const startA = -135 * Math.PI / 180;
  const endA   =  135 * Math.PI / 180;
  const sweep  = endA - startA;
  const circ   = 2 * Math.PI * r;
  const arcLen = circ * (sweep / (2 * Math.PI));
  const dash   = arcLen * (score / 10);
  const gradId = `sg_${Math.round(score * 100)}_${size}`;

  const px = (a: number) => cx + r * Math.cos(a);
  const py = (a: number) => cy + r * Math.sin(a);
  const bgPath = `M ${px(startA)} ${py(startA)} A ${r} ${r} 0 1 1 ${px(endA)} ${py(endA)}`;

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const a = startA + sweep * t;
    const inner = r - strokeW / 2 - 8;
    const outer = r - strokeW / 2 - 2;
    return {
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      major: i % 5 === 0,
    };
  });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size * 0.86} viewBox={`0 0 ${size} ${size * 0.86}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={band.color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={band.color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="var(--ink-5)" strokeWidth={t.major ? 1.5 : 1}
            opacity={t.major ? 0.6 : 0.3} strokeLinecap="round" />
        ))}
        <path d={bgPath} stroke="var(--surface-2)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        <path d={bgPath}
          stroke={`url(#${gradId})`} strokeWidth={strokeW} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen - dash}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.2,.7,.3,1)" }}
        />
        {[0, 5, 10].map((v) => {
          const a = startA + sweep * (v / 10);
          const lr = r + strokeW / 2 + 9;
          return (
            <text key={v} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)}
              fontSize={size * 0.052} fontFamily="JetBrains Mono, monospace" fontWeight="600"
              fill="var(--ink-5)" textAnchor="middle" dominantBaseline="middle">{v}</text>
          );
        })}
        <text x={cx} y={cy - size * 0.04}
          fontFamily="Inter, sans-serif" fontSize={size * 0.30} fontWeight="700"
          letterSpacing="-0.04em" fill="var(--ink)" textAnchor="middle" dominantBaseline="middle"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >{score.toFixed(1)}</text>
        <text x={cx} y={cy + size * 0.10}
          fontFamily="JetBrains Mono, monospace" fontSize={size * 0.06} fontWeight="500"
          fill="var(--ink-4)" textAnchor="middle" dominantBaseline="middle">/ 10.0</text>
      </svg>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "5px 14px 5px 10px",
        background: band.bg, color: band.ink,
        fontSize: 12, fontWeight: 700, letterSpacing: "0.07em",
        borderRadius: 999,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: band.color }} />
        {band.label}
      </div>
    </div>
  );
}

/* ── ScoreChip ───────────────────────────────────────────────────────────────  */
export function ScoreChip({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const band = scoreBand(score);
  const h = size === "lg" ? 36 : size === "sm" ? 22 : 28;
  const innerSize = h - 6;
  const fz = size === "lg" ? 13 : size === "sm" ? 10 : 11.5;
  const labelFz = size === "lg" ? 12 : 11;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: size === "lg" ? "0 12px 0 4px" : "0 9px 0 3px",
      height: h, background: band.bg, color: band.ink,
      borderRadius: 999, fontWeight: 700,
    }}>
      <div style={{
        width: innerSize, height: innerSize,
        borderRadius: 999, background: band.color, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: fz, fontWeight: 700, fontVariantNumeric: "tabular-nums",
      }}>{score.toFixed(1)}</div>
      <span style={{ fontSize: labelFz, letterSpacing: "0.05em" }}>{band.label}</span>
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────────────  */
export function Sparkline({
  data, width = 90, height = 28,
  stroke = "var(--brand)", strokeWidth = 1.5,
}: {
  data: number[]; width?: number; height?: number;
  stroke?: string; strokeWidth?: number;
}) {
  const rawId = useId();
  const gradId = `sf_${rawId.replace(/:/g, "")}`;
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i): [number, number] => [
    i * stepX,
    height - ((v - min) / range) * (height - 4) - 2,
  ]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={stroke} />
    </svg>
  );
}

/* ── ConfidencePill ──────────────────────────────────────────────────────────  */
export function ConfidencePill({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const tone = score >= 0.85 ? "green" : score >= 0.7 ? "brand" : score >= 0.5 ? "amber" : "red";
  const tones = {
    green: { bg: "var(--green-soft)", fg: "var(--green-ink)", fill: "var(--green)" },
    brand: { bg: "var(--brand-soft)", fg: "var(--brand-ink)", fill: "var(--brand)" },
    amber: { bg: "var(--amber-soft)", fg: "var(--amber-ink)", fill: "var(--amber)" },
    red:   { bg: "var(--red-soft)",   fg: "var(--red-ink)",   fill: "var(--red)" },
  }[tone];
  const h = size === "sm" ? 22 : 26;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      height: h, padding: "0 10px 0 8px",
      borderRadius: 999, background: tones.bg, color: tones.fg,
      fontSize: size === "sm" ? 11 : 11.5, fontWeight: 600,
    }}>
      <div style={{
        position: "relative", width: 30, height: 4,
        background: "rgba(0,0,0,0.10)", borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, right: "auto",
          width: `${Math.round(score * 100)}%`,
          background: tones.fill, borderRadius: 999,
        }} />
      </div>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(score * 100)}% conf.</span>
    </div>
  );
}

/* ── Pill ────────────────────────────────────────────────────────────────────  */
export function Pill({
  tone = "neutral", dot = false, children, style,
}: {
  tone?: "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "outline";
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const tones = {
    neutral: { bg: "var(--surface-2)",  fg: "var(--ink-3)",    dot: "var(--ink-4)", border: "var(--border)" },
    brand:   { bg: "var(--brand-soft)", fg: "var(--brand-ink)", dot: "var(--brand)", border: "transparent" },
    green:   { bg: "var(--green-soft)", fg: "var(--green-ink)", dot: "var(--green)", border: "transparent" },
    amber:   { bg: "var(--amber-soft)", fg: "var(--amber-ink)", dot: "var(--amber)", border: "transparent" },
    red:     { bg: "var(--red-soft)",   fg: "var(--red-ink)",   dot: "var(--red)",   border: "transparent" },
    blue:    { bg: "var(--blue-soft)",  fg: "var(--blue-ink)",  dot: "var(--blue)",  border: "transparent" },
    outline: { bg: "transparent",       fg: "var(--ink-3)",     dot: "var(--ink-4)", border: "var(--border-strong)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px",
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      borderRadius: 999, background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.border}`,
      letterSpacing: "0.01em", whiteSpace: "nowrap",
      ...style,
    }}>
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: tones.dot, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────────  */
export function Card({
  children, style, muted = false, className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={className} style={{
      background: muted ? "var(--surface-2)" : "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      boxShadow: muted ? "none" : "var(--shadow-sm)",
      ...style,
    }}>{children}</div>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────────────────────  */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--ink-4)",
      ...style,
    }}>{children}</div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────────  */
export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      display: "inline-block",
    }} />
  );
}
