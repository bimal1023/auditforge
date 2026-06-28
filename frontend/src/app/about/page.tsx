import type { Metadata } from "next";
import { ContentPage } from "../_landing/ContentPage";

export const metadata: Metadata = {
  title: "About — Arthvion",
  description: "Why we built Arthvion: institutional-grade diligence, on demand, with the receipts to prove every claim.",
};

export default function AboutPage() {
  return (
    <ContentPage
      title="About Arthvion"
      subtitle="Institutional diligence, on demand — built for analysts who need to be right, with the receipts to prove it."
    >
      <h2>What we do</h2>
      <p>
        Arthvion turns a company name into an investment-grade due-diligence memo in minutes.
        A stack of specialist AI agents works in parallel — pulling SEC filings, market
        intelligence, and litigation records — then synthesises the findings into a single
        sourced memo. Every claim links back to a primary source, so the work stands up to
        scrutiny instead of asking you to take it on faith.
      </p>

      <h2>Why we built it</h2>
      <p>
        Diligence is slow, expensive, and uneven. A junior analyst can spend days assembling
        what amounts to a literature review before the real thinking begins. We think that
        first pass — the gathering, the cross-referencing, the citation hunting — should take
        minutes, not days, and should never cut corners on sourcing. Arthvion does the legwork
        so the analyst can spend their time on judgement.
      </p>

      <h2>How we think about the work</h2>
      <ul>
        <li><strong>Sourced or it didn&rsquo;t happen.</strong> Every figure and claim carries a citation. No citation, no claim.</li>
        <li><strong>Speed without shortcuts.</strong> Parallel agents make it fast; the hook and validation pipeline keeps it honest.</li>
        <li><strong>A tool, not an oracle.</strong> Arthvion is a research product, not investment advice. The analyst stays in the loop and owns the decision.</li>
      </ul>

      <h2>Where we&rsquo;re headed</h2>
      <p>
        We&rsquo;re an early-stage company building toward the diligence layer for serious
        investors — watchlist monitoring, drift alerts, and a private corpus that learns your
        desk&rsquo;s house view. If that&rsquo;s a problem you live with,{" "}
        <a href="mailto:bimalkumal2004@gmail.com">we&rsquo;d love to hear from you</a>.
      </p>
    </ContentPage>
  );
}
