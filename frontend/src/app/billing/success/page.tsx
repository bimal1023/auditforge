"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { CSS } from "../../login/css";

/**
 * Landing page Stripe redirects to after a successful Checkout session.
 *
 * The webhook (`checkout.session.completed`) has likely already fired by the
 * time the browser arrives here — but not always. We auto-bounce to /app
 * after a brief celebration so the dashboard's /me fetch picks up the new
 * plan tier. If the webhook is slow, the dashboard banner just shows the
 * old credit count until the next refresh.
 */
export default function BillingSuccessPage() {
  const router = useRouter();

  // Give the webhook ~3s of head start, then route to /app where the
  // dashboard's useCredits() hook will reflect the new plan.
  useEffect(() => {
    const t = setTimeout(() => router.push("/app"), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-login" style={{ overflow: "hidden", gridTemplateColumns: "1fr" }}>
        <div className="lp-login-right">
          <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 64, height: 64, borderRadius: 16, marginBottom: 24,
              background: "var(--green-soft)", color: "var(--green-ink)",
            }}>
              <CheckCircle2 size={30} />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
              You&rsquo;re on the Desk plan
            </h2>
            <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
              You have <strong>50 memo credits</strong> for the current billing period.
              Cancel anytime from the dashboard — your next invoice arrives in 30 days.
            </p>
            <Link
              href="/app"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--brand)", color: "#fff",
                border: "none", borderRadius: 10,
                padding: "12px 24px", fontSize: 14, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to dashboard <ArrowRight size={16} />
            </Link>
            <p style={{ marginTop: 20, fontSize: 11.5, color: "var(--ink-4)" }}>
              Auto-redirecting in a moment&hellip;
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
