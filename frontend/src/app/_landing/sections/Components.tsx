import {
  IconFinancial, IconRisk, IconMarket, IconLegal,
  IconSynthesis, IconLock, IconDoc, IconBolt, IconSearch,
  IconClock, IconPulse, IconEye,
} from "../icons";

const SPECIALIST_AGENTS = [
  {
    icon: <IconFinancial />, iconCls: "",
    title: "Financial",
    desc: "Pulls 10-K and 10-Q filings plus earnings-call commentary. Computes margin trajectory, segment trends, and cash-flow durability with every figure traced to source.",
    meta: "SEC EDGAR · 10-K / 10-Q · earnings calls",
  },
  {
    icon: <IconRisk />, iconCls: "comp-card-icon-amber",
    title: "Risk",
    desc: "Distils Item 1A and 8-K filings into material-risk vectors. Flags going-concern language, customer concentration, and supply-chain exposure.",
    meta: "Item 1A · 8-K · web-sourced",
  },
  {
    icon: <IconMarket />, iconCls: "comp-card-icon-green",
    title: "Market",
    desc: "Sizes the market and maps share against named competitors, threading public reports and signals into a single competitive view.",
    meta: "Web research · competitive sizing",
  },
  {
    icon: <IconLegal />, iconCls: "comp-card-icon-teal",
    title: "Legal & Regulatory",
    desc: "Reviews SEC disclosures and public records for litigation, regulatory actions, and IP exposure — surfacing matters likely to move the thesis.",
    meta: "Litigation · regulatory · IP · web-sourced",
  },
  {
    icon: <IconSynthesis />, iconCls: "comp-card-icon-purple",
    title: "Synthesis",
    desc: "Reconciles the four specialist outputs into a single ranked memo. Resolves conflicting evidence, scores conviction, and outputs the final 0–10.",
    meta: "Reasoning · cross-check · 0–10 conviction",
  },
  {
    icon: <IconLock />, iconCls: "comp-card-icon-red",
    title: "Private corpus",
    desc: "Run the same agents against your own documents. Upload data rooms, fund memos, and filings — agents cite them alongside public sources, scoped to your workspace.",
    meta: "Uploaded docs · tenant-isolated · RAG",
  },
];

const SURFACES = [
  {
    icon: <IconDoc />, iconCls: "", title: "Investment memo",
    desc: "The default output: a sourced memo with thesis, financials, risks, and a 0–10 conviction score. Every claim hyperlinked to source — exportable to PDF.",
  },
  {
    icon: <IconBolt />, iconCls: "comp-card-icon-amber", title: "Comps engine",
    desc: "Pull a public-company peer set and get trading multiples — P/E, EV/EBITDA, EV/Revenue — with implied valuation computed in code, not guessed by the model.",
  },
  {
    icon: <IconSearch />, iconCls: "comp-card-icon-green", title: "Screener",
    desc: "Filter the public universe by sector, size, growth, and margin to build a target list, then send any name straight into a full memo run.",
  },
  {
    icon: <IconClock />, iconCls: "comp-card-icon-purple", title: "Earnings tracker",
    desc: "Track quarterly results and call highlights for the companies you follow — surprises, guidance changes, and segment moves in one place.",
  },
  {
    icon: <IconPulse />, iconCls: "comp-card-icon-teal", title: "Watchlist & alerts",
    desc: "Re-scan any company on a schedule. Get flagged when a material change in filings, litigation, or news moves the picture.",
  },
  {
    icon: <IconEye />, iconCls: "comp-card-icon-red", title: "Deal Room Q&A",
    desc: "Ask plain-language questions across your uploaded documents and public filings — answers come back cited to the exact source passage.",
  },
];

export function Components() {
  return (
    <section className="section" id="components">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">What&apos;s inside</span>
          <h2>Every piece of an analyst&apos;s stack, reusable.</h2>
          <p className="lead">
            Arthvion ships as a set of composable agents and surfaces. Combine them into the
            workflow you already run — or use the full investment-memo template as-is.
          </p>
        </div>

        {/* Specialist agents */}
        <div className="comp-group">
          <h3>Specialist agents</h3>
          <div className="comp-grid">
            {SPECIALIST_AGENTS.map((c) => (
              <div className="comp-card" key={c.title}>
                <div className="comp-card-head">
                  <span className={`comp-card-icon ${c.iconCls}`}>{c.icon}</span>
                  <div>
                    <h4>{c.title}</h4>
                  </div>
                </div>
                <p>{c.desc}</p>
                <div className="comp-card-meta">{c.meta}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Surfaces */}
        <div className="comp-group" style={{ marginTop: "var(--s-800)" }}>
          <h3>Surfaces</h3>
          <div className="comp-grid">
            {SURFACES.map((c) => (
              <div className="comp-card" key={c.title}>
                <div className="comp-card-head">
                  <span className={`comp-card-icon ${c.iconCls}`}>{c.icon}</span>
                  <div><h4>{c.title}</h4></div>
                </div>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
