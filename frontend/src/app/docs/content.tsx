/**
 * Documentation content for /docs. Static, accurate to what is actually shipped:
 * four parallel specialist agents, the analyst surfaces, a private document
 * corpus (RAG), and PDF + JSON export. No claims for features that don't exist
 * yet (slide-deck export, public API, webhooks, reviewer redlines).
 */

export const DOCS_NAV: { title: string; items: { id: string; label: string }[] }[] = [
  {
    title: "Getting started",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "The diligence memo",
    items: [
      { id: "memo", label: "How a memo works" },
      { id: "agents", label: "Specialist agents" },
      { id: "conviction", label: "Conviction & citations" },
    ],
  },
  {
    title: "Analyst surfaces",
    items: [
      { id: "comps", label: "Comps" },
      { id: "screener", label: "Screener" },
      { id: "earnings", label: "Earnings" },
      { id: "watchlist", label: "Watchlist & alerts" },
      { id: "pipeline", label: "Pipeline & actions" },
      { id: "qa", label: "Deal Room Q&A" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { id: "documents", label: "Documents & corpus" },
      { id: "exports", label: "Exports" },
      { id: "team", label: "Team & roles" },
      { id: "plans", label: "Plans & credits" },
    ],
  },
  {
    title: "Help",
    items: [{ id: "faq", label: "FAQ" }],
  },
];

function Tags({ items }: { items: string[] }) {
  return (
    <div className="docs-tags">
      {items.map((t) => (
        <span className="docs-tag" key={t}>{t}</span>
      ))}
    </div>
  );
}

export function DocsContent() {
  return (
    <>
      <section className="docs-sec" id="introduction">
        <h2>Introduction</h2>
        <p>
          <strong>Arthvion</strong> is a multi-agent due-diligence workspace. You brief it once
          on a company; four specialist agents fan out across public filings, market intelligence, and
          litigation records in parallel, and a synthesis pass reconciles their findings into a single,
          sourced investment memo with a 0&ndash;10 conviction score.
        </p>
        <p>
          Around the memo sit a set of analyst surfaces &mdash; comparables, a screener, earnings tracking,
          a monitored watchlist, a deal pipeline, and a question-answering layer over your own documents.
          Everything is scoped to your workspace and every figure in a memo is traced to its source.
        </p>
        <div className="docs-note">
          <span>ℹ️</span>
          <div>
            Arthvion is decision-support, not investment advice. Outputs are sourced and cross-checked,
            but you should verify material claims against the underlying filings before acting on them.
          </div>
        </div>
      </section>

      <section className="docs-sec" id="quickstart">
        <h2>Quickstart &mdash; your first memo</h2>
        <ol className="docs-steps">
          <li>
            From the dashboard, open <strong>New report</strong> (or press <span className="docs-kbd">N</span>).
          </li>
          <li>
            Enter a <strong>subject company</strong> &mdash; a public ticker, a company name, or a private
            company. Add the ticker on the right if you know it; it sharpens the filings lookup.
          </li>
          <li>
            Pick your <strong>analysis scope</strong>. All four agents (Financial, Risk, Market, Legal) are
            on by default &mdash; toggle off any you don&rsquo;t need to save time and credits.
          </li>
          <li>
            Optionally add a <strong>thesis or context note</strong> to steer the agents toward what you care
            about (e.g. &ldquo;focus on services-margin durability&rdquo;).
          </li>
          <li>
            Submit. The run streams live as the agents work; when synthesis finishes, the memo opens
            automatically. Read it, switch section tabs, and <strong>export</strong> or discuss with your team.
          </li>
        </ol>
        <div className="docs-note">
          <span>⌘</span>
          <div>Press <span className="docs-kbd">⌘K</span> anywhere to jump to a company, memo, or surface.</div>
        </div>
      </section>

      <section className="docs-sec" id="memo">
        <h2>How a memo works</h2>
        <p>
          A run is orchestrated by a lead agent that dispatches the four specialists <strong>in
          parallel</strong>. Each specialist connects to its own data sources, does its own tool calls,
          and returns a structured section. A final synthesis pass reconciles conflicting evidence across
          the four, writes the executive summary, and assigns the conviction score.
        </p>
        <p>The memo is organised into tabbed sections:</p>
        <ul>
          <li><strong>Financial</strong> &mdash; revenue, margins, segments, cash-flow durability.</li>
          <li><strong>Risk</strong> &mdash; material-risk register grouped by severity.</li>
          <li><strong>Market</strong> &mdash; TAM, share, competitive map, demand signals.</li>
          <li><strong>Legal</strong> &mdash; litigation, regulatory, and IP exposure.</li>
          <li><strong>Action Queue</strong> &mdash; auto-generated next-step diligence tasks.</li>
          <li><strong>Discussion</strong> &mdash; threaded comments for your team.</li>
        </ul>
        <p>
          Sections that don&rsquo;t come back with enough sourced data are discarded rather than padded &mdash;
          a thin or missing section means the agent couldn&rsquo;t substantiate it, not that it&rsquo;s hidden.
        </p>
      </section>

      <section className="docs-sec" id="agents">
        <h2>Specialist agents</h2>
        <table className="docs-table">
          <thead>
            <tr><th>Agent</th><th>What it does</th><th>Sources</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Financial</td>
              <td>Pulls 10-K / 10-Q filings and earnings-call commentary; computes margin trajectory, segment trends, and cash-flow durability.</td>
              <td>SEC EDGAR, web</td>
            </tr>
            <tr>
              <td>Risk</td>
              <td>Distils Item&nbsp;1A and 8-K filings into material-risk vectors; flags going-concern language, customer concentration, and supply-chain exposure.</td>
              <td>SEC EDGAR, web</td>
            </tr>
            <tr>
              <td>Market</td>
              <td>Sizes the market and maps share against named competitors using public reports and signals.</td>
              <td>Web research</td>
            </tr>
            <tr>
              <td>Legal &amp; Regulatory</td>
              <td>Reviews SEC disclosures and public records for litigation, regulatory actions, and IP exposure likely to move the thesis.</td>
              <td>SEC EDGAR, web</td>
            </tr>
            <tr>
              <td>Synthesis</td>
              <td>Reconciles the four outputs into one ranked memo, resolves conflicting evidence, and scores conviction 0&ndash;10.</td>
              <td>Reasoning</td>
            </tr>
          </tbody>
        </table>
        <p>
          When your workspace has uploaded documents, every specialist can also cite those alongside its
          public sources &mdash; see <a href="#documents">Documents &amp; corpus</a>.
        </p>
      </section>

      <section className="docs-sec" id="conviction">
        <h2>Conviction &amp; citations</h2>
        <p>
          The headline <strong>0&ndash;10 conviction score</strong> is the synthesis agent&rsquo;s calibrated
          output, not an average of the sections. Each section also carries its own confidence value, so you
          can see where the evidence is strong and where it&rsquo;s thin.
        </p>
        <p>
          Every quantitative claim is <strong>traced to a citation</strong>. The citation count is shown on
          the report header, and findings are cross-checked against the strongest opposing source before they
          land in the memo. Monetary figures are stored as raw numbers, so exports stay machine-readable.
        </p>
      </section>

      <section className="docs-sec" id="comps">
        <h2>Comps</h2>
        <Tags items={["Public companies", "FMP data"]} />
        <p>
          Pull a public-company peer set and get trading multiples &mdash; P/E, EV/EBITDA, and EV/Revenue &mdash;
          with an implied valuation for the target. The multiples and the implied valuation are
          <strong> computed deterministically in code</strong> (median-of-peers), not generated by the model,
          so the math is reproducible. The model only writes the surrounding narrative.
        </p>
        <div className="docs-note warn">
          <span>⚠️</span>
          <div>Comps require public peer data. Companies without filings (or with negative/again-not-meaningful metrics) will show &ldquo;Not meaningful&rdquo; for the affected method rather than a bogus number.</div>
        </div>
      </section>

      <section className="docs-sec" id="screener">
        <h2>Screener</h2>
        <p>
          Filter the public universe by sector, size, growth, and margin to build a target list. Any name you
          surface can be sent straight into a full memo run, so screening and diligence stay in one place.
        </p>
      </section>

      <section className="docs-sec" id="earnings">
        <h2>Earnings</h2>
        <p>
          Track quarterly results and call highlights for the companies you follow &mdash; surprises, guidance
          changes, and segment moves &mdash; without opening each filing yourself.
        </p>
      </section>

      <section className="docs-sec" id="watchlist">
        <h2>Watchlist &amp; alerts</h2>
        <p>
          Add a company to your <strong>watchlist</strong> and Arthvion re-scans it on a schedule. When a
          material change appears in filings, litigation, or news &mdash; an earnings surprise, an M&amp;A
          event, new litigation, an executive departure &mdash; you get a notification, surfaced in the
          <strong> Live monitor</strong>. Re-running diligence on a flagged name is one click.
        </p>
      </section>

      <section className="docs-sec" id="pipeline">
        <h2>Pipeline &amp; actions</h2>
        <p>
          The <strong>Pipeline</strong> tracks deals through stages so your team shares one view of what&rsquo;s
          in flight. For deals, Arthvion auto-generates an <strong>Action Queue</strong> &mdash; concrete
          next-step diligence tasks derived from the memo&rsquo;s findings &mdash; so the memo turns into work
          rather than just a document.
        </p>
      </section>

      <section className="docs-sec" id="qa">
        <h2>Deal Room Q&amp;A</h2>
        <p>
          Ask plain-language questions across your uploaded documents and public filings. Answers come back
          <strong> cited to the exact source passage</strong>, so you can jump straight to the evidence. This
          is the fastest way to interrogate a data room without reading it end to end.
        </p>
      </section>

      <section className="docs-sec" id="documents">
        <h2>Documents &amp; private corpus</h2>
        <Tags items={["PDF", "Word .docx", "Excel .xlsx", "PowerPoint .pptx", "CSV", "Text"]} />
        <p>
          Upload your own documents &mdash; data rooms, fund memos, CIMs, filings &mdash; from the
          <strong> Knowledge base</strong>. They&rsquo;re indexed into a private corpus that the agents can
          retrieve from and <strong>cite alongside public sources</strong> during a run.
        </p>
        <p>
          The corpus is <strong>tenant-isolated</strong>: retrieval is scoped to your workspace server-side,
          so one workspace can never see another&rsquo;s documents. File type is detected from the file&rsquo;s
          actual contents, not its name or headers.
        </p>
        <div className="docs-note">
          <span>ℹ️</span>
          <div>Document indexing is best-effort and additive. If an upload can&rsquo;t be indexed it still
          saves, and a memo run always falls back to public sources &mdash; uploads can never break core analysis.</div>
        </div>
      </section>

      <section className="docs-sec" id="exports">
        <h2>Exports</h2>
        <p>A completed memo can be taken out of the app two ways:</p>
        <ul>
          <li><strong>PDF</strong> &mdash; the <em>Print Report</em> view renders the full memo for print or save-as-PDF.</li>
          <li><strong>JSON</strong> &mdash; the <em>Export JSON</em> button downloads the typed report payload (every section, figure, and citation) for downstream tooling such as a CRM or data warehouse.</li>
        </ul>
        <div className="docs-note">
          <span>ℹ️</span>
          <div>PDF and JSON are the export formats available today. Slide-deck and document (.docx) export are not yet available.</div>
        </div>
      </section>

      <section className="docs-sec" id="team">
        <h2>Team &amp; roles</h2>
        <p>
          Your account belongs to a <strong>workspace</strong> &mdash; the unit that owns memos, documents,
          and billing. Members have one of two roles:
        </p>
        <ul>
          <li><strong>Admin</strong> &mdash; can invite/remove members, rename the organisation, and manage billing.</li>
          <li><strong>Analyst</strong> &mdash; can run memos and use every surface, but not change org-level settings.</li>
        </ul>
        <p>
          Admins can set the <strong>firm / company name</strong> in <strong>Settings &rarr; Organization</strong>;
          it appears in the sidebar and on exported reports. You can also set this optionally at sign-up.
        </p>
      </section>

      <section className="docs-sec" id="plans">
        <h2>Plans &amp; credits</h2>
        <table className="docs-table">
          <thead>
            <tr><th>Plan</th><th>Price</th><th>Memos</th></tr>
          </thead>
          <tbody>
            <tr><td>Solo</td><td>Free</td><td>3 / month</td></tr>
            <tr><td>Desk</td><td>$399 / month</td><td>50 / month, plus Comps, Screener &amp; Earnings</td></tr>
            <tr><td>Firm</td><td>Custom</td><td>Everything in Desk + private corpus, SSO, dedicated tenancy</td></tr>
          </tbody>
        </table>
        <p>
          Each memo run consumes one <strong>memo credit</strong>; your remaining balance is shown on the New
          report screen and on the <strong>Usage</strong> tab. Upgrades and top-ups are handled in
          <strong> Settings &rarr; Billing</strong>.
        </p>
      </section>

      <section className="docs-sec" id="faq">
        <h2>FAQ</h2>
        <h3>Is this investment advice?</h3>
        <p>No. Arthvion is decision-support. It sources and cross-checks its claims, but you should verify material figures against the underlying filings before acting.</p>

        <h3>How fresh is the data?</h3>
        <p>SEC content reflects filings as published; market and news content is gathered at run time. To pick up changes, re-run the memo or add the company to your watchlist for scheduled monitoring.</p>

        <h3>Can I analyse a private company?</h3>
        <p>Yes, by name &mdash; though coverage is thinner without public filings. Upload a data room or other documents to enrich the analysis with your own sources.</p>

        <h3>Why did a section come back empty or low-confidence?</h3>
        <p>The agent couldn&rsquo;t substantiate it from available sources. Arthvion discards unsupported sections rather than fabricating content, so a gap is an honest signal.</p>

        <h3>Where does my data live?</h3>
        <p>Everything is scoped to your workspace, and uploaded documents are tenant-isolated so they&rsquo;re never visible to other workspaces.</p>

        <h3>Need a hand?</h3>
        <p>Use <strong>Help &rarr; Contact support</strong> in the app, or email <a href="mailto:support@arthvion.com">support@arthvion.com</a>.</p>
      </section>
    </>
  );
}
