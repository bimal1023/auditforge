import type { Metadata } from "next";
import { ContentPage } from "../_landing/ContentPage";

export const metadata: Metadata = {
  title: "Careers — Arthvion",
  description: "No open roles right now — but we're always glad to hear from exceptional people.",
};

export default function CareersPage() {
  return (
    <ContentPage
      title="Careers"
      subtitle="We're a small, early team building the diligence layer for serious investors."
    >
      <div className="lp-note">
        <p><strong>No open roles right now.</strong></p>
      </div>

      <h2>But we&rsquo;re always listening</h2>
      <p>
        We hire infrequently and deliberately. There aren&rsquo;t any posted openings at the
        moment, but we keep a standing list of exceptional engineers, analysts, and designers
        we&rsquo;d want to talk to the moment we do open a role.
      </p>
      <p>
        If you&rsquo;re excited about applied AI, financial research tooling, or building
        products that have to be <em>right</em> — send us a note and tell us what you&rsquo;d
        want to work on. Include anything that shows how you think: a project, a write-up, a
        repo, a memo you&rsquo;re proud of.
      </p>
      <p>
        <a href="mailto:bimalkumal2004@gmail.com?subject=Arthvion%20%E2%80%94%20talent%20pool">
          bimalkumal2004@gmail.com
        </a>
      </p>
    </ContentPage>
  );
}
