"use client";

import { Settings as SettingsIcon } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="slide-up" style={{ textAlign: "center", padding: "80px 20px" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 56, height: 56, borderRadius: 14,
        background: "var(--n20)", color: "var(--n200)", marginBottom: 16,
      }}>
        <SettingsIcon size={22} />
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "var(--n900)", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <p style={{ margin: 0, color: "var(--n200)", fontSize: 14 }}>
        Coming soon. We&rsquo;re still wiring this surface up.
      </p>
    </div>
  );
}
