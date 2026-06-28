"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { setToken } from "@/lib/auth";
import { CSS } from "../login/css";

/**
 * Password-reset landing page. Reached only via the link in the
 * "Reset your Arthvion password" email — extracts `?token=...` from the URL
 * and POSTs to /api/v1/auth/reset-password along with the new password.
 *
 * On success the backend returns a fresh access token, so we log the user in
 * and route them straight to the dashboard. No second sign-in step.
 */
export default function ResetPasswordPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-login" style={{ overflow: "hidden", gridTemplateColumns: "1fr" }}>
        <Suspense fallback={<div className="lp-login-right"><Loader /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <span style={{
        width: 24, height: 24, borderRadius: 999,
        border: "3px solid rgba(12,102,228,0.18)", borderTopColor: "var(--brand)",
        animation: "spin 0.7s linear infinite", display: "inline-block",
      }} />
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [showPw,   setShowPw]     = useState(false);
  const [error,    setError]      = useState<string | null>(null);
  const [loading,  setLoading]    = useState(false);
  const [success,  setSuccess]    = useState(false);

  // ── No token in URL — show error state ────────────────────────────────────
  if (!token) {
    return (
      <div className="lp-login-right">
        <Link href="/" className="lp-login-back" style={backLinkStyle}>
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <div style={iconCircleStyle("var(--red-soft)", "var(--red-ink)")}>
            <AlertTriangle size={26} />
          </div>
          <h2 style={titleStyle}>Invalid reset link</h2>
          <p style={subtitleStyle}>
            This reset link is missing its token. Request a new one from the sign-in page.
          </p>
          <Link href="/login" style={primaryButtonLinkStyle}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Could not reset password.");
        return;
      }
      // Backend issues a fresh access token; sign the user in and bounce
      // them to the dashboard so they don't have to type their password again.
      setToken(data.access_token);
      setSuccess(true);
      setTimeout(() => router.push("/app"), 1200);
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state (brief — auto-redirects) ────────────────────────────────
  if (success) {
    return (
      <div className="lp-login-right">
        <div className="lp-login-form-wrap" style={{ textAlign: "center" }}>
          <div style={iconCircleStyle("var(--green-soft)", "var(--green-ink)")}>
            <CheckCircle2 size={26} />
          </div>
          <h2 style={titleStyle}>Password updated</h2>
          <p style={subtitleStyle}>Signing you in&hellip;</p>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="lp-login-right">
      <Link href="/" className="lp-login-back" style={backLinkStyle}>
        <ArrowLeft size={14} /> Back to home
      </Link>
      <div className="lp-login-form-wrap">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
            Set a new password
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
            Pick something at least 8 characters long. You&rsquo;ll be signed in automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            showPw={showPw}
            onToggleShow={() => setShowPw((p) => !p)}
            placeholder="At least 8 characters"
            autoFocus
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            showPw={showPw}
            onToggleShow={() => setShowPw((p) => !p)}
            placeholder="Re-enter the same password"
          />

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
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: 999,
                  border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                  animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0,
                }} />
                Updating&hellip;
              </>
            ) : (
              <>Set new password<ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
          Changed your mind?{" "}
          <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function PasswordField({
  label, value, onChange, showPw, onToggleShow, placeholder, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPw: boolean;
  onToggleShow: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{label}</label>
      <div
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
        style={{
          display: "flex", alignItems: "center", height: 44,
          background: "var(--surface)",
          border: `1.5px solid ${focused ? "var(--brand)" : "var(--border-strong)"}`,
          borderRadius: 10,
          boxShadow: focused ? "0 0 0 3px var(--brand-glow)" : "var(--shadow-xs)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          overflow: "hidden",
        }}
      >
        <span style={{
          paddingLeft: 12, color: focused ? "var(--brand)" : "var(--ink-4)",
          flexShrink: 0, display: "flex", alignItems: "center", transition: "color 0.15s",
        }}>
          <Lock size={14} />
        </span>
        <input
          type={showPw ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            flex: 1, height: "100%",
            padding: "0 12px 0 36px",
            background: "transparent", border: "none", outline: "none",
            fontSize: 14, color: "var(--ink)", fontFamily: "Inter, sans-serif",
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--ink-4)", display: "flex", alignItems: "center",
            padding: "0 12px", flexShrink: 0,
          }}
        >
          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
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
  transition: "color 0.15s, background 0.15s",
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

const primaryButtonLinkStyle: React.CSSProperties = {
  display: "inline-block",
  background: "var(--brand)", color: "#fff",
  border: "none", borderRadius: 10,
  padding: "10px 22px",
  fontSize: 13, fontWeight: 600,
  textDecoration: "none",
};

function iconCircleStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 56, height: 56, borderRadius: 14, marginBottom: 20,
    background: bg, color,
  };
}
