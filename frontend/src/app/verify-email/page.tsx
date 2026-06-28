"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { setToken } from "@/lib/auth";
import { CSS } from "../login/css";

/**
 * Verification landing page. Reached only via the "Verify my email" link in
 * the registration email. Extracts `?token=...` from the URL, POSTs to
 * `/api/v1/auth/verify-email`, and signs the user in on success.
 *
 * Three visual states:
 *  - verifying  (spinner)
 *  - success    (✓, brief, auto-redirects to /app)
 *  - failure    (✗, with a "request a new link" button)
 */
export default function VerifyEmailPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-login" style={{ overflow: "hidden", gridTemplateColumns: "1fr" }}>
        <Suspense fallback={<div className="lp-login-right"><Loader /></div>}>
          <VerifyEmailFlow />
        </Suspense>
      </div>
    </>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <span style={{
        width: 28, height: 28, borderRadius: 999,
        border: "3px solid rgba(12,102,228,0.18)", borderTopColor: "var(--brand)",
        animation: "spin 0.7s linear infinite", display: "inline-block",
      }} />
    </div>
  );
}

function VerifyEmailFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"verifying" | "success" | "failure">("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");
  // Guard against React 18 StrictMode firing the effect twice in dev — would
  // double-consume the verification token otherwise.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !token) {
      if (!token) {
        setStatus("failure");
        setErrorMsg("This verification link is missing its token. Request a new one from the sign-in page.");
      }
      return;
    }
    fired.current = true;

    (async () => {
      try {
        const res = await fetch("/api/v1/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("failure");
          setErrorMsg(data.detail ?? "Could not verify your email.");
          return;
        }
        // Backend returned a fresh access token — sign the user in and bounce
        // them to the dashboard so they don't have to type their password again.
        setToken(data.access_token);
        setStatus("success");
        setTimeout(() => router.push("/app"), 1500);
      } catch {
        setStatus("failure");
        setErrorMsg("Network error — is the backend running?");
      }
    })();
  }, [token, router]);

  if (status === "verifying") {
    return (
      <div className="lp-login-right">
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <Loader />
          <h2 style={{ marginTop: 20, fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            Verifying your email&hellip;
          </h2>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="lp-login-right">
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <div style={iconCircleStyle("var(--green-soft)", "var(--green-ink)")}>
            <CheckCircle2 size={26} />
          </div>
          <h2 style={titleStyle}>Email verified</h2>
          <p style={subtitleStyle}>Signing you in&hellip;</p>
        </div>
      </div>
    );
  }

  // status === "failure"
  return (
    <div className="lp-login-right">
      <Link href="/" className="lp-login-back" style={backLinkStyle}>
        <ArrowLeft size={14} /> Back to home
      </Link>
      <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
        <div style={iconCircleStyle("var(--red-soft)", "var(--red-ink)")}>
          <AlertTriangle size={26} />
        </div>
        <h2 style={titleStyle}>Verification failed</h2>
        <p style={subtitleStyle}>{errorMsg}</p>
        <Link
          href="/login"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--brand)", color: "#fff",
            border: "none", borderRadius: 10,
            padding: "10px 22px",
            fontSize: 13, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to sign in <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/* ── Shared inline styles ────────────────────────────────────────────────── */

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  fontSize: 13, fontWeight: 500,
  color: "var(--ink-3)",
  textDecoration: "none",
  borderRadius: 8,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em",
  color: "var(--ink)",
};

const subtitleStyle: React.CSSProperties = {
  margin: "0 0 24px",
  fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6,
};

function iconCircleStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 56, height: 56, borderRadius: 14, marginBottom: 20,
    background: bg, color,
  };
}
