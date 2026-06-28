/**
 * Docs-page styles, scoped under `.lp-wrap` so they inherit the landing-page
 * design tokens (injected together with `_landing/css.ts` by docs/page.tsx).
 * Static data — allowed to exceed the 300-line logic budget.
 */
export const DOCS_CSS = `
.lp-wrap .docs-top {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 12px;
  height: 56px; padding: 0 24px;
  background: rgba(255,255,255,0.88);
  backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--n30);
}
.lp-wrap .docs-top-brand { display:inline-flex; align-items:center; gap:8px; font-weight:700; color:var(--n900); }
.lp-wrap .docs-top-brand:hover { text-decoration:none; }
.lp-wrap .docs-top-brand .mark {
  width:26px; height:26px; border-radius:6px;
  display:inline-flex; align-items:center; justify-content:center; background:var(--n900);
}
.lp-wrap .docs-top-tag {
  font-size: var(--fs-xs); color: var(--n200);
  padding:2px 8px; border:1px solid var(--n30); border-radius:999px;
}
.lp-wrap .docs-top-spacer { flex:1; }
.lp-wrap .docs-top-link { font-size: var(--fs-small); font-weight:600; color: var(--n300); }

.lp-wrap .docs-shell {
  max-width: 1140px; margin: 0 auto; padding: 36px 24px 120px;
  display: grid; grid-template-columns: 232px minmax(0,1fr); gap: 48px;
}
.lp-wrap .docs-side { position: sticky; top: 80px; align-self: start; max-height: calc(100vh - 100px); overflow:auto; }
.lp-wrap .docs-side-group { margin-bottom: 20px; }
.lp-wrap .docs-side-group h4 {
  margin:0 0 8px; font-size: var(--fs-eyebrow); text-transform:uppercase;
  letter-spacing:.06em; color: var(--n200); font-weight:700;
}
.lp-wrap .docs-side a {
  display:block; padding:5px 10px; border-radius: var(--r-2);
  font-size: var(--fs-small); color: var(--n300);
}
.lp-wrap .docs-side a:hover { background: var(--n10); text-decoration:none; color: var(--n800); }

.lp-wrap .docs-main { min-width:0; max-width: 760px; }
.lp-wrap .docs-main > h1 { font-size: var(--h-xl); letter-spacing:-.02em; margin:0 0 10px; color: var(--n900); }
.lp-wrap .docs-lead { font-size: 1.0625rem; color: var(--n200); margin:0 0 8px; line-height:1.6; }

.lp-wrap .docs-sec { scroll-margin-top: 80px; padding-top: 36px; margin-top: 36px; border-top: 1px solid var(--n20); }
.lp-wrap .docs-sec h2 { font-size: var(--h-md); letter-spacing:-.015em; margin:0 0 12px; color: var(--n900); }
.lp-wrap .docs-sec h3 { font-size: var(--h-xs); margin:24px 0 8px; color: var(--n800); }
.lp-wrap .docs-sec p { margin:0 0 14px; color: var(--n300); line-height:1.7; }
.lp-wrap .docs-sec ul, .lp-wrap .docs-sec ol { margin:0 0 14px; padding-left: 20px; color: var(--n300); line-height:1.7; }
.lp-wrap .docs-sec li { margin-bottom:6px; }
.lp-wrap .docs-sec strong { color: var(--n800); font-weight:600; }
.lp-wrap .docs-sec code {
  font-family:'JetBrains Mono',monospace; font-size:.82em;
  background: var(--n10); border:1px solid var(--n30); border-radius:4px; padding:1px 5px; color: var(--n800);
}

.lp-wrap .docs-tags { margin: 2px 0 14px; }
.lp-wrap .docs-tag {
  display:inline-flex; align-items:center; font-family:'JetBrains Mono',monospace;
  font-size: var(--fs-xs); color: var(--n200);
  background: var(--n10); border:1px solid var(--n30); border-radius:4px;
  padding:2px 7px; margin:0 4px 4px 0;
}

.lp-wrap .docs-note {
  display:flex; gap:10px; padding:13px 15px; border-radius: var(--r-3);
  margin:0 0 16px; font-size: var(--fs-small); line-height:1.6; color: var(--n400);
  background: var(--b50); border:1px solid var(--b75);
}
.lp-wrap .docs-note.warn { background: var(--y50); border-color:#F5E1A6; }
.lp-wrap .docs-note b { color: var(--n800); }

.lp-wrap ol.docs-steps { counter-reset: step; list-style:none; padding:0; margin:0 0 16px; }
.lp-wrap ol.docs-steps > li { position:relative; padding-left:38px; margin-bottom:14px; color: var(--n300); line-height:1.6; }
.lp-wrap ol.docs-steps > li::before {
  counter-increment: step; content: counter(step);
  position:absolute; left:0; top:-1px; width:26px; height:26px; border-radius:999px;
  background: var(--b500); color:#fff; font-size:13px; font-weight:700;
  display:inline-flex; align-items:center; justify-content:center;
}

.lp-wrap .docs-kbd {
  font-family:'JetBrains Mono',monospace; font-size:12px;
  background: var(--n10); border:1px solid var(--n30); border-radius:4px; padding:1px 6px; color: var(--n800);
}

.lp-wrap table.docs-table { width:100%; border-collapse:collapse; margin:0 0 16px; font-size: var(--fs-small); }
.lp-wrap table.docs-table th, .lp-wrap table.docs-table td {
  text-align:left; padding:9px 12px; border-bottom:1px solid var(--n20); vertical-align:top; color: var(--n300);
}
.lp-wrap table.docs-table th { color: var(--n800); font-weight:700; border-bottom:1px solid var(--n30); }
.lp-wrap table.docs-table td:first-child { color: var(--n800); font-weight:600; white-space:nowrap; }

@media (max-width: 880px) {
  .lp-wrap .docs-shell { grid-template-columns: 1fr; gap: 24px; }
  .lp-wrap .docs-side { position: static; max-height:none; }
}
`;
