"use client";

import Link from "next/link";
import { IconCheck } from "../icons";
import { getToken } from "@/lib/auth";

/** What happens when a pricing CTA is clicked. */
type CtaAction =
  /** Plain navigation — internal route or external URL (mailto:, https://). */
  | { kind: "link"; href: string }
  /** Start a paid subscription via Stripe Checkout. Logged-out users get
   *  bounced to /login first; logged-in users are redirected to Stripe. */
  | { kind: "checkout" };

interface Tier {
  name: string;
  badge: { label: string; className: string };
  price: { num: string; unit?: string };
  desc: string;
  features: string[];
  cta: { label: string; className: string; action: CtaAction };
  featured?: boolean;
}

/** Single source of truth for the sales contact. Update here if it ever changes. */
const SALES_EMAIL = "bimal@stellanetconnect.com";
const SALES_MAILTO =
  `mailto:${SALES_EMAIL}` +
  `?subject=${encodeURIComponent("Arthvion — Firm plan inquiry")}` +
  `&body=${encodeURIComponent(
    "Hi Bimal,\n\n" +
    "We'd like to talk about the Firm plan for our team. " +
    "A bit about us:\n\n" +
    "• Firm name:\n" +
    "• Team size:\n" +
    "• Typical memo volume:\n" +
    "• Anything specific we should know:\n\n" +
    "Thanks,\n"
  )}`;

const TIERS: Tier[] = [
  {
    name: "Solo",
    badge: { label: "Free trial", className: "lozenge-default" },
    price: { num: "$0", unit: "/ first 3 memos" },
    desc: "For a single analyst kicking the tyres. No card required.",
    features: ["3 memos / month", "All 4 specialist agents", "PDF + JSON export", "Community support"],
    cta: { label: "Start free", className: "btn-outline", action: { kind: "link", href: "/login" } },
  },
  {
    name: "Desk",
    badge: { label: "Most popular", className: "lozenge-bold-inprog" },
    price: { num: "$399", unit: "/ month · per desk" },
    desc: "For an investment team. 50 memos/month, full export suite, watchlist monitoring.",
    features: [
      "50 memos / month",
      "Earnings, Comps & Screener",
      "PDF + JSON export",
      "Watchlist monitoring + Slack alerts",
      "Reviewer workflow & redlines",
      "API + webhooks",
    ],
    cta: { label: "Subscribe to Desk", className: "btn-primary", action: { kind: "checkout" } },
    featured: true,
  },
  {
    name: "Firm",
    badge: { label: "Enterprise", className: "lozenge-new" },
    price: { num: "Custom" },
    desc: "For institutional firms. Private corpus, SSO, dedicated tenancy, BYOK.",
    features: [
      "Everything in Desk",
      "Private document corpus",
      "SAML SSO + SCIM",
      "Dedicated tenancy + BYOK",
      "Named CSM, 99.95% SLA",
    ],
    cta: { label: "Contact sales", className: "btn-outline", action: { kind: "link", href: SALES_MAILTO } },
  },
];

export function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2>Pay per memo. Or per analyst.</h2>
          <p className="lead">
            Three tiers, no per-seat trickery. Start free; upgrade only when your firm starts to depend on it.
          </p>
        </div>

        <div className="pricing-grid">
          {TIERS.map((t) => (
            <div className={`price-card${t.featured ? " featured" : ""}`} key={t.name}>
              <div className="price-card-head">
                <h4>{t.name}</h4>
                <span className={`lozenge ${t.badge.className}`}>{t.badge.label}</span>
              </div>
              <div className="price">
                <span className="num tnum">{t.price.num}</span>
                {t.price.unit && <span className="unit">{t.price.unit}</span>}
              </div>
              <p className="desc">{t.desc}</p>
              <hr />
              <ul>
                {t.features.map((f) => (
                  <li key={f}><IconCheck />  {f}</li>
                ))}
              </ul>
              <PricingCta cta={t.cta} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Renders the right element for the CTA:
 *   - "checkout"     → button that POSTs to /billing/checkout (or bounces to /login)
 *   - "link" with /  → next/link client-side route
 *   - "link" with    → plain <a> (handles mailto:, https://, etc.)
 */
function PricingCta({ cta }: { cta: Tier["cta"] }) {
  const className = `btn ${cta.className} btn-md`;
  const style: React.CSSProperties = { marginTop: "auto" };

  if (cta.action.kind === "checkout") {
    return <CheckoutButton className={className} style={style}>{cta.label}</CheckoutButton>;
  }

  if (!cta.action.href.startsWith("/")) {
    return (
      <a href={cta.action.href} className={className} style={style}>
        {cta.label}
      </a>
    );
  }

  return (
    <Link href={cta.action.href} className={className} style={style}>
      {cta.label}
    </Link>
  );
}

/** Triggers a Stripe Checkout session. Logged-out users go to /login first
 * (with `?next=/#pricing` so they return to the same scroll position). */
function CheckoutButton({
  className, style, children,
}: { className: string; style: React.CSSProperties; children: React.ReactNode }) {
  async function handleClick() {
    if (!getToken()) {
      // Round-trip through login, then come back to /app where the dashboard
      // banner has its own "Upgrade" CTA.
      window.location.href = "/login?next=/app";
      return;
    }
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
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
  return (
    <button type="button" onClick={handleClick} className={className} style={style}>
      {children}
    </button>
  );
}
