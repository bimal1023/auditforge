import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AuditForge — Institutional diligence, on demand",
  description:
    "Four specialist agents synthesise SEC filings, market intelligence, and litigation records into an investment-grade memo with citations.",
};

/* ── CSS (Atlassian-inspired design system, scoped to .lp-wrap) ────────────── */
const CSS = `
:root {
  --n0:    #FFFFFF;
  --n10:   #F7F8F9;
  --n20:   #F1F2F4;
  --n30:   #DCDFE4;
  --n40:   #B3B9C4;
  --n50:   #8590A2;
  --n100:  #758195;
  --n200:  #626F86;
  --n300:  #44546F;
  --n400:  #2C3E5D;
  --n800:  #172B4D;
  --n900:  #091E42;
  --b50:   #E9F2FF;
  --b75:   #CCE0FF;
  --b100:  #85B8FF;
  --b300:  #4C9AFF;
  --b400:  #2684FF;
  --b500:  #0C66E4;
  --b600:  #0055CC;
  --b700:  #08458C;
  --b900:  #09326C;
  --g500:  #1F845A;
  --g50:   #DCFFF1;
  --r500:  #C9372C;
  --r50:   #FFEDEB;
  --y500:  #B65C02;
  --y50:   #FFF7D6;
  --p500:  #6E5DC6;
  --p50:   #F3F0FF;
  --t500:  #1D7F8C;
  --t50:   #E7F9FF;
  --h-xxl: clamp(2.625rem, 3.6vw + 1rem, 4.25rem);
  --h-xl:  clamp(2rem, 2.2vw + 1rem, 2.75rem);
  --h-lg:  1.8125rem;
  --h-md:  1.5rem;
  --h-sm:  1.25rem;
  --h-xs:  1rem;
  --fs-body:    0.9375rem;
  --fs-small:   0.8125rem;
  --fs-xs:      0.75rem;
  --fs-eyebrow: 0.6875rem;
  --r-1: 3px; --r-2: 6px; --r-3: 8px; --r-4: 12px;
  --e100: 0 1px 1px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31);
  --e200: 0 4px 8px -2px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31);
  --e300: 0 8px 12px rgba(9,30,66,.15), 0 0 1px rgba(9,30,66,.31);
  --s-25:2px;--s-50:4px;--s-75:6px;--s-100:8px;--s-150:12px;--s-200:16px;
  --s-300:24px;--s-400:32px;--s-500:40px;--s-600:48px;--s-800:64px;
  --s-1000:80px;--s-1200:96px;
}
.lp-wrap *, .lp-wrap *::before, .lp-wrap *::after { box-sizing: border-box; }
.lp-wrap {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: var(--fs-body);
  line-height: 1.5;
  color: var(--n800);
  background: var(--n0);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  scroll-behavior: smooth;
}
.lp-wrap .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-feature-settings: 'zero','ss01'; }
.lp-wrap .tnum { font-variant-numeric: tabular-nums; }
.lp-wrap a { color: var(--b500); text-decoration: none; }
.lp-wrap a:hover { text-decoration: underline; text-underline-offset: 2px; }
.lp-wrap button { font-family: inherit; }
.lp-wrap hr { border: none; border-top: 1px solid var(--n30); margin: 0; }

.lp-wrap .container { max-width: 1280px; margin: 0 auto; padding: 0 var(--s-300); }
@media (max-width: 768px) { .lp-wrap .container { padding: 0 var(--s-200); } }
.lp-wrap .section { padding: var(--s-1000) 0; }
.lp-wrap .section-tight { padding: var(--s-800) 0; }

.lp-wrap .eyebrow {
  display: inline-flex; align-items: center; gap: var(--s-100);
  font-size: var(--fs-eyebrow); font-weight: 600;
  color: var(--b500); letter-spacing: 0.08em; text-transform: uppercase;
}
.lp-wrap .eyebrow::before { content: ""; width: 14px; height: 1px; background: var(--b500); }
.lp-wrap h1, .lp-wrap h2, .lp-wrap h3, .lp-wrap h4, .lp-wrap h5 {
  color: var(--n900); font-weight: 600; letter-spacing: -0.015em; margin: 0;
}
.lp-wrap h1 { font-size: var(--h-xxl); line-height: 1.05; letter-spacing: -0.025em; }
.lp-wrap h2 { font-size: var(--h-xl);  line-height: 1.1;  letter-spacing: -0.02em; }
.lp-wrap h3 { font-size: var(--h-md);  line-height: 1.25; }
.lp-wrap h4 { font-size: var(--h-sm);  line-height: 1.3; }
.lp-wrap p  { color: var(--n300); }

/* Nav */
.lp-wrap .nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.92);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--n30);
}
.lp-wrap .nav-inner { display: flex; align-items: center; gap: var(--s-300); height: 56px; }
.lp-wrap .nav-brand {
  display: inline-flex; align-items: center; gap: var(--s-100);
  font-weight: 700; color: var(--n900); letter-spacing: -0.015em; font-size: 0.9375rem;
}
.lp-wrap .nav-brand:hover { text-decoration: none; }
.lp-wrap .nav-brand-mark {
  width: 24px; height: 24px;
  background: linear-gradient(135deg, var(--b500) 0%, var(--b700) 100%);
  border-radius: var(--r-1);
  display: inline-flex; align-items: center; justify-content: center; color: #fff;
}
.lp-wrap .nav-divider { width: 1px; height: 20px; background: var(--n30); }
.lp-wrap .nav-product { font-size: var(--fs-small); color: var(--n300); font-weight: 500; }
.lp-wrap .nav-links { display: flex; align-items: center; gap: var(--s-50); margin-left: auto; }
.lp-wrap .nav-link {
  display: inline-flex; align-items: center; gap: var(--s-75);
  height: 32px; padding: 0 var(--s-150);
  font-size: var(--fs-small); font-weight: 500; color: var(--n300);
  border-radius: var(--r-1); cursor: pointer; transition: background .12s, color .12s;
}
.lp-wrap .nav-link:hover { background: var(--n20); color: var(--n800); text-decoration: none; }
.lp-wrap .nav-link.active { background: var(--b50); color: var(--b600); }
.lp-wrap .nav-search {
  display: inline-flex; align-items: center; gap: var(--s-75);
  height: 32px; padding: 0 var(--s-150); width: 220px;
  background: var(--n20); border: 1px solid transparent; border-radius: var(--r-1);
  font-size: var(--fs-small); color: var(--n200); cursor: pointer;
  transition: background .12s, border-color .12s;
}
.lp-wrap .nav-search:hover { background: var(--n30); }
.lp-wrap .nav-search input { flex: 1; border: none; background: transparent; outline: none; font-size: inherit; color: var(--n800); }
.lp-wrap .kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 18px; padding: 0 4px;
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
  color: var(--n200); background: var(--n0); border: 1px solid var(--n30);
  border-radius: var(--r-1); line-height: 1;
}

/* Buttons */
.lp-wrap .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s-75);
  height: 32px; padding: 0 var(--s-150); border-radius: var(--r-1);
  font-family: inherit; font-size: var(--fs-small); font-weight: 500;
  cursor: pointer; transition: background .12s, color .12s, box-shadow .12s, border-color .12s;
  white-space: nowrap; letter-spacing: -0.005em; border: 1px solid transparent;
}
.lp-wrap .btn-md { height: 36px; padding: 0 var(--s-200); font-size: var(--fs-body); }
.lp-wrap .btn-lg { height: 44px; padding: 0 var(--s-300); font-size: var(--fs-body); }
.lp-wrap .btn-primary {
  background: var(--b500); color: #fff; border-color: var(--b500);
  box-shadow: 0 1px 0 rgba(255,255,255,.08) inset, 0 1px 1px rgba(9,30,66,.10);
}
.lp-wrap .btn-primary:hover { background: var(--b600); border-color: var(--b600); text-decoration: none; }
.lp-wrap .btn-secondary { background: var(--n20); color: var(--n800); }
.lp-wrap .btn-secondary:hover { background: var(--n30); text-decoration: none; }
.lp-wrap .btn-outline { background: var(--n0); color: var(--n800); border-color: var(--n30); }
.lp-wrap .btn-outline:hover { background: var(--n20); text-decoration: none; }
.lp-wrap .btn-subtle { background: transparent; color: var(--n300); }
.lp-wrap .btn-subtle:hover { background: var(--n20); color: var(--n800); text-decoration: none; }

/* Lozenges */
.lp-wrap .lozenge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; border-radius: var(--r-1); white-space: nowrap;
}
.lp-wrap .lozenge-default  { background: var(--n20);  color: var(--n400); }
.lp-wrap .lozenge-success  { background: var(--g50);  color: var(--g500); }
.lp-wrap .lozenge-removed  { background: var(--r50);  color: var(--r500); }
.lp-wrap .lozenge-inprog   { background: var(--b50);  color: var(--b600); }
.lp-wrap .lozenge-new      { background: var(--p50);  color: var(--p500); }
.lp-wrap .lozenge-moved    { background: var(--y50);  color: var(--y500); }
.lp-wrap .lozenge-bold-inprog   { background: var(--b500); color: #fff; }
.lp-wrap .lozenge-bold-success  { background: var(--g500); color: #fff; }

/* Hero */
.lp-wrap .hero {
  position: relative; padding: var(--s-1200) 0 var(--s-800);
  background:
    radial-gradient(1200px 600px at 80% -200px, var(--b50) 0%, transparent 60%),
    radial-gradient(1000px 500px at 10% 0%, #F0F4FE 0%, transparent 55%),
    var(--n0);
}
.lp-wrap .hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: var(--s-1000); align-items: center; }
@media (max-width: 1024px) { .lp-wrap .hero-grid { grid-template-columns: 1fr; gap: var(--s-600); } }
.lp-wrap .hero-eyebrow {
  display: inline-flex; align-items: center; gap: var(--s-100);
  padding: 4px 4px 4px 10px; background: var(--n0); border: 1px solid var(--n30);
  border-radius: 999px; font-size: var(--fs-small); color: var(--n300); box-shadow: var(--e100);
}
.lp-wrap .hero h1 { margin-top: var(--s-300); }
.lp-wrap .hero h1 .accent { color: var(--b500); }
.lp-wrap .hero p.lead {
  margin-top: var(--s-300); font-size: 1.0625rem; line-height: 1.6;
  color: var(--n300); max-width: 540px;
}
.lp-wrap .hero-actions { display: flex; gap: var(--s-150); margin-top: var(--s-400); flex-wrap: wrap; }
.lp-wrap .hero-meta { display: flex; gap: var(--s-300); margin-top: var(--s-500); flex-wrap: wrap; }
.lp-wrap .hero-meta-item { display: flex; flex-direction: column; gap: 2px; }
.lp-wrap .hero-meta-num { font-size: 1.5rem; font-weight: 700; color: var(--n900); letter-spacing: -0.02em; line-height: 1; }
.lp-wrap .hero-meta-label { font-size: var(--fs-small); color: var(--n200); }

/* Viz card */
.lp-wrap .viz-card { background: #fff; border: 1px solid var(--n30); border-radius: var(--r-3); box-shadow: var(--e200); overflow: hidden; }
.lp-wrap .viz-head {
  display: flex; align-items: center; gap: var(--s-150); padding: var(--s-150) var(--s-200);
  background: var(--n10); border-bottom: 1px solid var(--n30);
}
.lp-wrap .viz-head-dots { display: inline-flex; gap: 6px; }
.lp-wrap .viz-head-dots span { width: 10px; height: 10px; border-radius: 999px; background: var(--n30); }
.lp-wrap .viz-tabs { display: flex; gap: var(--s-50); margin-left: var(--s-200); }
.lp-wrap .viz-tab { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 11px; color: var(--n300); font-weight: 500; border-radius: var(--r-1); }
.lp-wrap .viz-tab.active { background: #fff; color: var(--n800); box-shadow: 0 0 0 1px var(--n30); }
.lp-wrap .viz-body { padding: var(--s-300); display: flex; flex-direction: column; gap: var(--s-300); }
.lp-wrap .viz-score-row { display: flex; align-items: center; gap: var(--s-300); }
.lp-wrap .viz-score {
  width: 80px; height: 80px; border-radius: 999px; flex-shrink: 0;
  background: conic-gradient(var(--g500) 0% 74%, var(--n20) 74% 100%);
  display: inline-flex; align-items: center; justify-content: center; position: relative;
}
.lp-wrap .viz-score::after { content: ""; position: absolute; inset: 8px; background: #fff; border-radius: 999px; }
.lp-wrap .viz-score-num { position: relative; z-index: 1; font-size: 1.5rem; font-weight: 700; color: var(--n900); letter-spacing: -0.02em; }
.lp-wrap .viz-score-info h4 { font-size: var(--h-sm); margin: 0; }
.lp-wrap .viz-score-info .row { display: flex; align-items: center; gap: var(--s-100); margin-top: 4px; }
.lp-wrap .viz-score-info .row .ticker { font-family: 'JetBrains Mono',monospace; font-size: 11px; font-weight: 600; color: var(--n300); padding: 2px 6px; background: var(--n20); border-radius: var(--r-1); }
.lp-wrap .viz-agents { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-100); }
.lp-wrap .viz-agent { display: flex; align-items: center; gap: var(--s-100); padding: var(--s-100) var(--s-150); background: var(--n10); border: 1px solid var(--n30); border-radius: var(--r-2); }
.lp-wrap .viz-agent-icon { width: 24px; height: 24px; background: #fff; border: 1px solid var(--n30); border-radius: var(--r-1); display: inline-flex; align-items: center; justify-content: center; color: var(--n300); }
.lp-wrap .viz-agent-name { flex: 1; font-size: 12px; font-weight: 600; color: var(--n800); }
.lp-wrap .viz-agent-bar { width: 60px; height: 4px; background: var(--n30); border-radius: 999px; overflow: hidden; }
.lp-wrap .viz-agent-bar > span { display: block; height: 100%; background: var(--g500); border-radius: 999px; }
.lp-wrap .viz-finding { padding: var(--s-200); background: var(--b50); border: 1px solid var(--b75); border-radius: var(--r-2); font-size: var(--fs-small); color: var(--n800); line-height: 1.55; }
.lp-wrap .viz-finding sup { color: var(--b600); font-weight: 600; font-family: 'JetBrains Mono',monospace; font-size: 10px; background: #fff; padding: 1px 4px; border-radius: var(--r-1); border: 1px solid var(--b75); margin-left: 2px; }
.lp-wrap .viz-float { position: absolute; background: #fff; border: 1px solid var(--n30); border-radius: var(--r-2); box-shadow: var(--e200); padding: var(--s-100) var(--s-150); display: flex; align-items: center; gap: var(--s-100); font-size: var(--fs-small); }
.lp-wrap .viz-float-1 { top: -16px; right: -16px; }
.lp-wrap .viz-float-2 { bottom: 16px; left: -24px; }
@media (max-width: 1024px) { .lp-wrap .viz-float { display: none; } }

/* Logo row */
.lp-wrap .logo-row { display: flex; align-items: center; justify-content: space-between; gap: var(--s-400); flex-wrap: wrap; margin-top: var(--s-600); padding-top: var(--s-400); border-top: 1px solid var(--n30); }
.lp-wrap .logo-row-label { font-size: var(--fs-small); color: var(--n200); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.lp-wrap .logo-mark { font-size: 1.125rem; font-weight: 700; color: var(--n200); letter-spacing: -0.02em; opacity: .85; }

/* Section head */
.lp-wrap .section-head { max-width: 720px; margin-bottom: var(--s-600); }
.lp-wrap .section-head h2 { margin-top: var(--s-150); }
.lp-wrap .section-head p.lead { margin-top: var(--s-200); font-size: 1.0625rem; line-height: 1.55; color: var(--n300); }

/* Component cards */
.lp-wrap .comp-group { margin-bottom: var(--s-500); }
.lp-wrap .comp-group h3 { font-size: var(--h-md); margin-bottom: var(--s-300); }
.lp-wrap .comp-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--s-200); }
@media (max-width: 1024px) { .lp-wrap .comp-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 640px)  { .lp-wrap .comp-grid { grid-template-columns: 1fr; } }
.lp-wrap .comp-card {
  display: block; padding: var(--s-300); background: #fff; border: 1px solid var(--n30);
  border-radius: var(--r-3); transition: border-color .15s, box-shadow .15s;
  cursor: pointer; position: relative;
}
.lp-wrap .comp-card:hover { border-color: var(--b500); box-shadow: var(--e200); text-decoration: none; }
.lp-wrap .comp-card-head { display: flex; align-items: flex-start; gap: var(--s-150); margin-bottom: var(--s-150); }
.lp-wrap .comp-card-icon { width: 36px; height: 36px; background: var(--b50); border-radius: var(--r-2); display: inline-flex; align-items: center; justify-content: center; color: var(--b500); flex-shrink: 0; }
.lp-wrap .comp-card-icon-amber  { background: var(--y50); color: var(--y500); }
.lp-wrap .comp-card-icon-green  { background: var(--g50); color: var(--g500); }
.lp-wrap .comp-card-icon-teal   { background: var(--t50); color: var(--t500); }
.lp-wrap .comp-card-icon-purple { background: var(--p50); color: var(--p500); }
.lp-wrap .comp-card-icon-red    { background: var(--r50); color: var(--r500); }
.lp-wrap .comp-card h4 { font-size: 1rem; font-weight: 600; color: var(--n900); letter-spacing: -0.01em; }
.lp-wrap .comp-card p { margin: 0; font-size: var(--fs-small); color: var(--n300); line-height: 1.5; }
.lp-wrap .comp-card-meta { display: flex; align-items: center; gap: var(--s-100); margin-top: var(--s-150); font-family: 'JetBrains Mono',monospace; font-size: 11px; color: var(--n200); }
.lp-wrap .comp-card .arrow { position: absolute; top: var(--s-300); right: var(--s-300); width: 16px; height: 16px; color: var(--n100); opacity: 0; transition: opacity .15s, color .15s; }
.lp-wrap .comp-card:hover .arrow { opacity: 1; color: var(--b500); }

/* How it works */
.lp-wrap .how-row { display: grid; grid-template-columns: repeat(4,1fr); gap: var(--s-300); margin-top: var(--s-500); }
@media (max-width: 1024px) { .lp-wrap .how-row { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 640px)  { .lp-wrap .how-row { grid-template-columns: 1fr; } }
.lp-wrap .how-step { position: relative; padding: var(--s-300); background: var(--n10); border: 1px solid var(--n30); border-radius: var(--r-3); }
.lp-wrap .how-step-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: var(--b500); color: #fff; font-family: 'JetBrains Mono',monospace; font-size: 12px; font-weight: 700; margin-bottom: var(--s-200); }
.lp-wrap .how-step h4 { font-size: 1rem; margin: 0 0 4px; }
.lp-wrap .how-step p { margin: 0; font-size: var(--fs-small); color: var(--n300); line-height: 1.55; }
.lp-wrap .how-step .meta { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--s-150); font-size: 11px; color: var(--n200); font-family: 'JetBrains Mono',monospace; }

/* Output */
.lp-wrap .output { background: var(--n10); padding: var(--s-1000) 0; border-top: 1px solid var(--n30); border-bottom: 1px solid var(--n30); }
.lp-wrap .output-grid { display: grid; grid-template-columns: .85fr 1fr; gap: var(--s-600); align-items: start; margin-top: var(--s-400); }
@media (max-width: 1024px) { .lp-wrap .output-grid { grid-template-columns: 1fr; } }
.lp-wrap .output-side { position: sticky; top: 80px; }
.lp-wrap .output-tabs { display: flex; gap: var(--s-50); margin-bottom: var(--s-300); border-bottom: 2px solid var(--n30); }
.lp-wrap .output-tab { display: inline-flex; align-items: center; gap: 6px; padding: var(--s-150) 0; margin-right: var(--s-300); background: transparent; border: none; font-size: var(--fs-small); font-weight: 500; color: var(--n300); border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; transition: color .12s, border-color .12s; }
.lp-wrap .output-tab.active { color: var(--b500); border-bottom-color: var(--b500); font-weight: 600; }
.lp-wrap .output-tab:hover:not(.active) { color: var(--n800); }
.lp-wrap .output-keys { display: flex; flex-direction: column; gap: var(--s-150); margin-top: var(--s-300); }
.lp-wrap .output-key { display: flex; align-items: flex-start; gap: var(--s-150); padding: var(--s-150); border-radius: var(--r-2); background: transparent; border: 1px solid transparent; }
.lp-wrap .output-key:hover { background: #fff; border-color: var(--n30); }
.lp-wrap .output-key-num { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 999px; background: var(--b500); color: #fff; font-family: 'JetBrains Mono',monospace; font-size: 12px; font-weight: 700; }
.lp-wrap .output-key-text { flex: 1; font-size: var(--fs-small); color: var(--n400); line-height: 1.55; }
.lp-wrap .output-key-text b { color: var(--n900); font-weight: 600; }

/* Doc */
.lp-wrap .doc { background: #fff; border: 1px solid var(--n30); border-radius: var(--r-3); box-shadow: var(--e100); padding: var(--s-500) var(--s-500) var(--s-600); }
.lp-wrap .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: var(--s-300); border-bottom: 1px solid var(--n30); gap: var(--s-300); }
.lp-wrap .doc-title h3 { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.015em; }
.lp-wrap .doc-title .sub { display: flex; align-items: center; gap: var(--s-100); margin-top: 4px; font-size: var(--fs-small); color: var(--n200); }
.lp-wrap .doc-title .ticker { font-family: 'JetBrains Mono',monospace; background: var(--n20); padding: 2px 6px; border-radius: var(--r-1); font-size: 11px; font-weight: 600; color: var(--n400); }
.lp-wrap .doc-score-mini { display: inline-flex; align-items: center; gap: var(--s-100); padding: 6px 10px; background: var(--g50); border: 1px solid var(--g500); border-radius: var(--r-2); color: var(--g500); font-weight: 700; font-size: var(--fs-small); }
.lp-wrap .doc-score-mini .num { font-size: 1.125rem; }
.lp-wrap .doc-section { padding-top: var(--s-400); }
.lp-wrap .doc-eyebrow { font-size: 10px; font-weight: 700; color: var(--b500); letter-spacing: .1em; text-transform: uppercase; margin-bottom: var(--s-100); }
.lp-wrap .doc-h { margin: 0 0 var(--s-200); font-size: 1.125rem; font-weight: 600; color: var(--n900); letter-spacing: -0.01em; }
.lp-wrap .doc-p { margin: 0 0 var(--s-150); font-size: 14px; line-height: 1.65; color: var(--n400); }
.lp-wrap .doc-p sup { color: var(--b600); font-weight: 600; font-family: 'JetBrains Mono',monospace; font-size: 10px; background: var(--b50); padding: 1px 4px; border-radius: var(--r-1); border: 1px solid var(--b75); margin-left: 2px; cursor: pointer; }
.lp-wrap .doc-callout { display: flex; gap: var(--s-150); padding: var(--s-200); background: var(--b50); border-radius: var(--r-2); border-left: 3px solid var(--b500); font-size: 13px; margin: var(--s-150) 0; }
.lp-wrap .doc-callout b { color: var(--n900); font-weight: 600; }
.lp-wrap .doc-table { width: 100%; border-collapse: collapse; margin-top: var(--s-150); font-size: 13px; }
.lp-wrap .doc-table th, .lp-wrap .doc-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--n30); }
.lp-wrap .doc-table th { background: var(--n10); font-weight: 600; color: var(--n300); font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
.lp-wrap .doc-table .mono { color: var(--n800); font-weight: 500; }
.lp-wrap .doc-table .ch { color: var(--g500); font-weight: 600; }
.lp-wrap .doc-table .ch.neg { color: var(--r500); }

/* Pricing */
.lp-wrap .pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--s-300); margin-top: var(--s-500); }
@media (max-width: 1024px) { .lp-wrap .pricing-grid { grid-template-columns: 1fr; } }
.lp-wrap .price-card { background: #fff; border: 1px solid var(--n30); border-radius: var(--r-3); padding: var(--s-400); display: flex; flex-direction: column; gap: var(--s-200); }
.lp-wrap .price-card.featured { border-color: var(--b500); box-shadow: 0 0 0 1px var(--b500), var(--e200); }
.lp-wrap .price-card-head { display: flex; align-items: center; justify-content: space-between; }
.lp-wrap .price-card h4 { margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--n900); }
.lp-wrap .price-card .price { display: flex; align-items: baseline; gap: 4px; }
.lp-wrap .price-card .price .num { font-size: 2.5rem; font-weight: 700; color: var(--n900); letter-spacing: -0.025em; line-height: 1; }
.lp-wrap .price-card .price .unit { font-size: var(--fs-small); color: var(--n200); }
.lp-wrap .price-card p.desc { margin: 0; font-size: var(--fs-small); color: var(--n300); }
.lp-wrap .price-card hr { margin: var(--s-100) 0; }
.lp-wrap .price-card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--s-100); }
.lp-wrap .price-card li { display: flex; gap: var(--s-100); font-size: var(--fs-small); color: var(--n400); line-height: 1.5; }
.lp-wrap .price-card li svg { flex-shrink: 0; margin-top: 3px; color: var(--g500); }

/* CTA strip */
.lp-wrap .cta-strip {
  padding: var(--s-1000) 0;
  background: radial-gradient(800px 400px at 20% 20%, var(--b50) 0%, transparent 50%),
    radial-gradient(800px 400px at 80% 80%, #F0F4FE 0%, transparent 50%), var(--n0);
}
.lp-wrap .cta-card { display: flex; flex-direction: column; align-items: center; gap: var(--s-300); text-align: center; padding: var(--s-800) var(--s-400); background: #fff; border: 1px solid var(--n30); border-radius: var(--r-4); box-shadow: var(--e100); max-width: 900px; margin: 0 auto; }
.lp-wrap .cta-card h2 { max-width: 640px; }

/* Footer */
.lp-wrap .footer { background: var(--n900); color: rgba(255,255,255,.7); padding: var(--s-1000) 0 var(--s-400); }
.lp-wrap .footer a { color: rgba(255,255,255,.7); }
.lp-wrap .footer a:hover { color: #fff; }
.lp-wrap .footer-grid { display: grid; grid-template-columns: 1.4fr repeat(4,1fr); gap: var(--s-400); }
@media (max-width: 1024px) { .lp-wrap .footer-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px)  { .lp-wrap .footer-grid { grid-template-columns: 1fr; } }
.lp-wrap .footer-brand { display: flex; flex-direction: column; gap: var(--s-200); }
.lp-wrap .footer-brand p { font-size: var(--fs-small); color: rgba(255,255,255,.55); max-width: 280px; line-height: 1.55; margin: 0; }
.lp-wrap .footer-col-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.85); letter-spacing: .08em; text-transform: uppercase; margin-bottom: var(--s-200); }
.lp-wrap .footer-links { display: flex; flex-direction: column; gap: var(--s-100); font-size: var(--fs-small); }
.lp-wrap .footer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: var(--s-600); padding-top: var(--s-300); border-top: 1px solid rgba(255,255,255,.10); font-size: 11px; color: rgba(255,255,255,.40); letter-spacing: .02em; }
.lp-wrap .footer-bottom .links { display: flex; gap: var(--s-200); }
.lp-wrap .footer-brand .nav-brand { color: #fff; }
.lp-wrap .footer-brand .nav-brand-mark { background: rgba(255,255,255,.10); }
`;

/* ── SVG icon helpers ─────────────────────────────────────────────────────── */
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);
const IconCheck = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const IconFinancial = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 5-5" />
  </svg>
);
const IconRisk = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z" /><path d="M12 8v4M12 16h.01" />
  </svg>
);
const IconMarket = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
const IconLegal = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M5 7h14M5 7l-3 8a4 4 0 0 0 6 0zM19 7l3 8a4 4 0 0 1-6 0z" />
  </svg>
);
const IconBolt = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
  </svg>
);
const IconClock = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
  </svg>
);

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lp-wrap">

        {/* ── NAV ──────────────────────────────────────────────────────── */}
        <nav className="nav">
          <div className="container nav-inner">
            <a href="#" className="nav-brand">
              <span className="nav-brand-mark"><IconBolt size={14} /></span>
              AuditForge
            </a>
            <span className="nav-divider" />
            <span className="nav-product">Vantage</span>

            <div className="nav-links">
              <a href="#components" className="nav-link active">Product</a>
              <a href="#how"        className="nav-link">How it works</a>
              <a href="#output"     className="nav-link">The output</a>
              <a href="#pricing"    className="nav-link">Pricing</a>

              <label className="nav-search" style={{ marginLeft: 12 }}>
                <IconSearch />
                <input type="text" placeholder="Search docs…" />
                <span className="kbd">⌘K</span>
              </label>

              <Link href="/login" className="btn btn-subtle">Sign in</Link>
              <a href="#cta" className="btn btn-primary">Get started</a>
            </div>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <header className="hero">
          <div className="container">
            <div className="hero-grid">

              {/* Left copy */}
              <div>
                <span className="hero-eyebrow">
                  <span className="lozenge lozenge-bold-inprog">New</span>
                  v4 — agent orchestration is live
                  <span style={{ marginLeft: 4, color: 'var(--n100)', display: 'inline-flex' }}><IconChevronRight /></span>
                </span>

                <h1>
                  Institutional diligence,<br />
                  <span className="accent">on demand.</span>
                </h1>

                <p className="lead">
                  Four specialist agents pull SEC filings, market intelligence, and litigation records
                  in parallel — then synthesise a single sourced memo. The work that used to take a junior
                  analyst two days finishes in about three minutes.
                </p>

                <div className="hero-actions">
                  <a href="#cta" className="btn btn-primary btn-lg">
                    Start free trial <IconArrow />
                  </a>
                  <a href="#output" className="btn btn-outline btn-lg">
                    <IconEye /> See a live memo
                  </a>
                </div>

                <div className="hero-meta">
                  {[
                    { num: "2:47",  label: "Median run time" },
                    { num: "38",    label: "Avg. citations per memo" },
                    { num: "94%",   label: "Analyst-grade pass rate" },
                    { num: "SOC 2", label: "Type II · tenant-isolated" },
                  ].map((m) => (
                    <div className="hero-meta-item" key={m.label}>
                      <span className="hero-meta-num tnum">{m.num}</span>
                      <span className="hero-meta-label">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: live report mockup */}
              <div style={{ position: "relative" }}>
                <div className="viz-card">
                  <div className="viz-head">
                    <div className="viz-head-dots"><span /><span /><span /></div>
                    <div className="viz-tabs">
                      <span className="viz-tab active">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                        AAPL · Memo
                      </span>
                      <span className="viz-tab">NVDA</span>
                      <span className="viz-tab">+ New</span>
                    </div>
                  </div>

                  <div className="viz-body">
                    <div className="viz-score-row">
                      <div className="viz-score"><span className="viz-score-num tnum">7.4</span></div>
                      <div className="viz-score-info">
                        <h4>Apple Inc.</h4>
                        <div className="row">
                          <span className="ticker">AAPL</span>
                          <span className="lozenge lozenge-success">Buy</span>
                          <span style={{ fontSize: 12, color: 'var(--n200)' }}>· generated 2m 47s ago</span>
                        </div>
                      </div>
                    </div>

                    <div className="viz-agents">
                      {[
                        { icon: <IconFinancial size={12} />, name: "Financial", pct: "100%" },
                        { icon: <IconRisk size={12} />,      name: "Risk",      pct: "100%" },
                        { icon: <IconMarket size={12} />,   name: "Market",    pct: "100%" },
                        { icon: <IconLegal size={12} />,    name: "Legal",     pct: "100%" },
                      ].map((a) => (
                        <div className="viz-agent" key={a.name}>
                          <span className="viz-agent-icon">{a.icon}</span>
                          <span className="viz-agent-name">{a.name}</span>
                          <span className="viz-agent-bar"><span style={{ width: a.pct }} /></span>
                        </div>
                      ))}
                    </div>

                    <div className="viz-finding">
                      <b>Services moat continues to compound:</b> revenue up 16% YoY to $24.2B,
                      now 28% of total revenue<sup>3</sup>. Gross margin expanded 280 bps<sup>4</sup>,
                      offsetting iPhone unit softness in Greater China<sup>11</sup>.
                    </div>
                  </div>
                </div>

                <div className="viz-float viz-float-1">
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--g500)', display: 'inline-block' }} />
                  <b style={{ color: 'var(--n900)', fontWeight: 600 }}>All 4 agents complete</b>
                </div>
                <div className="viz-float viz-float-2">
                  <span style={{ color: 'var(--b500)', display: 'inline-flex' }}><IconCheck size={13} /></span>
                  <span><b style={{ color: 'var(--n900)', fontWeight: 600 }}>38 citations</b> · all traceable</span>
                </div>
              </div>
            </div>

            {/* Logo row */}
            <div className="logo-row">
              <span className="logo-row-label">Trusted by analysts at</span>
              {["Northbridge Capital", "Sequoia Heritage", "Generation IM", "Glenview & Co.", "Atlas Pacific", "Carlyle MAS"].map((l) => (
                <span className="logo-mark" key={l}>{l}</span>
              ))}
            </div>
          </div>
        </header>

        {/* ── COMPONENTS ───────────────────────────────────────────────── */}
        <section className="section" id="components">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">What's inside</span>
              <h2>Every piece of an analyst's stack, reusable.</h2>
              <p className="lead">
                AuditForge ships as a set of composable agents and surfaces. Combine them into the
                workflow you already run — or use the full investment-memo template as-is.
              </p>
            </div>

            {/* Specialist agents */}
            <div className="comp-group">
              <h3>Specialist agents</h3>
              <div className="comp-grid">
                {[
                  {
                    icon: <IconFinancial />, iconCls: "",
                    title: "Financial",
                    desc: "Pulls 10-K, 10-Q, and earnings transcripts. Computes margin trajectory, segment trends, and cash-flow durability with every figure traced to source.",
                    meta: "SEC EDGAR · XBRL · ~38s avg",
                  },
                  {
                    icon: <IconRisk />, iconCls: "comp-card-icon-amber",
                    title: "Risk",
                    desc: "Distils Item 1A and 8-K filings into material-risk vectors. Flags going-concern language, customer-concentration, and supply-chain exposure.",
                    meta: "Item 1A · 8-K · ~42s avg",
                  },
                  {
                    icon: <IconMarket />, iconCls: "comp-card-icon-green",
                    title: "Market",
                    desc: "Sizes TAM and share against named competitors. Threads industry reports, IDC/Gartner refs, and public signals into a single competitive map.",
                    meta: "Web · IDC · industry refs · ~31s avg",
                  },
                  {
                    icon: <IconLegal />, iconCls: "comp-card-icon-teal",
                    title: "Legal & Regulatory",
                    desc: "Cross-references PACER litigation, DOJ/FTC actions, and IP filings. Surfaces antitrust exposure and pending settlements likely to move the thesis.",
                    meta: "PACER · DOJ · FTC · USPTO · ~48s avg",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>,
                    iconCls: "comp-card-icon-purple",
                    title: "Synthesis",
                    titleExtra: <span className="lozenge lozenge-new" style={{ marginLeft: 6 }}>Beta</span>,
                    desc: "Reconciles the four specialist outputs into a single ranked memo. Resolves conflicting evidence, scores conviction, and outputs the final 0–10.",
                    meta: "Reasoning · cross-check · ~22s avg",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
                    iconCls: "comp-card-icon-red",
                    title: "Private & Custom",
                    titleExtra: <span className="lozenge lozenge-inprog" style={{ marginLeft: 6 }}>Enterprise</span>,
                    desc: "Run the same orchestration against your own document corpus. Agents cite your data rooms, fund memos, and CRM notes alongside public sources.",
                    meta: "Tenant-isolated · BYOK · SOC 2 II",
                  },
                ].map((c) => (
                  <a href="#" className="comp-card" key={c.title}>
                    <div className="comp-card-head">
                      <span className={`comp-card-icon ${c.iconCls}`}>{c.icon}</span>
                      <div>
                        <h4>{c.title}{c.titleExtra}</h4>
                      </div>
                    </div>
                    <p>{c.desc}</p>
                    <div className="comp-card-meta">{c.meta}</div>
                    <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Surfaces */}
            <div className="comp-group" style={{ marginTop: 'var(--s-800)' }}>
              <h3>Surfaces</h3>
              <div className="comp-grid">
                {[
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>,
                    iconCls: "", title: "Investment memo",
                    desc: "The default output: an ~8-page sourced memo with thesis, financials, risks, and a 0–10 conviction score. Every claim is hyperlinked to source.",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M3 9h18M9 17v4M15 17v4" /></svg>,
                    iconCls: "comp-card-icon-amber", title: "One-pager",
                    desc: "The same data, distilled to a printable single page. Designed for IC pre-reads and committee distribution. Auto-fits portrait or landscape.",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
                    iconCls: "comp-card-icon-purple", title: "Slide deck",
                    desc: "A 12-slide pitch built from the same memo — exportable to PowerPoint or Google Slides with editable shapes and your firm's template applied.",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>,
                    iconCls: "comp-card-icon-teal", title: "API & webhooks",
                    desc: "Trigger runs from your CRM, watchlist tooling, or research workflow. JSON output, signed citations, webhook callbacks on completion.",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
                    iconCls: "comp-card-icon-green", title: "Live monitor",
                    desc: "Re-run any memo on a schedule. Get a Slack flag when a material change in filings, litigation, or news flips the conviction score.",
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
                    iconCls: "comp-card-icon-red", title: "Reviewer workflow",
                    desc: "Route memos to a senior reviewer for sign-off before they land in the portfolio system. Comment threads, redlines, and version history included.",
                  },
                ].map((c) => (
                  <a href="#" className="comp-card" key={c.title}>
                    <div className="comp-card-head">
                      <span className={`comp-card-icon ${c.iconCls}`}>{c.icon}</span>
                      <div><h4>{c.title}</h4></div>
                    </div>
                    <p>{c.desc}</p>
                    <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section className="section section-tight" id="how" style={{ background: 'var(--n10)', borderTop: '1px solid var(--n30)', borderBottom: '1px solid var(--n30)' }}>
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">How it works</span>
              <h2>Brief once. Dispatch four agents.</h2>
              <p className="lead">
                The same workflow your firm runs already, compressed into the time it takes to read a CIM cover page.
              </p>
            </div>

            <div className="how-row">
              {[
                { n: "01", title: "Brief",            icon: <IconClock />, time: "< 30s",     desc: "Type a company, paste a ticker, or import from your watchlist. Add an optional thesis to steer the agents." },
                { n: "02", title: "Dispatch",          icon: <IconBolt size={11} />, time: "~2m 30s", desc: "Four agents fan out in parallel against SEC, market, legal, and risk sources. Progress streams live." },
                { n: "03", title: "Synthesise",        icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>, time: "~22s", desc: "A synthesis pass reconciles the four outputs, scores conviction 0–10, and writes the final memo with citations." },
                { n: "04", title: "Review & ship",     icon: <IconCheck size={11} />, time: "Your turn", desc: "Read in-app, route for sign-off, or export to memo / one-pager / slide deck — your template applied." },
              ].map((s) => (
                <div className="how-step" key={s.n}>
                  <span className="how-step-num">{s.n}</span>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                  <span className="meta">{s.icon}{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── OUTPUT PREVIEW ───────────────────────────────────────────── */}
        <section className="output" id="output">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">The output</span>
              <h2>An analyst-grade memo, every time.</h2>
              <p className="lead">
                Not a summary. Not a bulleted blob. A real investment memo with structure, evidence, and a single defensible conclusion.
              </p>
            </div>

            <div className="output-grid">
              <aside className="output-side">
                <div className="output-tabs">
                  {["Memo", "One-pager", "Slide deck", "JSON"].map((t) => (
                    <button key={t} className={`output-tab${t === "Memo" ? " active" : ""}`}>{t}</button>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--fs-small)', color: 'var(--n300)', lineHeight: 1.6, margin: '0 0 var(--s-300)' }}>
                  The default deliverable. Eight pages, structured: thesis, financial picture, risk register, market position, legal exposure, and a defended conviction score.
                </p>
                <div className="output-keys">
                  {[
                    { n: "01", text: <><b>Every claim is citable.</b> Hover any superscript to jump to the source paragraph in the underlying filing.</> },
                    { n: "02", text: <><b>Conviction, not vibes.</b> The 0–10 score is the synthesis agent's calibrated output, with confidence intervals shown on hover.</> },
                    { n: "03", text: <><b>Adversarial review built in.</b> Each finding is cross-checked against the strongest opposing source before it lands in the memo.</> },
                    { n: "04", text: <><b>Exportable everywhere.</b> Native PDF, .docx, PowerPoint, Google Slides, and a typed JSON for downstream tooling.</> },
                  ].map((k) => (
                    <div className="output-key" key={k.n}>
                      <span className="output-key-num">{k.n}</span>
                      <div className="output-key-text">{k.text}</div>
                    </div>
                  ))}
                </div>
              </aside>

              <article className="doc">
                <div className="doc-header">
                  <div className="doc-title">
                    <h3>Apple Inc.</h3>
                    <div className="sub">
                      <span className="ticker">AAPL</span>
                      <span>NASDAQ · Large Cap · Consumer Electronics</span>
                    </div>
                  </div>
                  <div className="doc-score-mini">
                    <span className="num tnum">7.4</span>
                    <span>/ 10 · Buy</span>
                  </div>
                </div>

                <div className="doc-section">
                  <div className="doc-eyebrow">§ 1 · Thesis</div>
                  <h4 className="doc-h">Services moat continues to compound on a healthy hardware base.</h4>
                  <p className="doc-p">
                    Apple's services segment grew 16.3% YoY to $24.2B, now 28% of total revenue<sup>3</sup>, with gross margin expanding 280 basis points to 74.0%<sup>4</sup>. The services flywheel is increasingly compounding on the installed base rather than on net-new hardware units<sup>7</sup>.
                  </p>
                  <div className="doc-callout">
                    <IconInfo />
                    <div>
                      <b>Cross-check:</b> The 16.3% YoY services figure reconciles to{" "}
                      <a href="#">10-Q § Item 1</a>, and is corroborated by the{" "}
                      <a href="#">FY24 Q3 earnings transcript</a>.
                    </div>
                  </div>
                </div>

                <div className="doc-section">
                  <div className="doc-eyebrow">§ 2 · Segment trajectory</div>
                  <table className="doc-table">
                    <thead>
                      <tr><th>Segment</th><th>FY23</th><th>FY24E</th><th className="mono">YoY</th><th className="mono">Mix</th></tr>
                    </thead>
                    <tbody>
                      {[
                        ["iPhone",            "200.6", "201.9", "+0.6%",  "52%",  false],
                        ["Services",          "85.2",  "99.1",  "+16.3%", "26%",  false],
                        ["Mac",               "29.4",  "29.9",  "+1.7%",  "8%",   false],
                        ["iPad",              "28.3",  "25.1",  "−11.3%", "7%",   true ],
                        ["Wearables & Other", "39.8",  "37.0",  "−7.0%",  "7%",   true ],
                      ].map(([seg, fy23, fy24, yoy, mix, neg]) => (
                        <tr key={String(seg)}>
                          <td>{seg}</td>
                          <td className="mono">{fy23}</td>
                          <td className="mono">{fy24}</td>
                          <td className={`ch${neg ? " neg" : ""}`}>{yoy}</td>
                          <td className="mono">{mix}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="doc-section">
                  <div className="doc-eyebrow">§ 3 · Key risks</div>
                  <p className="doc-p">
                    Two material risks dominate. <b>Antitrust:</b> the DOJ&apos;s pending action targets the App Store revenue model directly<sup>22</sup>; remedy outcomes could compress services margin by 200–400 bps in the bear case<sup>24</sup>. <b>China concentration:</b> Greater China still represents 17% of revenue<sup>30</sup>, with iPhone unit softness in the region partially offset by services subscription growth<sup>33</sup>.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────── */}
        <section className="section" id="pricing">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Pricing</span>
              <h2>Pay per memo. Or per analyst.</h2>
              <p className="lead">
                Three tiers, no per-seat trickery. Start free; upgrade only when your firm starts to depend on it.
              </p>
            </div>

            <div className="pricing-grid">
              {/* Solo */}
              <div className="price-card">
                <div className="price-card-head">
                  <h4>Solo</h4>
                  <span className="lozenge lozenge-default">Free trial</span>
                </div>
                <div className="price">
                  <span className="num tnum">$0</span>
                  <span className="unit">/ first 5 memos</span>
                </div>
                <p className="desc">For a single analyst kicking the tyres. No card required.</p>
                <hr />
                <ul>
                  {["5 memos / month", "All 4 specialist agents", "PDF + Markdown export", "Community support"].map((f) => (
                    <li key={f}><IconCheck />  {f}</li>
                  ))}
                </ul>
                <a href="#" className="btn btn-outline btn-md" style={{ marginTop: "auto" }}>Start free</a>
              </div>

              {/* Desk — featured */}
              <div className="price-card featured">
                <div className="price-card-head">
                  <h4>Desk</h4>
                  <span className="lozenge lozenge-bold-inprog">Most popular</span>
                </div>
                <div className="price">
                  <span className="num tnum">$1,200</span>
                  <span className="unit">/ month · per desk</span>
                </div>
                <p className="desc">For an investment team. Unlimited memos, full export suite, watchlist monitoring.</p>
                <hr />
                <ul>
                  {["Unlimited memos", "Memo + one-pager + slide deck", "Watchlist monitoring + Slack alerts", "Reviewer workflow & redlines", "API + webhooks"].map((f) => (
                    <li key={f}><IconCheck />  {f}</li>
                  ))}
                </ul>
                <a href="#" className="btn btn-primary btn-md" style={{ marginTop: "auto" }}>Start 14-day trial</a>
              </div>

              {/* Firm */}
              <div className="price-card">
                <div className="price-card-head">
                  <h4>Firm</h4>
                  <span className="lozenge lozenge-new">Enterprise</span>
                </div>
                <div className="price">
                  <span className="num tnum">Custom</span>
                </div>
                <p className="desc">For institutional firms. Private corpus, SSO, dedicated tenancy, BYOK.</p>
                <hr />
                <ul>
                  {["Everything in Desk", "Private document corpus", "SAML SSO + SCIM", "Dedicated tenancy + BYOK", "Named CSM, 99.95% SLA"].map((f) => (
                    <li key={f}><IconCheck />  {f}</li>
                  ))}
                </ul>
                <a href="#" className="btn btn-outline btn-md" style={{ marginTop: "auto" }}>Contact sales</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="cta-strip" id="cta">
          <div className="container">
            <div className="cta-card">
              <span className="eyebrow">Ready to dispatch your first run?</span>
              <h2>The next time you need a memo,<br />don&apos;t write one.</h2>
              <p className="lead" style={{ maxWidth: 560, textAlign: "center" }}>
                Start with five free runs. No credit card. Memos arrive in your inbox in under three minutes.
              </p>
              <div style={{ display: "flex", gap: "var(--s-150)", flexWrap: "wrap", justifyContent: "center" }}>
                <Link href="/login" className="btn btn-primary btn-lg">
                  Start free <IconArrow />
                </Link>
                <a href="#" className="btn btn-outline btn-lg">Book a 20-min demo</a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-200)", color: "var(--n200)", fontSize: "var(--fs-small)", marginTop: "var(--s-100)" }}>
                {["No credit card", "5 free runs", "SOC 2 Type II"].map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <IconCheck size={12} /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer className="footer">
          <div className="container">
            <div className="footer-grid">
              <div className="footer-brand">
                <a href="#" className="nav-brand">
                  <span className="nav-brand-mark"><IconBolt size={14} /></span>
                  AuditForge
                </a>
                <p>Institutional diligence, on demand. Built for analysts who need to be right, with the receipts to prove it.</p>
              </div>

              {[
                {
                  title: "Product",
                  links: [["Agents","#components"],["Surfaces","#components"],["How it works","#how"],["The output","#output"],["Pricing","#pricing"],["Changelog","#"]],
                },
                {
                  title: "Resources",
                  links: [["Documentation","#"],["API reference","#"],["Methodology paper","#"],["Sample memos","#"],["Status","#"]],
                },
                {
                  title: "Company",
                  links: [["About","#"],["Customers","#"],["Security","#"],["Careers","#"],["Contact","#"]],
                },
                {
                  title: "Legal",
                  links: [["Terms","#"],["Privacy","#"],["SOC 2 report","#"],["DPA","#"],["Trademark","#"]],
                },
              ].map((col) => (
                <div key={col.title}>
                  <div className="footer-col-title">{col.title}</div>
                  <div className="footer-links">
                    {col.links.map(([label, href]) => (
                      <a key={label} href={href}>{label}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="footer-bottom">
              <span>© 2026 AuditForge, Inc. · Vantage is a research product, not investment advice.</span>
              <div className="links">
                <a href="#">Terms</a>
                <a href="#">Privacy</a>
                <a href="#">License</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
