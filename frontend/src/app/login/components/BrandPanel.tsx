import { Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

const STATS = [
  { v: "2–4 min", l: "report turnaround" },
  { v: "14k+",    l: "reports generated" },
  { v: "94%",     l: "analyst agreement" },
];

/**
 * The dark left panel shown on the login page (hidden below 880px via CSS).
 * Purely presentational — logo, hero copy, stats strip, footer line.
 */
export function BrandPanel() {
  return (
    <div className="lp-login-left">
      {/* Noise overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
      }} />

      {/* Gradient orbs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", width: 560, height: 560, top: -120, left: -160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,62,118,0.55) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", width: 400, height: 400, bottom: -80, right: -60,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,52,100,0.40) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", width: 280, height: 280, top: "40%", right: "10%",
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
        <Logo variant="onDark" size={36} />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: "#fff" }}>
          Arthvion
        </span>
        <span style={{
          marginLeft: 4, padding: "2px 8px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          background: "rgba(90,159,212,0.15)", color: "#9DC8E8",
          border: "1px solid rgba(90,159,212,0.28)",
        }}>VANTAGE</span>
      </div>

      {/* Hero copy */}
      <div style={{
        position: "relative", flex: 1,
        display: "flex", flexDirection: "column", justifyContent: "center",
        maxWidth: 520,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", marginBottom: 28, width: "fit-content",
          borderRadius: 999, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.01em",
          background: "rgba(90,159,212,0.10)", color: "#88B8D8",
          border: "1px solid rgba(90,159,212,0.20)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, background: "#5A9FD4",
            animation: "af-pulse 2s ease-in-out infinite", display: "inline-block",
          }} />
          Multi-agent due diligence · v2.4
        </div>

        <h1 className="lp-login-h1" style={{
          margin: "0 0 20px",
          fontWeight: 700, letterSpacing: "-0.04em", color: "#FFFFFF",
        }}>
          Institutional due diligence,{" "}
          <span style={{
            fontFamily: "Instrument Serif, Georgia, serif",
            fontStyle: "italic", fontWeight: 400, color: "#C9A444",
          }}>in minutes.</span>
        </h1>

        <p style={{
          margin: "0 0 40px", fontSize: 15.5, lineHeight: 1.65,
          color: "rgba(255,255,255,0.60)", maxWidth: 480,
        }}>
          Four specialized agents pull SEC filings, market data, litigation records, and risk factors — synthesized into an investment-grade memo with citations.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, maxWidth: 420 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              padding: "16px 0",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
              paddingRight: i < 2 ? 24 : 0,
              paddingLeft: i > 0 ? 24 : 0,
            }}>
              <div style={{
                fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em",
                color: "#FFFFFF", fontVariantNumeric: "tabular-nums",
              }}>{s.v}</div>
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
  );
}
