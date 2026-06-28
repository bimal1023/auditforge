import type { Metadata } from "next";
import { ContentPage } from "../_landing/ContentPage";

export const metadata: Metadata = {
  title: "Security — Arthvion",
  description: "How Arthvion handles authentication, data, and access. An honest description of our current practices.",
};

export default function SecurityPage() {
  return (
    <ContentPage
      title="Security"
      subtitle="How we handle authentication, data, and access. We describe what we actually do — not certifications we don't yet hold."
    >
      <h2>Authentication</h2>
      <p>
        Accounts are protected with hashed passwords (never stored in plaintext) and
        token-based sessions. Sessions can be revoked, and tokens are invalidated on logout.
      </p>

      <h2>Data handling</h2>
      <ul>
        <li>Traffic is served over HTTPS/TLS in production.</li>
        <li>Reports and account data are scoped per user — your memos are visible only to your account.</li>
        <li>The data our agents source (SEC filings, market and litigation records) is public information; we don&rsquo;t resell or share your queries.</li>
        <li>Payment details are handled entirely by Stripe — we never see or store full card numbers.</li>
      </ul>

      <h2>Access control</h2>
      <p>
        Access to production systems is limited to the people who need it. We use third-party
        infrastructure providers for hosting, database, and payments, and rely on their
        underlying security controls in addition to our own.
      </p>

      <h2>Compliance &mdash; where we stand today</h2>
      <div className="lp-note">
        <p>
          We&rsquo;re an early-stage company and want to be straight with you: we do{" "}
          <strong>not</strong> currently hold a SOC 2 report, and we don&rsquo;t yet offer a
          signed Data Processing Agreement (DPA). Formal compliance is on our roadmap as we grow.
          If your organisation requires either before adopting Arthvion, reach out and
          let&rsquo;s talk about timing.
        </p>
      </div>

      <h2>Reporting a vulnerability</h2>
      <p>
        Found something? Please email{" "}
        <a href="mailto:bimalkumal2004@gmail.com?subject=Arthvion%20security%20report">
          bimalkumal2004@gmail.com
        </a>{" "}
        with the details and we&rsquo;ll respond as quickly as we can. We appreciate responsible
        disclosure.
      </p>
    </ContentPage>
  );
}
