"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, User as UserIcon, Building2 } from "lucide-react";
import { setToken } from "@/lib/auth";
import { GoogleIcon, SSOIcon } from "../icons";
import { Field, InputWrapper, inputCss } from "./Field";

type Mode = "login" | "register" | "forgot";

const SSO_PROVIDERS: { label: string; Icon: React.FC }[] = [
  { label: "Continue with Google", Icon: GoogleIcon },
  { label: "Continue with Microsoft SSO", Icon: SSOIcon },
];

/**
 * The interactive right-hand form: SSO buttons, email/password fields,
 * submit, mode toggle, and the "Back to home" affordance.
 * Owns all form state and the auth API call.
 *
 * Supports three modes:
 *   - "login":    email + password → /auth/login → /app
 *   - "register": email + password → /auth/register → /app (sends welcome email)
 *   - "forgot":   email-only       → /auth/forgot-password → success screen
 */
export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  // Optional signup fields — captured on register, never required.
  const [fullName, setFullName]       = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  // When the forgot-password request succeeds, we swap the form for a
  // "check your email" confirmation screen — no further input needed.
  const [forgotSent, setForgotSent] = useState(false);
  // After successful registration, show a "verify your email" screen instead
  // of auto-logging in. User must click the email link before they can sign in.
  const [registerSent, setRegisterSent] = useState(false);
  // True when login was rejected with "email_not_verified" — surfaces a
  // "Resend verification email" affordance.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setForgotSent(false);
    setRegisterSent(false);
    setNeedsVerification(false);
    setResent(false);
  }

  async function resendVerification() {
    setResending(true);
    try {
      await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      // Silently ignore — UI feedback already shows success.
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(false);

    try {
      if (mode === "forgot") {
        // Always returns 204, even for unknown emails — but we still show
        // the success screen unconditionally to match that privacy contract.
        await fetch("/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setForgotSent(true);
        return;
      }

      if (mode === "register") {
        // Register returns 201 with no token; user must verify via email.
        const res = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName.trim() || null,
            company_name: companyName.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail ?? "Something went wrong");
          return;
        }
        setRegisterSent(true);
        return;
      }

      // mode === "login"
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Backend signals an unverified account with HTTP 403 + a sentinel
        // detail. Show a dedicated "verify your email" affordance instead of
        // a generic error message.
        if (res.status === 403 && data.detail === "email_not_verified") {
          setNeedsVerification(true);
          return;
        }
        setError(data.detail ?? "Something went wrong");
        return;
      }
      setToken(data.access_token);
      // Honour ?next= redirect (e.g. from invite flow), fall back to dashboard
      const dest = nextUrl && nextUrl.startsWith("/") ? nextUrl : "/app";
      router.push(dest);
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // ── Registration success → "Verify your email" screen ────────────────────
  if (mode === "register" && registerSent) {
    return (
      <div className="lp-login-right">
        <Link href="/" className="lp-login-back" style={backLinkStyle}>
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14, marginBottom: 20,
            background: "var(--brand-soft)", color: "var(--brand-ink)",
          }}>
            <CheckCircle2 size={26} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
            Verify your email
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
            We sent a verification link to <strong>{email}</strong>. Click the
            button in that email to activate your account — the link expires in 24 hours.
          </p>
          <button
            onClick={() => switchMode("login")}
            style={{
              background: "var(--brand)", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to sign in
          </button>
          <p style={{ marginTop: 24, fontSize: 12, color: "var(--ink-4)" }}>
            Didn&rsquo;t get the email?{" "}
            <button
              onClick={resendVerification}
              disabled={resending || resent}
              style={{
                background: "none", border: "none",
                color: resent ? "var(--green-ink)" : "var(--brand)",
                fontWeight: 600, cursor: resending ? "wait" : "pointer", fontSize: 12,
              }}
            >
              {resent ? "Sent! Check your inbox." : resending ? "Sending…" : "Resend it"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── "Check your email" confirmation screen ────────────────────────────────
  if (mode === "forgot" && forgotSent) {
    return (
      <div className="lp-login-right">
        <Link href="/" className="lp-login-back" style={backLinkStyle}>
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14, marginBottom: 20,
            background: "var(--green-soft)", color: "var(--green-ink)",
          }}>
            <CheckCircle2 size={26} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
            Check your email
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
            If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a password
            reset link. It expires in 15 minutes.
          </p>
          <button
            onClick={() => switchMode("login")}
            style={{
              background: "var(--brand)", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to sign in
          </button>
          <p style={{ marginTop: 24, fontSize: 12, color: "var(--ink-4)" }}>
            Didn&rsquo;t get the email?{" "}
            <button
              onClick={() => setForgotSent(false)}
              style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
            >
              Try a different email
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-login-right">
      {/* Back to home — top-right */}
      <Link
        href="/"
        className="lp-login-back"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          fontSize: 13, fontWeight: 500,
          color: "var(--ink-3)",
          textDecoration: "none",
          borderRadius: 8,
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--ink)";
          e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--ink-3)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <ArrowLeft size={14} />
        Back to home
      </Link>

      <div className="lp-login-form-wrap">
        {/* Heading */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            margin: "0 0 8px", fontSize: 26, fontWeight: 700,
            letterSpacing: "-0.025em", color: "var(--ink)",
          }}>
            {mode === "login" ? "Welcome back"
              : mode === "register" ? "Create account"
              : "Reset password"}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
            {mode === "login" ? "Sign in to continue your investment workflow."
              : mode === "register" ? "Get started with your Arthvion account."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* SSO + divider — hidden in forgot-password mode */}
        {mode !== "forgot" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {SSO_PROVIDERS.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", height: 44,
                    background: "var(--surface)", color: "var(--ink)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 10, cursor: "pointer",
                    fontSize: 14, fontWeight: 500,
                    boxShadow: "var(--shadow-xs)",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-2)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                  }}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-4)" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "register" && (
            <>
              <Field label="Your name" labelRight={<span style={{ fontSize: 12, color: "var(--n300)" }}>Optional</span>} error={null}>
                <InputWrapper icon={<UserIcon size={14} />}>
                  <input
                    type="text" value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Analyst" maxLength={100}
                    style={inputCss}
                  />
                </InputWrapper>
              </Field>

              <Field label="Firm / company" labelRight={<span style={{ fontSize: 12, color: "var(--n300)" }}>Optional</span>} error={null}>
                <InputWrapper icon={<Building2 size={14} />}>
                  <input
                    type="text" value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Northbridge Capital" maxLength={100}
                    style={inputCss}
                  />
                </InputWrapper>
              </Field>
            </>
          )}

          <Field label="Work email" error={null}>
            <InputWrapper icon={<Mail size={14} />}>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required placeholder="you@fund.com"
                style={inputCss}
              />
            </InputWrapper>
          </Field>

          {mode !== "forgot" && (
            <Field
              label="Password"
              labelRight={
                mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 12, color: "var(--brand)", fontWeight: 500, padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                )
              }
              error={null}
            >
              <InputWrapper
                icon={<Lock size={14} />}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--ink-4)", display: "flex", alignItems: "center", padding: "0 4px",
                    }}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              >
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} placeholder="••••••••"
                  style={inputCss}
                />
              </InputWrapper>
            </Field>
          )}

          {needsVerification && (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "var(--brand-soft)", color: "var(--brand-ink)",
              fontSize: 13, border: "1px solid rgba(12,102,228,0.20)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontWeight: 600 }}>Verify your email to continue</div>
              <div style={{ color: "var(--ink-3)", lineHeight: 1.5 }}>
                We sent a link to <strong>{email}</strong> when you signed up.
                Click it to activate your account.
              </div>
              <button
                type="button"
                onClick={resendVerification}
                disabled={resending || resent}
                style={{
                  alignSelf: "flex-start",
                  background: resent ? "var(--green-soft)" : "var(--brand)",
                  color: resent ? "var(--green-ink)" : "#fff",
                  border: "none", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                  cursor: resending ? "wait" : "pointer",
                }}
              >
                {resent ? "✓ Sent! Check your inbox" : resending ? "Sending…" : "Resend verification email"}
              </button>
            </div>
          )}

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "var(--red-soft)", color: "var(--red-ink)",
              fontSize: 13, border: "1px solid #FECACA",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", height: 44, marginTop: 4,
              fontSize: 14, fontWeight: 600,
              background: loading ? "var(--brand-hover)" : "var(--brand)",
              color: "#fff", border: "none", borderRadius: 10,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "var(--shadow-brand)",
              transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
              opacity: loading ? 0.75 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--brand-hover)"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--brand)"; }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: 999,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block", flexShrink: 0,
                }} />
                {mode === "login" ? "Signing in…"
                  : mode === "register" ? "Creating account…"
                  : "Sending link…"}
              </>
            ) : (
              <>
                {mode === "login" ? "Sign in"
                  : mode === "register" ? "Create account"
                  : "Send reset link"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
          {mode === "login" && (
            <>
              New to Arthvion?{" "}
              <button onClick={() => switchMode("register")} style={modeToggleStyle}>
                Request access
              </button>
            </>
          )}
          {mode === "register" && (
            <>
              Already have an account?{" "}
              <button onClick={() => switchMode("login")} style={modeToggleStyle}>
                Sign in instead
              </button>
            </>
          )}
          {mode === "forgot" && (
            <>
              Remembered it?{" "}
              <button onClick={() => switchMode("login")} style={modeToggleStyle}>
                Back to sign in
              </button>
            </>
          )}
        </p>

        <p style={{
          marginTop: 32, textAlign: "center", fontSize: 11.5,
          color: "var(--ink-5)", lineHeight: 1.6,
        }}>
          By continuing you agree to our{" "}
          <a href="/terms" style={{ color: "var(--ink-4)", textDecoration: "underline" }}>Terms</a>{" "}and{" "}
          <a href="/privacy" style={{ color: "var(--ink-4)", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

// ── Shared inline styles ──────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  fontSize: 13, fontWeight: 500,
  color: "var(--ink-3)",
  textDecoration: "none",
  borderRadius: 8,
  transition: "color 0.15s, background 0.15s",
};

const modeToggleStyle: React.CSSProperties = {
  background: "none", border: "none",
  color: "var(--brand)", fontWeight: 600,
  cursor: "pointer", fontSize: 13,
};
