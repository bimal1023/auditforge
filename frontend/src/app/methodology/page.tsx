import type { Metadata } from "next";
import { ContentPage } from "../_landing/ContentPage";

export const metadata: Metadata = {
  title: "Methodology — Arthvion",
  description: "How Arthvion generates a sourced due-diligence memo: a multi-agent pipeline with citation enforcement and validation hooks.",
};

export default function MethodologyPage() {
  return (
    <ContentPage
      title="Methodology"
      subtitle="How a company name becomes a sourced, investment-grade memo — and why you can trust the output."
    >
      <h2>The pipeline</h2>
      <p>
        A request kicks off an orchestrator that delegates to four specialist agents, each
        connected to dedicated data sources via the Model Context Protocol (MCP). They run
        independently, then their findings are synthesised into a single memo with an executive
        summary and an overall score.
      </p>
      <ul>
        <li><strong>Financial</strong> — pulls and normalises figures from SEC EDGAR filings (revenue, margins, balance-sheet items).</li>
        <li><strong>Risk</strong> — surfaces disclosed risk factors and material events from filings and recent news.</li>
        <li><strong>Market</strong> — estimates TAM, competitive position, and momentum from market intelligence.</li>
        <li><strong>Legal</strong> — searches litigation and regulatory records for active and historical matters.</li>
      </ul>

      <h2>Citations are not optional</h2>
      <p>
        Every section of the memo is required to carry a non-empty list of citations. This is
        enforced in two places: the data model itself rejects a section with no sources, and a
        dedicated validation hook checks the output before it is accepted. If an agent
        can&rsquo;t source a claim, the claim doesn&rsquo;t make it into the memo.
      </p>

      <h2>Guardrails</h2>
      <p>
        Each agent call passes through a lifecycle of hooks — input normalisation, policy
        enforcement, audit logging, and output validation. Tool calls are logged, runaway loops
        are capped, and every agent has a hard timeout. Low-confidence results are discarded
        before synthesis rather than padded into the final memo.
      </p>

      <h2>What it is — and isn&rsquo;t</h2>
      <div className="lp-note">
        <p>
          Arthvion is a research product, not investment advice. The memo is a fast, sourced
          first pass designed to accelerate an analyst&rsquo;s judgement — not replace it. Always
          verify material figures against the linked primary sources before acting on them.
        </p>
      </div>
    </ContentPage>
  );
}
