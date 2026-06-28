"use client";

import Link from "next/link";
import { XCircle, ArrowLeft } from "lucide-react";
import { CSS } from "../../login/css";

/**
 * Landing page Stripe redirects to when the user backs out of Checkout
 * (clicks the X, hits the browser back button, etc.). No charge was made.
 */
export default function BillingCancelPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-login" style={{ overflow: "hidden", gridTemplateColumns: "1fr" }}>
        <div className="lp-login-right">
          <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 64, height: 64, borderRadius: 16, marginBottom: 24,
              background: "var(--surface-2)", color: "var(--ink-3)",
            }}>
              <XCircle size={30} />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
              Checkout cancelled
            </h2>
            <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
              No problem — nothing was charged. You can keep using the Solo plan
              and upgrade whenever you&rsquo;re ready.
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
              <ArrowLeft size={16} /> Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
