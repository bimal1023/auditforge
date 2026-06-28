import {
  IconArrow, IconCheck, IconChevronRight, IconEye,
  IconFinancial, IconLegal, IconMarket, IconRisk,
} from "../icons";

const HERO_META = [
  { num: "2:47",  label: "Median run time" },
  { num: "38",    label: "Avg. citations per memo" },
  { num: "94%",   label: "Analyst-grade pass rate" },
  { num: "SOC 2", label: "Type II · tenant-isolated" },
];

const VIZ_AGENTS = [
  { icon: <IconFinancial size={12} />, name: "Financial" },
  { icon: <IconRisk size={12} />,      name: "Risk" },
  { icon: <IconMarket size={12} />,    name: "Market" },
  { icon: <IconLegal size={12} />,     name: "Legal" },
];

const LOGO_ROW = [
  "Northbridge Capital", "Sequoia Heritage", "Generation IM",
  "Glenview & Co.", "Atlas Pacific", "Carlyle MAS",
];

export function Hero() {
  return (
    <header className="hero">
      <div className="container">
        <div className="hero-grid">

          {/* ── Left: copy ── */}
          <div>
            <span className="hero-eyebrow">
              <span className="lozenge lozenge-bold-inprog">New</span>
              v4 — agent orchestration is live
              <span style={{ marginLeft: 4, color: "var(--n100)", display: "inline-flex" }}>
                <IconChevronRight />
              </span>
            </span>

            <h1>
              Institutional diligence,<br />
              <span className="accent">on demand.</span>
            </h1>

            <p className="lead">
              Four specialist agents pull SEC filings, market intelligence, and litigation records
              in parallel — then synthesise a single sourced memo. The work that used to take a junior
              analyst two days finishes in about three minutes.
            </p>

            <div className="hero-actions">
              <a href="#cta" className="btn btn-primary btn-lg">
                Start free <IconArrow />
              </a>
              <a href="#output" className="btn btn-outline btn-lg">
                <IconEye /> See a live memo
              </a>
            </div>

            <div className="hero-meta">
              {HERO_META.map((m) => (
                <div className="hero-meta-item" key={m.label}>
                  <span className="hero-meta-num tnum">{m.num}</span>
                  <span className="hero-meta-label">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: live report mockup ── */}
          <div style={{ position: "relative" }}>
            <div className="viz-card">
              <div className="viz-head">
                <div className="viz-head-dots"><span /><span /><span /></div>
                <div className="viz-tabs">
                  <span className="viz-tab active">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                    AAPL · Memo
                  </span>
                  <span className="viz-tab">NVDA</span>
                  <span className="viz-tab">+ New</span>
                </div>
              </div>

              <div className="viz-body">
                <div className="viz-score-row">
                  <div className="viz-score"><span className="viz-score-num tnum">7.4</span></div>
                  <div className="viz-score-info">
                    <h4>Apple Inc.</h4>
                    <div className="row">
                      <span className="ticker">AAPL</span>
                      <span className="lozenge lozenge-success">Buy</span>
                      <span style={{ fontSize: 12, color: "var(--n200)" }}>· generated 2m 47s ago</span>
                    </div>
                  </div>
                </div>

                <div className="viz-agents">
                  {VIZ_AGENTS.map((a) => (
                    <div className="viz-agent" key={a.name}>
                      <span className="viz-agent-icon">{a.icon}</span>
                      <span className="viz-agent-name">{a.name}</span>
                      <span className="viz-agent-bar"><span style={{ width: "100%" }} /></span>
                    </div>
                  ))}
                </div>

                <div className="viz-finding">
                  <b>Services moat continues to compound:</b> revenue up 16% YoY to $24.2B,
                  now 28% of total revenue<sup>3</sup>. Gross margin expanded 280 bps<sup>4</sup>,
                  offsetting iPhone unit softness in Greater China<sup>11</sup>.
                </div>
              </div>
            </div>

            <div className="viz-float viz-float-1">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--g500)", display: "inline-block" }} />
              <b style={{ color: "var(--n900)", fontWeight: 600 }}>All 4 agents complete</b>
            </div>
            <div className="viz-float viz-float-2">
              <span style={{ color: "var(--b500)", display: "inline-flex" }}><IconCheck size={13} /></span>
              <span><b style={{ color: "var(--n900)", fontWeight: 600 }}>38 citations</b> · all traceable</span>
            </div>
          </div>
        </div>

        {/* Logo row */}
        <div className="logo-row">
          <span className="logo-row-label">Trusted by analysts at</span>
          {LOGO_ROW.map((l) => <span className="logo-mark" key={l}>{l}</span>)}
        </div>
      </div>
    </header>
  );
}
