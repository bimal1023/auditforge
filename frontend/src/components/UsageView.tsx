"use client";

import { useEffect, useState } from "react";
import { FileText, Eye, Zap, Loader2, AlertTriangle, Infinity as InfinityIcon, Plus } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import type { UsageSummary } from "@/lib/types";

/** Pre-set top-up bundles offered when a workspace is running low. */
const TOPUP_PACKS = [10, 25, 50];

interface Props {
  /** Notifies the parent of the current memo-usage percent (for the sidebar badge). */
  onUsagePercent?: (pct: number | null) => void;
}

const PLAN_LABELS: Record<string, string> = { solo: "Solo", desk: "Desk", firm: "Firm" };

/** Usage-bar color tiers: calm under 70%, warn under 90%, hot above. */
function barColor(pct: number): { fill: string; ink: string; soft: string } {
  if (pct >= 90) return { fill: "var(--r500)", ink: "var(--r700)", soft: "var(--r50)" };
  if (pct >= 70) return { fill: "var(--y500)", ink: "var(--y700)", soft: "var(--y50)" };
  return { fill: "var(--g500)", ink: "var(--g700)", soft: "var(--g50)" };
}

const card: React.CSSProperties = {
  background: "var(--n0)",
  border: "1px solid var(--n30)",
  borderRadius: "var(--r-3)",
  padding: "var(--s-300)",
};

export function UsageView({ onUsagePercent }: Props) {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [topupError, setTopupError] = useState<string | null>(null);

  async function buyCredits(credits: number) {
    setBuying(credits);
    setTopupError(null);
    try {
      const res = await apiFetch("/api/v1/billing/topup", {
        method: "POST",
        body: JSON.stringify({ credits }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Could not start top-up.");
      }
      const json = await res.json();
      if (json.checkout_url) {
        window.location.href = json.checkout_url;
        return;
      }
      throw new Error("No checkout URL returned.");
    } catch (e) {
      setTopupError(e instanceof Error ? e.message : "Could not start top-up.");
      setBuying(null);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/billing/usage");
        if (!res.ok) throw new Error("Failed to load usage");
        const json: UsageSummary = await res.json();
        if (!alive) return;
        setData(json);
        onUsagePercent?.(json.memo.unlimited ? null : json.memo.percent);
      } catch {
        if (alive) setError("Could not load usage data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--n200)", padding: "40px 0" }}>
        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading usage…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "16px 18px", background: "var(--r50)",
        border: "1px solid var(--r100)", borderRadius: "var(--r-3)", color: "var(--r700)",
      }}>
        <AlertTriangle size={16} /> {error ?? "No usage data."}
      </div>
    );
  }

  const { memo, reports, watchlist } = data;
  const c = barColor(memo.percent);
  const renewal = data.current_period_end
    ? new Date(data.current_period_end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  const warnLevel = memo.warning?.level ?? "none";
  const warnMessage = memo.warning?.message ?? null;
  // Top-ups make sense only for paid, non-unlimited plans.
  const canTopUp = !memo.unlimited && data.plan_tier !== "solo";

  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: "var(--s-200)", maxWidth: 760 }}>
      {/* ── Usage warning banner ── */}
      {warnLevel !== "none" && warnMessage && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px", borderRadius: "var(--r-3)",
          background: warnLevel === "critical" ? "var(--r50)" : "var(--y50)",
          border: `1px solid ${warnLevel === "critical" ? "var(--r100)" : "var(--y100)"}`,
          color: warnLevel === "critical" ? "var(--r700)" : "var(--y700)",
          fontSize: 13, fontWeight: 600,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{warnMessage}</span>
        </div>
      )}

      {/* ── Memo usage ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Zap size={16} style={{ color: "var(--b500)" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--n900)" }}>Memo credits</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            padding: "3px 10px", borderRadius: 999,
            background: "var(--b50)", color: "var(--b700)", textTransform: "uppercase",
          }}>{PLAN_LABELS[data.plan_tier] ?? data.plan_tier} plan</span>
        </div>

        {memo.unlimited ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <InfinityIcon size={26} style={{ color: "var(--p500)" }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--n900)" }}>Unlimited</div>
              <div style={{ fontSize: 12.5, color: "var(--n200)" }}>{memo.used} memos generated this cycle</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "var(--n900)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {memo.used}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--n200)" }}>/ {memo.limit} used</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                {memo.percent}%
              </span>
            </div>
            <div style={{ height: 9, background: "var(--n20)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min(100, memo.percent)}%`,
                background: c.fill, borderRadius: 999,
                transition: "width 0.8s cubic-bezier(.2,.7,.3,1)",
              }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--n200)" }}>
              <strong style={{ color: "var(--n900)" }}>{memo.remaining}</strong> memo{memo.remaining === 1 ? "" : "s"} remaining
              {renewal && <> · renews {renewal}</>}
            </div>

            {canTopUp && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--n20)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--n900)", marginBottom: 9 }}>
                  Need more this cycle? Buy extra credits
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TOPUP_PACKS.map((n) => (
                    <button
                      key={n}
                      onClick={() => buyCredits(n)}
                      disabled={buying !== null}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: "var(--r-2)",
                        border: "1px solid var(--b100)", background: "var(--b50)",
                        color: "var(--b700)", fontSize: 12.5, fontWeight: 700,
                        cursor: buying !== null ? "default" : "pointer",
                        opacity: buying !== null && buying !== n ? 0.5 : 1,
                      }}
                    >
                      {buying === n
                        ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                        : <Plus size={13} />}
                      {n} memos
                    </button>
                  ))}
                </div>
                {topupError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--r700)" }}>{topupError}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Stat row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-200)" }}>
        <Stat icon={<FileText size={15} />} label="Reports this cycle" value={String(reports.this_cycle)} accent="var(--b500)" />
        <Stat icon={<FileText size={15} />} label="Reports all-time" value={String(reports.total)} accent="var(--t500)" />
        <Stat
          icon={<Eye size={15} />}
          label="Watchlist slots"
          value={watchlist.unlimited ? `${watchlist.used} / ∞` : `${watchlist.used} / ${watchlist.max}`}
          accent="var(--g500)"
        />
      </div>

      {renewal && (
        <div style={{ fontSize: 12, color: "var(--n100)", paddingLeft: 2 }}>
          Billing cycle ends {renewal}
          {data.subscription_status ? ` · subscription ${data.subscription_status}` : ""}.
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--n200)", letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--n900)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}
