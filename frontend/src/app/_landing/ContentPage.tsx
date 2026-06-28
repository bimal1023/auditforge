import type { ReactNode } from "react";
import Link from "next/link";

import { CSS } from "./css";
import { Footer } from "./sections/Footer";
import { ScrollToTop } from "./ScrollToTop";
import { Logo } from "@/components/Logo";

/** Extra prose styling for static content pages (Terms, Privacy, About, …).
 *  Scoped under `.lp-wrap .lp-prose` so it never leaks into the marketing
 *  sections, and reuses the same Atlassian token scale as the landing page. */
const PROSE_CSS = `
.lp-wrap .lp-prose { max-width: 760px; padding-top: var(--s-800); padding-bottom: var(--s-1000); }
.lp-wrap .lp-prose-head { margin-bottom: var(--s-500); padding-bottom: var(--s-400); border-bottom: 1px solid var(--n30); }
.lp-wrap .lp-prose-head h1 { font-size: var(--h-xl); color: var(--n900); margin: 0 0 var(--s-150); }
.lp-wrap .lp-prose-head p { font-size: 1.0625rem; color: var(--n300); margin: 0; line-height: 1.6; }
.lp-wrap .lp-prose-meta { font-size: var(--fs-small); color: var(--n100); margin-top: var(--s-150); }
.lp-wrap .lp-prose h2 { font-size: var(--h-sm); color: var(--n900); margin: var(--s-500) 0 var(--s-150); }
.lp-wrap .lp-prose h3 { font-size: var(--h-xs); color: var(--n800); margin: var(--s-300) 0 var(--s-75); }
.lp-wrap .lp-prose p, .lp-wrap .lp-prose li { font-size: var(--fs-body); color: var(--n400); line-height: 1.75; }
.lp-wrap .lp-prose p { margin: 0 0 var(--s-200); }
.lp-wrap .lp-prose ul { margin: 0 0 var(--s-300); padding-left: 1.25em; }
.lp-wrap .lp-prose li { margin-bottom: var(--s-75); }
.lp-wrap .lp-prose strong { color: var(--n800); font-weight: 600; }
.lp-wrap .lp-prose a { color: var(--b500); }
.lp-wrap .lp-prose .lp-note { padding: var(--s-200) var(--s-300); border-radius: var(--r-3); background: var(--n10); border: 1px solid var(--n30); color: var(--n300); font-size: var(--fs-small); }
.lp-wrap .lp-prose .lp-note p { margin: 0; color: var(--n300); font-size: var(--fs-small); }
.lp-wrap .lp-back { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-small); color: var(--n200); margin-bottom: var(--s-300); }
`;

interface ContentPageProps {
  title: string;
  subtitle?: string;
  /** Optional small line under the subtitle (e.g. "Last updated May 2026"). */
  meta?: string;
  children: ReactNode;
}

/** Shared shell for static marketing/legal pages: slim nav, prose container,
 *  and the same footer as the landing page. Keeps each route file tiny. */
export function ContentPage({ title, subtitle, meta, children }: ContentPageProps) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS + PROSE_CSS }} />
      <ScrollToTop />

      <div className="lp-wrap">
        <nav className="nav">
          <div className="container nav-inner">
            <Link href="/" className="nav-brand">
              <span className="nav-brand-mark"><Logo variant="onDark" size={16} /></span>
              Arthvion
            </Link>

            <div className="nav-links">
              <Link href="/#components" className="nav-link">Product</Link>
              <Link href="/#how"        className="nav-link">How it works</Link>
              <Link href="/#pricing"    className="nav-link">Pricing</Link>
              <Link href="/login" className="btn btn-subtle">Sign in</Link>
              <Link href="/#cta"   className="btn btn-primary">Get started</Link>
            </div>
          </div>
        </nav>

        <main className="container lp-prose">
          <Link href="/" className="lp-back">← Back to home</Link>
          <div className="lp-prose-head">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
            {meta && <div className="lp-prose-meta">{meta}</div>}
          </div>
          {children}
        </main>

        <Footer />
      </div>
    </>
  );
}
