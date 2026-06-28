import Link from "next/link";
import { IconArrow, IconCheck } from "../icons";

const TRUST_CHIPS = ["No credit card", "3 free runs", "SOC 2 Type II"];

export function CTA() {
  return (
    <section className="cta-strip" id="cta">
      <div className="container">
        <div className="cta-card">
          <span className="eyebrow">Ready to dispatch your first run?</span>
          <h2>The next time you need a memo,<br />don&apos;t write one.</h2>
          <p className="lead" style={{ maxWidth: 560, textAlign: "center" }}>
            Start with three free runs. No credit card. Memos arrive in your inbox in under three minutes.
          </p>
          <div style={{ display: "flex", gap: "var(--s-150)", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/login" className="btn btn-primary btn-lg">
              Start free <IconArrow />
            </Link>
            <a href="#" className="btn btn-outline btn-lg">Book a 20-min demo</a>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--s-200)",
            color: "var(--n200)", fontSize: "var(--fs-small)", marginTop: "var(--s-100)",
          }}>
            {TRUST_CHIPS.map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IconCheck size={12} /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
