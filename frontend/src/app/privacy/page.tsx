import type { Metadata } from "next";
import { ContentPage } from "../_landing/ContentPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Arthvion",
  description: "What data Arthvion collects, how we use it, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Policy"
      subtitle="What we collect, why we collect it, and the choices you have."
      meta="Last updated: May 2026"
    >
      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — your name, email address, and password (stored only as a secure hash).</li>
        <li><strong>Usage data</strong> — the reports you generate, your queries, and basic product analytics needed to operate and improve the service.</li>
        <li><strong>Billing information</strong> — handled by our payment processor, Stripe. We receive a customer identifier and subscription status; we never receive or store full payment-card numbers.</li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To provide the service — running diligence reports and maintaining your account.</li>
        <li>To process payments and manage subscriptions.</li>
        <li>To improve reliability, performance, and the quality of output.</li>
        <li>To communicate with you about your account and service-related matters.</li>
      </ul>

      <h2>3. What we don&rsquo;t do</h2>
      <p>
        We don&rsquo;t sell your personal information. We don&rsquo;t share your queries or
        generated memos with other users. We don&rsquo;t use your private account data to train
        third-party models without your consent.
      </p>

      <h2>4. Service providers</h2>
      <p>
        We rely on trusted third parties to run the service — including hosting, database, and
        payment (Stripe) providers, and AI model providers that power the agents. These
        providers process data on our behalf under their own security and privacy commitments.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We keep your account and report data for as long as your account is active. You can
        delete reports from within the product, and you can request deletion of your account by
        contacting us.
      </p>

      <h2>6. Your choices</h2>
      <p>
        You can access, update, or delete your account information at any time. To request a
        copy of your data or full account deletion, email us at the address below.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be reflected by an
        updated date above.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions or requests about your data? Email{" "}
        <a href="mailto:bimalkumal2004@gmail.com">bimalkumal2004@gmail.com</a>.
      </p>

      <div className="lp-note">
        <p>
          This is a good-faith starting template, not legal advice. If you serve users in the
          EU/UK (GDPR) or California (CCPA/CPRA), have a qualified attorney review this policy
          and add the region-specific disclosures you&rsquo;re required to provide.
        </p>
      </div>
    </ContentPage>
  );
}
