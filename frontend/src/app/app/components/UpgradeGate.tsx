"use client";

import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/auth";

interface UpgradeGateProps {
  feature: string;
  description: string;
}

async function startUpgrade() {
  try {
    const res = await apiFetch("/api/v1/billing/checkout", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.checkout_url) {
      alert(data.detail ?? "Could not start checkout. Try again in a moment.");
      return;
    }
    window.location.href = data.checkout_url;
  } catch { alert("Network error — please try again."); }
}

export function UpgradeGate({ feature, description }: UpgradeGateProps) {
  return (
    <div className="slide-up" style={{ textAlign: "center", padding: "80px 20px" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 56, height: 56, borderRadius: 14,
        background: "var(--b50)", color: "var(--b600)", marginBottom: 16,
      }}>
        <Lock size={22} />
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "var(--n900)", letterSpacing: "-0.02em" }}>
        {feature} is a Desk feature
      </h2>
      <p style={{ margin: "0 0 24px", color: "var(--n200)", fontSize: 14, maxWidth: 400, marginInline: "auto" }}>
        {description}
      </p>
      <button
        type="button"
        onClick={startUpgrade}
        style={{
          padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "var(--b600)", color: "#fff", fontSize: 14, fontWeight: 600,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--b700)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--b600)")}
      >
        Upgrade to Desk
      </button>
    </div>
  );
}
