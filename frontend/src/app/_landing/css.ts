/**
 * Atlassian-inspired design tokens + landing page styles, scoped to `.lp-wrap`.
 * Injected into <head> by page.tsx via dangerouslySetInnerHTML.
 */
export const CSS = `
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
/* Nav responsive */
@media (max-width: 900px) {
  .lp-wrap .nav-search { display: none; }
  .lp-wrap .nav-divider, .lp-wrap .nav-product { display: none; }
}
@media (max-width: 768px) {
  .lp-wrap .nav-links a:not(.btn) { display: none; }
  .lp-wrap .nav-inner { gap: var(--s-150); }
}
@media (max-width: 480px) {
  .lp-wrap .nav-links .btn-subtle { display: none; }
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
@media (max-width: 768px) {
  .lp-wrap .hero { padding: var(--s-600) 0 var(--s-500); }
  .lp-wrap .section { padding: var(--s-600) 0; }
  .lp-wrap .section-tight { padding: var(--s-500) 0; }
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
  position: relative;
}
.lp-wrap .comp-card:hover { border-color: var(--n40); box-shadow: var(--e100); }
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
.lp-wrap .output-side { /* natural flow — the right card is the sticky element */ }
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
.lp-wrap .doc {
  background: #fff; border: 1px solid var(--n30); border-radius: var(--r-3);
  box-shadow: var(--e100); padding: var(--s-500) var(--s-500) var(--s-600);
  position: sticky; top: 96px; align-self: start;
  max-height: calc(100vh - 120px); overflow-y: auto;
}
.lp-wrap .doc::-webkit-scrollbar { width: 6px; }
.lp-wrap .doc::-webkit-scrollbar-thumb { background: var(--n30); border-radius: 3px; }
.lp-wrap .doc::-webkit-scrollbar-thumb:hover { background: var(--n40); }
@media (max-width: 1024px) {
  .lp-wrap .doc { position: static; max-height: none; overflow: visible; }
}
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
.lp-wrap .price-card {
  background: #fff; border: 1px solid var(--n30); border-radius: var(--r-3);
  padding: var(--s-400); display: flex; flex-direction: column; gap: var(--s-200);
  transition: transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s ease, border-color .15s ease;
  will-change: transform;
}
.lp-wrap .price-card:hover {
  transform: translateY(-6px);
  border-color: var(--n40);
  box-shadow: 0 18px 32px -12px rgba(9,30,66,.18), 0 4px 8px -3px rgba(9,30,66,.10);
}
.lp-wrap .price-card.featured { border-color: var(--b500); box-shadow: 0 0 0 1px var(--b500), var(--e200); }
.lp-wrap .price-card.featured:hover {
  transform: translateY(-8px);
  box-shadow: 0 0 0 1px var(--b500), 0 22px 40px -14px rgba(12,102,228,.32), 0 6px 12px -4px rgba(12,102,228,.18);
}
.lp-wrap .price-card .btn { transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .2s ease; }
.lp-wrap .price-card:hover .btn.btn-outline { border-color: var(--n400); color: var(--n900); }
.lp-wrap .price-card:hover .btn.btn-primary { box-shadow: 0 8px 18px -6px rgba(12,102,228,.45); }
.lp-wrap .price-card li svg { transition: transform .25s cubic-bezier(.2,.7,.3,1); }
.lp-wrap .price-card:hover li svg { transform: scale(1.15); }
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
