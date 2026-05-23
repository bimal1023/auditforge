"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";
import {
  Lock, Mail, ArrowRight, Globe, Briefcase,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      router.push("/");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 12px 0 38px",
    fontFamily: "Inter, sans-serif", fontSize: 13.5,
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: 9, color: "var(--ink)",
    outline: "none",
    boxShadow: "var(--shadow-xs)",
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "grid",
      gridTemplateColumns: "1.1fr 1fr",
      background: "var(--bg)", overflow: "hidden",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* ── Left — branding panel ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, #0E0E10 0%, #1B1230 60%, #2E1759 100%)",
        color: "#fff", padding: "40px 56px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        {/* Mesh gradient */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.55,
          background: `
            radial-gradient(circle at 12% 22%, rgba(124,58,237,0.55), transparent 38%),
            radial-gradient(circle at 92% 14%, rgba(167,139,250,0.35), transparent 42%),
            radial-gradient(circle at 70% 88%, rgba(124,58,237,0.45), transparent 40%)
          `,
        }} />
        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.16, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse at 30% 50%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 30% 50%, #000 30%, transparent 75%)",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark stroke="#A78BFA" />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>AuditForge</span>
        </div>

        {/* Hero copy */}
        <div style={{ position: "relative", maxWidth: 480 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
            background: "rgba(167,139,250,0.18)", color: "#DDD6FE",
            border: "1px solid rgba(167,139,250,0.3)", borderRadius: 999,
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#A78BFA" }} />
            Multi-agent due diligence · v2.4
          </span>
          <h1 style={{
            margin: "0 0 16px", fontSize: 46, lineHeight: 1.05,
            fontWeight: 600, letterSpacing: "-0.035em",
          }}>
            Institutional due diligence,{" "}
            <span style={{
              fontFamily: "Instrument Serif, Georgia, serif",
              fontStyle: "italic", fontWeight: 400, color: "#C4B5FD",
            }}>in minutes.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.7)", maxWidth: 440 }}>
            Four specialized agents pull SEC filings, market data, litigation records, and risk factors in parallel — and synthesize them into an investment-grade memo with citations.
          </p>

          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, maxWidth: 460 }}>
            {[
              { v: "2–4 min", l: "report turnaround" },
              { v: "14k+",    l: "reports generated" },
              { v: "94%",     l: "analyst agreement" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "#FFF", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
          <Lock size={12} />
          SOC 2 Type II · Tenant-isolated · No data egress to public LLMs
        </div>
      </div>

      {/* ── Right — form ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40, background: "var(--bg)", overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>
              {mode === "login" ? "Sign in to continue your investment workflow." : "Get started with 5 free reports."}
            </p>
          </div>

          {/* SSO buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            <button style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", height: 42, padding: "0 16px",
              fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600,
              background: "var(--surface)", color: "var(--ink)",
              border: "1px solid var(--border-strong)", borderRadius: 10,
              boxShadow: "var(--shadow-xs)", cursor: "pointer",
            }}>
              <Globe size={15} />
              Continue with Google
            </button>
            <button style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", height: 42, padding: "0 16px",
              fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600,
              background: "var(--surface)", color: "var(--ink)",
              border: "1px solid var(--border-strong)", borderRadius: 10,
              boxShadow: "var(--shadow-xs)", cursor: "pointer",
            }}>
              <Briefcase size={15} />
              Continue with SSO
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, fontSize: 11, color: "var(--ink-4)" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ letterSpacing: "0.06em" }}>OR EMAIL</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)", display: "block", marginBottom: 6 }}>
                Work email
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={14} color="var(--ink-4)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="you@fund.com"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Password</label>
                <a style={{ fontSize: 11.5, color: "var(--brand)", textDecoration: "none", fontWeight: 500, cursor: "pointer" }}>Forgot?</a>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={14} color="var(--ink-4)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{
                padding: "10px 12px", borderRadius: 9,
                background: "var(--red-soft)", color: "var(--red-ink)",
                fontSize: 13, border: "1px solid #FECACA",
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", height: 42, marginTop: 4,
                fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600,
                background: "var(--brand)", color: "#fff",
                border: "1px solid var(--brand-hover)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(124,58,237,0.32)",
                borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: 22, textAlign: "center", fontSize: 12.5, color: "var(--ink-3)" }}>
            {mode === "login" ? "New to AuditForge? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
              style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 500, cursor: "pointer", fontSize: 12.5 }}
            >
              {mode === "login" ? "Request access" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LogoMark({ stroke = "var(--brand)" }: { stroke?: string }) {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={0} style={{ flexShrink: 0 }}>
      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" fill="currentColor" opacity="0.12" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8 L16 10.25 L16 14.75 L12 17 L8 14.75 L8 10.25 Z" stroke={stroke} strokeWidth="1.5" fill="currentColor" />
    </svg>
  );
}
