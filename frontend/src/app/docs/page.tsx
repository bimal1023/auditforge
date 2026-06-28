import type { Metadata } from "next";
import Link from "next/link";

import { CSS } from "../_landing/css";
import { DOCS_CSS } from "./css";
import { DOCS_NAV, DocsContent } from "./content";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Documentation — Arthvion",
  description:
    "How Arthvion works: the four-agent diligence memo, analyst surfaces, your private document corpus, exports, workspaces, and plans.",
};

export default function DocsPage() {
  return (
    <>
      {/* Google Fonts (hoisted into <head> by React 18) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS + DOCS_CSS }} />

      <div className="lp-wrap">
        <header className="docs-top">
          <Link href="/" className="docs-top-brand">
            <span className="mark"><Logo variant="onDark" size={15} /></span>
            Arthvion
          </Link>
          <span className="docs-top-tag">Docs</span>
          <span className="docs-top-spacer" />
          <Link href="/app" className="docs-top-link">Open app →</Link>
        </header>

        <div className="docs-shell">
          <aside className="docs-side">
            {DOCS_NAV.map((group) => (
              <div className="docs-side-group" key={group.title}>
                <h4>{group.title}</h4>
                {group.items.map((it) => (
                  <a href={`#${it.id}`} key={it.id}>{it.label}</a>
                ))}
              </div>
            ))}
          </aside>

          <main className="docs-main">
            <h1>Documentation</h1>
            <p className="docs-lead">
              Everything you need to run institutional-grade diligence in Arthvion —
              from your first memo to monitoring, your private corpus, and exports.
            </p>
            <DocsContent />
          </main>
        </div>
      </div>
    </>
  );
}
