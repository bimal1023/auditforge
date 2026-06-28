"use client";

import { useState } from "react";

/** Labeled wrapper around an input. Supports a right-side label affordance (e.g. "Forgot password?"). */
export function Field({
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

/** Pill-shaped input shell with a leading icon and an optional trailing slot (e.g. eye toggle). */
export function InputWrapper({
  icon, suffix, children,
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
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
      <span style={{
        paddingLeft: 12,
        color: focused ? "var(--brand)" : "var(--ink-4)",
        flexShrink: 0, display: "flex", alignItems: "center",
        transition: "color 0.15s",
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, height: "100%" }}>{children}</div>
      {suffix && (
        <span style={{ paddingRight: 8, flexShrink: 0, display: "flex", alignItems: "center" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Default styles applied to <input> elements wrapped by InputWrapper. */
export const inputCss: React.CSSProperties = {
  width: "100%", height: "100%",
  padding: "0 12px 0 36px",
  background: "transparent",
  border: "none", outline: "none",
  fontSize: 14, color: "var(--ink)",
  fontFamily: "Inter, sans-serif",
};
