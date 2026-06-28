"use client";

import { useState } from "react";
import { Search, History, HelpCircle, Zap, Lock } from "lucide-react";
import { Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/auth";
import type { ReportRequest } from "@/lib/types";
import type { AgentKey, NewReportInitial } from "../types";
import { AGENT_DEFS, RECENTS } from "../constants";

interface NewReportFormProps {
  onSubmit: (req: ReportRequest) => void;
  loading: boolean;
  /** `null` while credits are loading; render a neutral banner in that case. */
  credits: number | null;
  planTier: string;
  initialValues?: NewReportInitial;
  /** Jump to the Memos tab (past report history). */
  onShowHistory?: () => void;
}

const DOCS_URL = "/docs";

/** Kick off a Stripe Checkout session and redirect the browser to it. */
async function startUpgrade() {
  try {
    const res = await apiFetch("/api/v1/billing/checkout", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.checkout_url) {
      alert(data.detail ?? "Could not start checkout. Try again in a moment.");
      return;
    }
    window.location.href = data.checkout_url;
  } catch {
    alert("Network error — try again in a moment.");
  }
}

export function NewReportForm({
  onSubmit, loading, credits, planTier, initialValues, onShowHistory,
}: NewReportFormProps) {
  // Treat `null` (still loading) as "not blocked" so the form isn't initially
  // disabled on every page load while the /me request is in flight.
  const outOfCredits = credits !== null && credits <= 0;
  const [company, setCompany] = useState(initialValues?.company_name ?? "");
  const [ticker, setTicker]   = useState(initialValues?.ticker ?? "");
  const [context, setContext] = useState(initialValues?.context ?? "");
  const [areas, setAreas]     = useState<AgentKey[]>(
    (initialValues?.focus_areas as AgentKey[] | undefined) ?? ["financial", "risk", "market", "legal"],
  );
  const [companyFocused, setCompanyFocused] = useState(false);

  function toggle(k: AgentKey) {
    setAreas((a) => a.includes(k) ? a.filter((x) => x !== k) : [...a, k]);
  }
  function pickRecent(r: { name: string; ticker: string }) {
    setCompany(r.name);
    setTicker(r.ticker === "PRIV" ? "" : r.ticker);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || areas.length === 0 || loading || outOfCredits) return;
    onSubmit({
      company_name: company.trim(),
      ticker: ticker.trim() || undefined,
      focus_areas: areas,
      context: context.trim() || undefined,
    });
  }

  const ready = !!company.trim() && areas.length > 0 && !loading && !outOfCredits;
  const totalETA = AGENT_DEFS
    .filter((d) => areas.includes(d.key))
    .reduce((sum, d) => sum + parseInt(d.eta.replace(/\D/g, "")), 0);

  return (
    <form onSubmit={handleSubmit} className="slide-up">
      {/* Page head */}
      <div className="page-head">
        <div className="page-head-text">
          <div className="page-head-title">
            <h1>New report</h1>
            <span className="status-chip draft">Draft</span>
          </div>
          <p className="page-head-sub">
            Brief the agent stack. Four specialists pull SEC, market, and litigation data in parallel and synthesise a sourced memo.
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn-secondary" onClick={onShowHistory}>
            <History size={13} /> History
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.open(DOCS_URL, "_blank", "noopener,noreferrer")}
          >
            <HelpCircle size={13} /> Help
          </button>
        </div>
      </div>

      {/* Info banner — switches to a red "out of credits" state when balance hits 0 */}
      {outOfCredits ? (
        <div className="banner" style={{
          background: "var(--r50)",
          borderColor: "var(--r100)",
          borderLeftColor: "var(--r500)",
        }}>
          <div className="banner-icon" style={{ background: "var(--r500)" }}>
            <Lock size={11} />
          </div>
          <div className="banner-text">
            <strong>You&rsquo;re out of memo credits.</strong>{" "}
            Upgrade to <button type="button" onClick={startUpgrade} style={upgradeLinkStyle}>Desk</button> for 50 memos / month, or contact your admin to top up.
          </div>
        </div>
      ) : (
        <div className="banner">
          <div className="banner-icon">i</div>
          <div className="banner-text">
            {credits === null ? (
              <>Loading your plan&hellip;</>
            ) : (
              <>
                You have <strong>{credits} memo credit{credits === 1 ? "" : "s"}</strong>{" "}
                remaining on your <strong>{planTier.charAt(0).toUpperCase() + planTier.slice(1)}</strong> plan.{" "}
                {planTier === "solo" && (
                  <>
                    <button type="button" onClick={startUpgrade} style={upgradeLinkStyle}>
                      Upgrade to Desk
                    </button> for 50 memos / month.
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Form card */}
      <div className="card">
        <div className="card-pad">
          {/* Subject company */}
          <label className="field-label">Subject company<span className="req">*</span></label>
          <div className={`input-row${companyFocused ? " focused" : ""}`}>
            <span className="input-icon"><Search size={16} /></span>
            <input
              className="company"
              placeholder="Apple Inc."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onFocus={() => setCompanyFocused(true)}
              onBlur={() => setCompanyFocused(false)}
              autoComplete="off"
            />
            <div className="ticker-display">
              <span className="ticker-label">TICKER</span>
              <input
                className="ticker-input"
                placeholder="AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
          </div>
          <div className="field-help">Public ticker, name, or private company.</div>

          {/* Recent */}
          <div className="recent-row">
            <span className="recent-label">Recent:</span>
            {RECENTS.map((r) => (
              <button
                key={r.name} type="button" className="recent-chip"
                onClick={() => pickRecent(r)}
              >
                {r.name} <span className="tick">{r.ticker}</span>
              </button>
            ))}
          </div>

          {/* Analysis scope */}
          <div style={{ marginTop: 28 }}>
            <div className="scope-head">
              <label className="field-label" style={{ marginBottom: 0 }}>Analysis scope</label>
            </div>
            <div className="scope-list">
              {AGENT_DEFS.map(({ key, label, icon: Icon, tone, blurb, sources, eta }) => {
                const on = areas.includes(key);
                return (
                  <button
                    key={key} type="button"
                    onClick={() => toggle(key)}
                    className={`agent-row${on ? " on" : ""}`}
                  >
                    <span className="check">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6 L5 8.5 L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className={`agent-icon ${tone}`}><Icon size={15} /></span>
                    <div className="agent-body">
                      <div className="agent-title">
                        <span className="agent-name">{label}</span>
                        <span className={`agent-badge${on ? "" : " off"}`}>{on ? "Active" : "Skipped"}</span>
                      </div>
                      <div className="agent-desc">
                        {blurb}
                        {sources.map((s) => (
                          <span key={s} className="src-chip">{s}</span>
                        ))}
                      </div>
                    </div>
                    <span className="agent-eta">{eta}</span>
                  </button>
                );
              })}
            </div>
            <div className="scope-foot">
              <span className="scope-count">
                {areas.length} of {AGENT_DEFS.length} specialist agents selected
              </span>
            </div>
          </div>
        </div>

        {/* Optional context */}
        <div className="context-wrap">
          <label className="field-label">
            Additional context <span style={{ color: "var(--n200)", fontWeight: 400 }}>· optional</span>
          </label>
          <textarea
            className="context-area"
            placeholder="e.g. Evaluating for acquisition at ~8x EBITDA. Focus on recurring revenue quality and customer concentration."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {/* Submit — out of credits → upgrade CTA instead of disabled submit */}
        <div className="card-foot">
          {outOfCredits ? (
            <button type="button" className="btn-primary" onClick={startUpgrade}>
              <Lock size={14} /> Upgrade to continue
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={!ready}>
              {loading
                ? <><Spinner size={14} color="#fff" /> Dispatching…</>
                : <><Zap size={15} /> Generate report</>}
            </button>
          )}
          <div className="foot-meta">
            <span className="est">≈ {Math.round(totalETA / 60 * 10) / 10}m total</span>
            <span>·</span>
            <span>{areas.length} agent{areas.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Inline-link styling for upgrade buttons inside body copy — looks like an
 * <a> but is actually a button so it can call the checkout handler. */
const upgradeLinkStyle: React.CSSProperties = {
  background: "none", border: "none", padding: 0,
  color: "var(--b500)", fontWeight: 600, cursor: "pointer",
  font: "inherit", textDecoration: "underline", textUnderlineOffset: 2,
};
