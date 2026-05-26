"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]       = useState<"login" | "register">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const endpoint = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Something went wrong"); return; }
      setToken(data.access_token);
      router.push("/app");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      width: "100%", height: "100%", display: "grid",
      gridTemplateColumns: "1.15fr 1fr",
      fontFamily: "Inter, system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Left branding panel ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(150deg, #040A14 0%, #081828 40%, #0F2440 72%, #16345C 100%)",
        color: "#fff",
        display: "flex", flexDirection: "column",
        padding: "44px 60px",
      }}>
        {/* Noise overlay */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }} />

        {/* Gradient orbs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", width: 560, height: 560,
            top: -120, left: -160,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,62,118,0.55) 0%, transparent 65%)",
          }} />
          <div style={{
            position: "absolute", width: 400, height: 400,
            bottom: -80, right: -60,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,52,100,0.40) 0%, transparent 65%)",
          }} />
          <div style={{
            position: "absolute", width: 280, height: 280,
            top: "40%", right: "10%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(90,148,210,0.12) 0%, transparent 65%)",
          }} />
        </div>

        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.07, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 25% 55%, #000 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 25% 55%, #000 20%, transparent 70%)",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={32} stroke="#5A9FD4" />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: "#fff" }}>
            AuditForge
          </span>
          <span style={{
            marginLeft: 4, padding: "2px 8px", borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            background: "rgba(90,159,212,0.15)", color: "#9DC8E8",
            border: "1px solid rgba(90,159,212,0.28)",
          }}>VANTAGE</span>
        </div>

        {/* Hero copy */}
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", marginBottom: 28, width: "fit-content",
            borderRadius: 999, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.01em",
            background: "rgba(90,159,212,0.10)", color: "#88B8D8",
            border: "1px solid rgba(90,159,212,0.20)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#5A9FD4", animation: "af-pulse 2s ease-in-out infinite", display: "inline-block" }} />
            Multi-agent due diligence · v2.4
          </div>

          <h1 style={{
            margin: "0 0 20px", fontSize: 52, lineHeight: 1.02,
            fontWeight: 700, letterSpacing: "-0.04em", color: "#FFFFFF",
          }}>
            Institutional due diligence,{" "}
            <span style={{
              fontFamily: "Instrument Serif, Georgia, serif",
              fontStyle: "italic", fontWeight: 400,
              color: "#C9A444",
            }}>in minutes.</span>
          </h1>

          <p style={{
            margin: "0 0 40px", fontSize: 15.5, lineHeight: 1.65,
            color: "rgba(255,255,255,0.60)", maxWidth: 480,
          }}>
            Four specialized agents pull SEC filings, market data, litigation records, and risk factors — synthesized into an investment-grade memo with citations.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, maxWidth: 420 }}>
            {[
              { v: "2–4 min", l: "report turnaround" },
              { v: "14k+",    l: "reports generated" },
              { v: "94%",     l: "analyst agreement" },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "16px 0",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
                paddingRight: i < 2 ? 24 : 0,
                paddingLeft: i > 0 ? 24 : 0,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 6,
          fontSize: 11.5, color: "rgba(255,255,255,0.35)",
        }}>
          <Lock size={11} />
          <span>SOC 2 Type II · Tenant-isolated · Zero data egress</span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 48px",
        background: "#FFFFFF",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              margin: "0 0 8px", fontSize: 26, fontWeight: 700,
              letterSpacing: "-0.025em", color: "var(--ink)",
            }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
              {mode === "login"
                ? "Sign in to continue your investment workflow."
                : "Get started with your AuditForge account."}
            </p>
          </div>

          {/* SSO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {[
              { label: "Continue with Google", icon: GoogleIcon },
              { label: "Continue with Microsoft SSO", icon: SSOIcon },
            ].map(({ label, icon: Icon }) => (
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

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-4)" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

            <Field
              label="Password"
              labelRight={
                mode === "login" && (
                  <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--brand)", fontWeight: 500, padding: 0 }}>
                    Forgot password?
                  </button>
                )
              }
              error={null}
            >
              <InputWrapper icon={<Lock size={14} />} suffix={
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", alignItems: "center", padding: "0 4px" }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }>
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} placeholder="••••••••"
                  style={inputCss}
                />
              </InputWrapper>
            </Field>

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
                color: "#fff",
                border: "none",
                borderRadius: 10,
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
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
            {mode === "login" ? "New to AuditForge? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
              style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              {mode === "login" ? "Request access" : "Sign in instead"}
            </button>
          </p>

          <p style={{ marginTop: 32, textAlign: "center", fontSize: 11.5, color: "var(--ink-5)", lineHeight: 1.6 }}>
            By continuing you agree to our{" "}
            <a href="#" style={{ color: "var(--ink-4)", textDecoration: "underline" }}>Terms</a>{" "}and{" "}
            <a href="#" style={{ color: "var(--ink-4)", textDecoration: "underline" }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

const inputCss: React.CSSProperties = {
  width: "100%", height: "100%",
  padding: "0 12px 0 36px",
  background: "transparent",
  border: "none", outline: "none",
  fontSize: 14, color: "var(--ink)",
  fontFamily: "Inter, sans-serif",
};

function Field({
  label, labelRight, children, error,
}: {
  label: string;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
  error: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{label}</label>
        {labelRight}
      </div>
      {children}
      {error && <p style={{ margin: 0, fontSize: 12, color: "var(--red-ink)" }}>{error}</p>}
    </div>
  );
}

function InputWrapper({ icon, suffix, children }: { icon: React.ReactNode; suffix?: React.ReactNode; children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        display: "flex", alignItems: "center",
        height: 44,
        background: "var(--surface)",
        border: `1.5px solid ${focused ? "var(--brand)" : "var(--border-strong)"}`,
        borderRadius: 10,
        boxShadow: focused ? "0 0 0 3px var(--brand-glow)" : "var(--shadow-xs)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      <span style={{ paddingLeft: 12, color: focused ? "var(--brand)" : "var(--ink-4)", flexShrink: 0, display: "flex", alignItems: "center", transition: "color 0.15s" }}>
        {icon}
      </span>
      <div style={{ flex: 1, height: "100%" }}>{children}</div>
      {suffix && <span style={{ paddingRight: 8, flexShrink: 0, display: "flex", alignItems: "center" }}>{suffix}</span>}
    </div>
  );
}

function LogoMark({ stroke = "#5A9FD4", size = 28 }: { stroke?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z"
        fill={stroke} opacity="0.15" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8 L16 10.25 L16 14.75 L12 17 L8 14.75 L8 10.25 Z"
        stroke={stroke} strokeWidth="1.5" fill={stroke} />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function SSOIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
