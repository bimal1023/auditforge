"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Bell, HelpCircle, LogOut, Command, BookOpen, Mail } from "lucide-react";
import type { NavTab, RunStatus } from "../types";
import { TAB_LABELS, TAB_PARENT } from "../constants";

interface TopbarProps {
  activeTab: NavTab;
  runStatus: RunStatus;
  onBack: () => void;
  onSignOut: () => void;
  onSearchOpen: () => void;
  onNotifications: () => void;
  alertCount?: number;
}

export function Topbar({
  activeTab, runStatus, onBack, onSignOut, onSearchOpen, onNotifications, alertCount = 0,
}: TopbarProps) {
  const statusLabel = runStatus === "running" ? "RUNNING"
    : runStatus === "complete" ? "COMPLETE"
    : runStatus === "error" ? "ERROR" : "IDLE";

  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen) return;
    function onDoc(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setHelpOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [helpOpen]);

  return (
    <div className="topbar">
      <button className="tb-back" onClick={onBack} aria-label="Back">
        <ChevronLeft size={16} />
      </button>
      <div className="tb-crumbs">
        <span className="tb-crumb">Arthvion</span>
        <ChevronRight size={12} className="tb-sep" />
        <span className="tb-crumb">{TAB_PARENT[activeTab]}</span>
        <ChevronRight size={12} className="tb-sep" />
        <span className="tb-crumb current">{TAB_LABELS[activeTab]}</span>
      </div>
      <div className="tb-spacer" />
      {runStatus !== "idle" && (
        <span className={`tb-status ${runStatus}`}>
          <span className="dot" />{statusLabel}
        </span>
      )}
      <button className="tb-icon-btn" onClick={onSearchOpen} aria-label="Search"><Search size={15} /></button>
      <button
        className="tb-icon-btn"
        onClick={onNotifications}
        aria-label="Notifications"
        style={{ position: "relative" }}
      >
        <Bell size={15} />
        {alertCount > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 15, height: 15, padding: "0 4px",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--r500)", color: "#fff",
            fontSize: 9, fontWeight: 700, lineHeight: 1,
            borderRadius: 999, border: "1.5px solid var(--n0)",
          }}>{alertCount > 9 ? "9+" : alertCount}</span>
        )}
      </button>
      <div ref={helpRef} style={{ position: "relative", display: "inline-flex" }}>
        <button
          className="tb-icon-btn"
          onClick={() => setHelpOpen((o) => !o)}
          aria-label="Help"
          aria-expanded={helpOpen}
        >
          <HelpCircle size={15} />
        </button>
        {helpOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            width: 248, padding: 6,
            background: "var(--n0)", border: "1px solid var(--n30)",
            borderRadius: "var(--r-3)", boxShadow: "var(--e300)",
            zIndex: 50,
          }}>
            <div style={{
              padding: "8px 10px 6px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--n200)",
            }}>Help & shortcuts</div>
            <button
              onClick={() => { setHelpOpen(false); onSearchOpen(); }}
              style={helpItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--n10)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Search size={14} style={{ color: "var(--n200)" }} />
              <span style={{ flex: 1 }}>Search</span>
              <kbd style={kbdStyle}><Command size={10} />K</kbd>
            </button>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setHelpOpen(false)}
              style={{ ...helpItemStyle, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--n10)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <BookOpen size={14} style={{ color: "var(--n200)" }} />
              <span style={{ flex: 1 }}>Documentation</span>
            </a>
            <a
              href="mailto:support@arthvion.com"
              onClick={() => setHelpOpen(false)}
              style={{ ...helpItemStyle, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--n10)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Mail size={14} style={{ color: "var(--n200)" }} />
              <span style={{ flex: 1 }}>Contact support</span>
            </a>
          </div>
        )}
      </div>
      <button className="tb-signout" onClick={onSignOut}>
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}

const helpItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "8px 10px", border: "none", background: "transparent",
  borderRadius: "var(--r-2)", cursor: "pointer",
  fontSize: 13, fontWeight: 500, color: "var(--n800)", textAlign: "left",
  transition: "background 0.12s",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 1,
  padding: "1px 5px", fontSize: 10.5, fontWeight: 600,
  color: "var(--n200)", background: "var(--n10)",
  border: "1px solid var(--n30)", borderRadius: 4,
  fontFamily: "'JetBrains Mono', monospace",
};
