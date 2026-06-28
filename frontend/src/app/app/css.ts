/**
 * Atlassian-inspired design tokens + component styles, scoped to `.af-app`.
 * Injected into <head> by page.tsx via dangerouslySetInnerHTML.
 *
 * Token scales:
 *   --n*  : neutrals (n0=white .. n900=near-black)
 *   --b*  : blue (primary brand)
 *   --g*  : green (success)  --r* : red (error)  --y* : yellow (warning)
 *   --p*  : purple           --t* : teal
 *   --s-* : spacing scale    --r-* : border-radius scale    --e* : elevation
 */
export const CSS = `
.af-app {
  --n0:#FFFFFF; --n10:#F7F8F9; --n20:#F1F2F4; --n30:#DCDFE4; --n40:#B3B9C4;
  --n50:#8590A2; --n100:#758195; --n200:#626F86; --n300:#44546F; --n400:#2C3E5D;
  --n800:#172B4D; --n900:#091E42;
  --b50:#E9F2FF; --b75:#CCE0FF; --b100:#85B8FF; --b300:#4C9AFF; --b400:#2684FF;
  --b500:#0C66E4; --b600:#0055CC; --b700:#08458C; --b900:#09326C;
  --g50:#DCFFF1; --g100:#BAF3DB; --g500:#1F845A; --g700:#216E4E;
  --r50:#FFEDEB; --r100:#FFD5D2; --r500:#C9372C; --r700:#AE2A19;
  --y50:#FFF7D6; --y100:#F8E6A0; --y500:#B65C02; --y700:#974F0C;
  --p50:#F3F0FF; --p100:#DFD8FD; --p500:#6E5DC6; --p700:#5E4DB2;
  --t50:#E7F9FF; --t100:#C6EDFB; --t500:#1D7F8C; --t700:#206A83;
  --r-1:3px; --r-2:6px; --r-3:8px; --r-4:12px;
  --e100:0 1px 1px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31);
  --e200:0 4px 8px -2px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31);
  --e300:0 8px 12px rgba(9,30,66,.15), 0 0 1px rgba(9,30,66,.31);
  --s-25:2px;--s-50:4px;--s-75:6px;--s-100:8px;--s-150:12px;--s-200:16px;
  --s-300:24px;--s-400:32px;--s-500:40px;--s-600:48px;--s-800:64px;

  /* ── Report-viewer semantic aliases ──
     ReportViewer + report/* + ui.tsx primitives were authored against the warm
     globals.css palette. We re-point those same token names at the cool
     Atlassian scale so the report inherits the dashboard's look. Scoped to
     .af-app only — landing/login keep the warm :root palette untouched. */
  --surface:var(--n0); --surface-2:var(--n10); --surface-3:var(--n20);
  --border:var(--n30); --border-strong:var(--n40); --hairline:#EBECF0;
  --ink:var(--n900); --ink-2:var(--n800); --ink-3:var(--n300);
  --ink-4:var(--n200); --ink-5:var(--n40);
  --brand:var(--b500); --brand-hover:var(--b600); --brand-deep:var(--b700);
  --brand-soft:var(--b50); --brand-tint:var(--b50); --brand-ink:var(--b900);
  --brand-glow:rgba(12,102,228,.15);
  --green:var(--g500); --green-soft:var(--g50); --green-ink:var(--g700);
  --amber:var(--y500); --amber-soft:var(--y50); --amber-ink:var(--y700);
  --red:var(--r500); --red-soft:var(--r50); --red-ink:var(--r700);
  --blue:var(--b500); --blue-soft:var(--b50); --blue-ink:var(--b900);
  --teal:var(--t500); --teal-soft:var(--t50); --teal-ink:var(--t700);
  --purple:var(--p500); --purple-soft:var(--p50); --purple-ink:var(--p700);
  --shadow-xs:0 1px 2px rgba(9,30,66,.06);
  --shadow-sm:0 1px 3px rgba(9,30,66,.10), 0 1px 2px rgba(9,30,66,.06);
  --shadow-md:0 4px 16px rgba(9,30,66,.12), 0 1px 3px rgba(9,30,66,.08);
  --shadow-lg:0 12px 36px rgba(9,30,66,.14), 0 2px 6px rgba(9,30,66,.10);
  --shadow-card:0 0 0 1px var(--n30), 0 2px 4px rgba(9,30,66,.06);
  --shadow-brand:0 4px 16px rgba(12,102,228,.26), 0 1px 4px rgba(12,102,228,.18);

  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  font-size:14px; line-height:1.5; color:var(--n800); background:var(--n10);
  height:100vh; overflow:hidden; display:flex; -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
.af-app *,.af-app *::before,.af-app *::after { box-sizing:border-box; }
.af-app .mono { font-family:'JetBrains Mono',ui-monospace,monospace; }
.af-app a { color:var(--b500); text-decoration:none; }
.af-app a:hover { text-decoration:underline; text-underline-offset:2px; }
.af-app button { font-family:inherit; cursor:pointer; }
.af-app input,.af-app textarea { font-family:inherit; }

/* ── Sidebar ── */
.af-app .sidebar {
  width:260px; flex-shrink:0; background:var(--n0);
  border-right:1px solid var(--n30);
  display:flex; flex-direction:column; height:100vh; overflow:hidden;
}
.af-app .sb-brand {
  display:flex; align-items:center; gap:var(--s-100);
  padding:var(--s-200); border-bottom:1px solid var(--n30);
  cursor:pointer; transition:background .12s;
}
.af-app .sb-brand:hover { background:var(--n10); }
.af-app .sb-mark {
  width:36px; height:36px; flex-shrink:0;
  background:linear-gradient(135deg,var(--b500) 0%,var(--b700) 100%);
  border-radius:var(--r-2); color:#fff;
  display:inline-flex; align-items:center; justify-content:center;
}
.af-app .sb-brand-text { flex:1; min-width:0; }
.af-app .sb-brand-name {
  font-size:14px; font-weight:700; color:var(--n900);
  letter-spacing:-0.01em; line-height:1.2;
}
.af-app .sb-brand-sub {
  font-size:11.5px; color:var(--n200); margin-top:2px;
}
.af-app .sb-chev { color:var(--n100); flex-shrink:0; }

.af-app .sb-search-wrap { padding:var(--s-150) var(--s-200); }
.af-app .sb-search {
  display:flex; align-items:center; gap:var(--s-75);
  width:100%; height:34px; padding:0 var(--s-100);
  background:var(--n20); border:1px solid transparent; border-radius:var(--r-2);
  font-size:12.5px; color:var(--n200);
  transition:background .12s, border-color .12s;
}
.af-app .sb-search:hover { background:var(--n30); }
.af-app .sb-search input {
  flex:1; border:none; background:transparent; outline:none;
  font-size:inherit; color:var(--n800); min-width:0;
}
.af-app .sb-search input::placeholder { color:var(--n200); }
.af-app .kbd {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:18px; height:18px; padding:0 5px;
  font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600;
  color:var(--n300); background:var(--n0);
  border:1px solid var(--n30); border-radius:var(--r-1); line-height:1;
}

.af-app .sb-nav {
  flex:1; overflow-y:auto; padding:var(--s-50) var(--s-100) var(--s-200);
}
.af-app .sb-nav::-webkit-scrollbar { width:6px; }
.af-app .sb-nav::-webkit-scrollbar-thumb { background:var(--n30); border-radius:3px; }
.af-app .sb-group-label {
  font-size:10.5px; font-weight:700; color:var(--n200);
  letter-spacing:0.08em; text-transform:uppercase;
  padding:var(--s-200) var(--s-100) var(--s-75);
}
.af-app .sb-item {
  display:flex; align-items:center; gap:var(--s-100);
  width:100%; padding:0 var(--s-100); height:32px;
  font-size:13px; font-weight:500; color:var(--n300);
  background:transparent; border:none; border-radius:var(--r-2);
  cursor:pointer; transition:background .1s, color .1s;
  text-align:left;
}
.af-app .sb-item:hover { background:var(--n10); color:var(--n800); }
.af-app .sb-item.active { background:var(--b50); color:var(--b600); font-weight:600; }
.af-app .sb-item.active .sb-icon-wrap { color:var(--b500); }
.af-app .sb-icon-wrap {
  display:inline-flex; flex-shrink:0; width:18px; align-items:center; justify-content:center;
  color:var(--n200);
}
.af-app .sb-item:hover .sb-icon-wrap { color:var(--n400); }
.af-app .sb-label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.af-app .sb-badge {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:18px; height:18px; padding:0 5px;
  font-size:10.5px; font-weight:700; color:var(--n200);
  background:var(--n20); border-radius:var(--r-1); line-height:1;
  flex-shrink:0;
}
.af-app .sb-badge.kbd-tone {
  color:var(--n300); background:var(--n0); border:1px solid var(--n30);
  font-family:'JetBrains Mono',monospace; font-weight:600;
}
.af-app .sb-badge.green { background:var(--g50); color:var(--g700); }
.af-app .sb-badge.blue { background:var(--b50); color:var(--b600); }

.af-app .sb-user {
  border-top:1px solid var(--n30); padding:var(--s-150) var(--s-200);
  display:flex; align-items:center; gap:var(--s-100);
  cursor:pointer; transition:background .12s;
}
.af-app .sb-user:hover { background:var(--n10); }
.af-app .sb-avatar {
  width:32px; height:32px; flex-shrink:0; border-radius:50%;
  background:linear-gradient(135deg,var(--b500),var(--b700)); color:#fff;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:700; letter-spacing:0.02em;
}
.af-app .sb-user-text { flex:1; min-width:0; }
.af-app .sb-user-name {
  font-size:13px; font-weight:600; color:var(--n900); line-height:1.2;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.af-app .sb-user-role {
  font-size:11px; color:var(--n200); margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* ── Main column ── */
.af-app .main-col {
  flex:1; display:flex; flex-direction:column; min-width:0; height:100vh;
}
.af-app .topbar {
  height:56px; flex-shrink:0; background:var(--n0);
  border-bottom:1px solid var(--n30);
  display:flex; align-items:center; gap:var(--s-150);
  padding:0 var(--s-300);
}
.af-app .tb-back {
  width:32px; height:32px; flex-shrink:0;
  display:inline-flex; align-items:center; justify-content:center;
  background:transparent; border:1px solid var(--n30); border-radius:var(--r-2);
  color:var(--n300); transition:background .1s, border-color .1s;
}
.af-app .tb-back:hover { background:var(--n10); border-color:var(--n40); color:var(--n800); }
.af-app .tb-crumbs {
  display:flex; align-items:center; gap:var(--s-100); font-size:13px; min-width:0;
}
.af-app .tb-crumb { color:var(--n300); }
.af-app .tb-crumb:hover { color:var(--b500); cursor:pointer; }
.af-app .tb-crumb.current { color:var(--n900); font-weight:600; cursor:default; }
.af-app .tb-crumb.current:hover { color:var(--n900); }
.af-app .tb-sep { color:var(--n40); flex-shrink:0; }
.af-app .tb-spacer { flex:1; }
.af-app .tb-status {
  display:inline-flex; align-items:center; gap:var(--s-75);
  height:28px; padding:0 var(--s-100);
  background:var(--n20); border-radius:var(--r-2);
  font-size:11px; font-weight:700; letter-spacing:0.06em;
  color:var(--n300);
}
.af-app .tb-status .dot {
  width:6px; height:6px; border-radius:50%; background:var(--n100);
}
.af-app .tb-status.running { background:var(--b50); color:var(--b700); }
.af-app .tb-status.running .dot { background:var(--b500); animation:af-pulse 1.4s ease-in-out infinite; }
.af-app .tb-status.complete { background:var(--g50); color:var(--g700); }
.af-app .tb-status.complete .dot { background:var(--g500); }
.af-app .tb-status.error { background:var(--r50); color:var(--r700); }
.af-app .tb-status.error .dot { background:var(--r500); }
.af-app .tb-icon-btn {
  width:32px; height:32px; flex-shrink:0;
  display:inline-flex; align-items:center; justify-content:center;
  background:transparent; border:1px solid var(--n30); border-radius:var(--r-2);
  color:var(--n300); transition:background .1s, border-color .1s, color .1s;
}
.af-app .tb-icon-btn:hover { background:var(--n10); color:var(--n800); border-color:var(--n40); }
.af-app .tb-signout {
  display:inline-flex; align-items:center; gap:var(--s-75);
  height:32px; padding:0 var(--s-150);
  font-size:12.5px; font-weight:500; color:var(--n300);
  background:transparent; border:none; border-radius:var(--r-2);
  transition:background .1s, color .1s;
}
.af-app .tb-signout:hover { background:var(--n10); color:var(--n800); }

/* ── Content ── */
.af-app .content {
  flex:1; overflow-y:auto;
}
.af-app .content::-webkit-scrollbar { width:8px; }
.af-app .content::-webkit-scrollbar-thumb { background:var(--n30); border-radius:4px; }
.af-app .content-inner {
  max-width:960px; margin:0 auto; padding:var(--s-500) var(--s-300) var(--s-800);
}

/* ── Page header ── */
.af-app .page-head {
  display:flex; align-items:flex-start; gap:var(--s-300); margin-bottom:var(--s-300);
}
.af-app .page-head-text { flex:1; min-width:0; }
.af-app .page-head-title {
  display:flex; align-items:center; gap:var(--s-150); margin-bottom:var(--s-100);
}
.af-app .page-head-title h1 {
  margin:0; font-size:28px; font-weight:700; color:var(--n900);
  letter-spacing:-0.02em; line-height:1.15;
}
.af-app .status-chip {
  display:inline-flex; align-items:center; height:22px; padding:0 var(--s-100);
  font-size:10.5px; font-weight:700; letter-spacing:0.08em;
  border-radius:var(--r-1); text-transform:uppercase;
}
.af-app .status-chip.draft { background:var(--p50); color:var(--p700); }
.af-app .status-chip.active { background:var(--g50); color:var(--g700); }
.af-app .page-head-sub {
  font-size:14px; color:var(--n300); margin:0; max-width:620px; line-height:1.55;
}
.af-app .page-head-actions {
  display:flex; align-items:center; gap:var(--s-100); flex-shrink:0;
}
.af-app .btn-secondary {
  display:inline-flex; align-items:center; gap:var(--s-75);
  height:32px; padding:0 var(--s-150);
  font-size:12.5px; font-weight:500; color:var(--n300);
  background:var(--n0); border:1px solid var(--n30); border-radius:var(--r-2);
  transition:background .1s, border-color .1s, color .1s;
}
.af-app .btn-secondary:hover { background:var(--n10); color:var(--n800); border-color:var(--n40); }

/* ── Info banner ── */
.af-app .banner {
  display:flex; align-items:flex-start; gap:var(--s-150);
  padding:var(--s-150) var(--s-200);
  background:var(--b50); border:1px solid var(--b100);
  border-left:3px solid var(--b500); border-radius:var(--r-2);
  margin-bottom:var(--s-300);
}
.af-app .banner-icon {
  flex-shrink:0; width:18px; height:18px; border-radius:50%;
  background:var(--b500); color:#fff;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:700; margin-top:1px;
}
.af-app .banner-text {
  flex:1; font-size:13px; color:var(--n800); line-height:1.5;
}
.af-app .banner-text strong { font-weight:700; color:var(--n900); }
.af-app .banner-text a { color:var(--b500); font-weight:600; }

/* ── Form card ── */
.af-app .card {
  background:var(--n0); border:1px solid var(--n30);
  border-radius:var(--r-3); overflow:hidden;
}
.af-app .card-pad { padding:var(--s-300); }
.af-app .field-label {
  display:block; font-size:12.5px; font-weight:600; color:var(--n800);
  margin-bottom:var(--s-100); letter-spacing:-0.005em;
}
.af-app .field-label .req { color:var(--r500); margin-left:2px; }

.af-app .input-row {
  display:flex; align-items:stretch;
  border:1.5px solid var(--n30); border-radius:var(--r-2); overflow:hidden;
  background:var(--n0); transition:border-color .12s, box-shadow .12s;
}
.af-app .input-row.focused {
  border-color:var(--b500);
  box-shadow:0 0 0 2px var(--b50);
}
.af-app .input-row .input-icon {
  display:inline-flex; align-items:center; justify-content:center;
  padding-left:var(--s-150); color:var(--n100); flex-shrink:0;
}
.af-app .input-row input.company {
  flex:1; min-width:0; height:48px; padding:0 var(--s-150);
  border:none; outline:none; background:transparent;
  font-size:15px; font-weight:500; color:var(--n900);
}
.af-app .input-row input.company::placeholder { color:var(--n100); }
.af-app .ticker-display {
  display:flex; align-items:center; gap:var(--s-100);
  padding:0 var(--s-200);
  border-left:1px solid var(--n30); background:var(--n10);
  flex-shrink:0;
}
.af-app .ticker-label {
  font-size:10px; font-weight:700; color:var(--n200);
  letter-spacing:0.1em;
}
.af-app .ticker-input {
  height:32px; width:74px; padding:0 var(--s-100);
  border:1px solid transparent; border-radius:var(--r-1);
  background:var(--n0); outline:none;
  font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700;
  color:var(--n900); letter-spacing:0.06em; text-align:center;
  text-transform:uppercase;
  transition:border-color .12s;
}
.af-app .ticker-input:hover { border-color:var(--n30); }
.af-app .ticker-input:focus { border-color:var(--b500); }

.af-app .field-help {
  font-size:12px; color:var(--n200); margin-top:var(--s-100);
}

.af-app .recent-row {
  display:flex; align-items:center; gap:var(--s-100);
  margin-top:var(--s-200); flex-wrap:wrap;
}
.af-app .recent-label {
  font-size:12px; color:var(--n200); font-weight:500;
}
.af-app .recent-chip {
  display:inline-flex; align-items:center; gap:var(--s-75);
  height:28px; padding:0 var(--s-100) 0 var(--s-150);
  background:var(--n10); border:1px solid var(--n30); border-radius:999px;
  font-size:12px; color:var(--n800); font-weight:500;
  transition:background .1s, border-color .1s;
}
.af-app .recent-chip:hover { background:var(--n20); border-color:var(--n40); }
.af-app .recent-chip .tick {
  font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700;
  color:var(--n200); background:var(--n0); padding:2px 6px;
  border-radius:var(--r-1); letter-spacing:0.05em;
}

/* ── Analysis scope ── */
.af-app .scope-head {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:var(--s-150);
}
.af-app .scope-list { display:flex; flex-direction:column; gap:var(--s-100); }
.af-app .agent-row {
  display:flex; align-items:center; gap:var(--s-200);
  padding:var(--s-150) var(--s-200);
  background:var(--n0); border:1.5px solid var(--n30);
  border-radius:var(--r-2);
  transition:border-color .12s, background .12s;
  text-align:left; width:100%;
}
.af-app .agent-row:hover { border-color:var(--n40); }
.af-app .agent-row.on { border-color:var(--b300); background:var(--n0); }
.af-app .check {
  width:18px; height:18px; flex-shrink:0; border-radius:var(--r-1);
  border:1.5px solid var(--n40); background:var(--n0);
  display:inline-flex; align-items:center; justify-content:center;
  transition:background .12s, border-color .12s;
}
.af-app .agent-row.on .check {
  background:var(--b500); border-color:var(--b500);
}
.af-app .check svg { color:#fff; opacity:0; transition:opacity .12s; }
.af-app .agent-row.on .check svg { opacity:1; }
.af-app .agent-icon {
  width:32px; height:32px; flex-shrink:0; border-radius:var(--r-2);
  display:inline-flex; align-items:center; justify-content:center;
}
.af-app .agent-icon.blue { background:var(--b50); color:var(--b500); }
.af-app .agent-icon.amber { background:var(--y50); color:var(--y500); }
.af-app .agent-icon.green { background:var(--g50); color:var(--g500); }
.af-app .agent-icon.teal { background:var(--t50); color:var(--t500); }
.af-app .agent-body { flex:1; min-width:0; }
.af-app .agent-title {
  display:flex; align-items:center; gap:var(--s-100); margin-bottom:2px;
}
.af-app .agent-name {
  font-size:13.5px; font-weight:700; color:var(--n900); letter-spacing:-0.005em;
}
.af-app .agent-badge {
  display:inline-flex; align-items:center; height:18px; padding:0 6px;
  font-size:9.5px; font-weight:700; letter-spacing:0.06em;
  background:var(--g50); color:var(--g700);
  border-radius:var(--r-1); text-transform:uppercase;
}
.af-app .agent-badge.off { background:var(--n20); color:var(--n200); }
.af-app .agent-desc {
  font-size:12.5px; color:var(--n300); display:flex; align-items:center; gap:var(--s-100);
  flex-wrap:wrap;
}
.af-app .src-chip {
  font-family:'JetBrains Mono',monospace; font-size:10.5px; font-weight:600;
  background:var(--n20); color:var(--n300); padding:1px 6px;
  border-radius:var(--r-1); letter-spacing:0.02em;
}
.af-app .agent-eta {
  font-family:'JetBrains Mono',monospace; font-size:11.5px; font-weight:600;
  color:var(--n200); flex-shrink:0;
}

.af-app .scope-foot {
  display:flex; align-items:center; justify-content:space-between;
  margin-top:var(--s-200);
}
.af-app .scope-count {
  font-size:12px; color:var(--n300); font-weight:500;
}

/* ── Optional context ── */
.af-app .context-wrap { padding:0 var(--s-300) var(--s-300); }
.af-app .context-area {
  width:100%; min-height:80px; padding:var(--s-150);
  border:1.5px solid var(--n30); border-radius:var(--r-2);
  background:var(--n0); outline:none;
  font-size:13.5px; color:var(--n800); line-height:1.55;
  resize:vertical; transition:border-color .12s, box-shadow .12s;
}
.af-app .context-area:focus { border-color:var(--b500); box-shadow:0 0 0 2px var(--b50); }
.af-app .context-area::placeholder { color:var(--n100); }

/* ── Submit footer ── */
.af-app .card-foot {
  display:flex; align-items:center; gap:var(--s-150);
  padding:var(--s-200) var(--s-300);
  border-top:1px solid var(--n30); background:var(--n10);
  flex-wrap:wrap;
}
.af-app .btn-primary {
  display:inline-flex; align-items:center; justify-content:center; gap:var(--s-100);
  height:38px; padding:0 var(--s-300);
  font-size:13.5px; font-weight:700; color:#fff;
  background:var(--b500); border:none; border-radius:var(--r-2);
  transition:background .1s, transform .1s;
  letter-spacing:-0.005em;
}
.af-app .btn-primary:hover:not(:disabled) { background:var(--b600); }
.af-app .btn-primary:active:not(:disabled) { transform:translateY(1px); }
.af-app .btn-primary:disabled {
  background:var(--n20); color:var(--n100); cursor:not-allowed;
}
.af-app .foot-meta {
  flex:1; display:flex; align-items:center; gap:var(--s-150); justify-content:flex-end;
  font-size:12px; color:var(--n200);
}
.af-app .foot-meta .est { font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--n300); }

/* ── Run-state UI (overrides for generating / loaded) ── */
.af-app .run-wrap { display:flex; flex-direction:column; gap:var(--s-200); }
.af-app .run-banner {
  display:flex; align-items:center; gap:var(--s-150);
  padding:var(--s-150) var(--s-200);
  background:var(--n0); border:1px solid var(--n30);
  border-left:3px solid var(--b500); border-radius:var(--r-2);
}
.af-app .run-banner-name {
  font-size:14px; font-weight:700; color:var(--n900); flex:1; min-width:0;
}
.af-app .run-banner-tick {
  font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700;
  color:var(--b600); background:var(--b50); padding:2px 6px;
  border-radius:var(--r-1); letter-spacing:0.05em;
}
.af-app .cancel-btn {
  display:inline-flex; align-items:center; gap:var(--s-75);
  height:30px; padding:0 var(--s-150);
  font-size:12px; font-weight:600; color:var(--n300);
  background:transparent; border:1px solid var(--n30); border-radius:var(--r-2);
  transition:background .1s, color .1s, border-color .1s;
}
.af-app .cancel-btn:hover { background:var(--r50); color:var(--r700); border-color:var(--r100); }

.af-app .status-pill {
  display:inline-flex; align-items:center; gap:var(--s-75);
  padding:var(--s-100) var(--s-150);
  background:var(--b50); color:var(--b700);
  border-radius:var(--r-2); font-size:13px; font-weight:500;
}
.af-app .pipeline {
  background:var(--n0); border:1px solid var(--n30); border-radius:var(--r-3);
  padding:var(--s-200);
}
.af-app .pipeline-head {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:var(--s-150);
}
.af-app .pipeline-title {
  font-size:14px; font-weight:700; color:var(--n900); letter-spacing:-0.005em;
}
.af-app .pipeline-bar {
  height:6px; background:var(--n20); border-radius:999px; overflow:hidden;
  margin-bottom:var(--s-200);
}
.af-app .pipeline-bar-fill {
  height:100%; background:var(--b500); border-radius:999px;
  transition:width .6s cubic-bezier(.2,.7,.3,1);
}
.af-app .pipeline-bar-fill.done { background:var(--g500); }
.af-app .agent-grid {
  display:grid; grid-template-columns:1fr 1fr; gap:var(--s-150);
}
@media (max-width:760px) { .af-app .agent-grid { grid-template-columns:1fr; } }
.af-app .agent-tile {
  background:var(--n0); border:1.5px solid var(--n30); border-radius:var(--r-2);
  padding:var(--s-150); display:flex; flex-direction:column; gap:var(--s-100);
}
.af-app .agent-tile.running { border-color:var(--b300); box-shadow:0 0 0 3px var(--b50); }
.af-app .agent-tile.done { border-color:var(--g100); }
.af-app .agent-tile.failed { border-color:var(--r100); }
.af-app .tile-head { display:flex; align-items:center; gap:var(--s-100); }
.af-app .tile-name { flex:1; font-size:12.5px; font-weight:700; color:var(--n900); }
.af-app .tile-state {
  display:inline-flex; align-items:center; gap:var(--s-50);
  padding:2px 7px; border-radius:var(--r-1);
  font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;
}
.af-app .tile-state.running { background:var(--b50); color:var(--b700); }
.af-app .tile-state.done { background:var(--g50); color:var(--g700); }
.af-app .tile-state.failed { background:var(--r50); color:var(--r700); }
.af-app .tile-state.waiting { background:var(--n20); color:var(--n200); }
.af-app .tile-state .dot { width:5px; height:5px; border-radius:50%; }
.af-app .tile-state.running .dot { background:var(--b500); animation:af-pulse 1.4s ease-in-out infinite; }
.af-app .tile-bar { height:4px; background:var(--n20); border-radius:999px; overflow:hidden; }
.af-app .tile-bar-fill {
  height:100%; border-radius:999px;
  transition:width .8s cubic-bezier(.2,.7,.3,1);
}
.af-app .tile-bar-fill.b { background:var(--b500); }
.af-app .tile-bar-fill.g { background:var(--g500); }
.af-app .tile-bar-fill.r { background:var(--r500); }
.af-app .tile-bar-fill.n { background:var(--n40); }
.af-app .tile-logs {
  background:var(--n10); border-radius:var(--r-1); padding:6px 8px;
  font-family:'JetBrains Mono',monospace; font-size:10px; line-height:1.5;
  color:var(--n300); max-height:50px; overflow:hidden;
}

/* ── Error banner ── */
.af-app .err-banner {
  display:flex; align-items:center; gap:var(--s-100);
  padding:var(--s-150) var(--s-200);
  background:var(--r50); border:1px solid var(--r100);
  border-left:3px solid var(--r500); border-radius:var(--r-2);
  font-size:13px; color:var(--r700);
}

/* ── Animations ── */
@keyframes af-pulse {
  0%,100% { opacity:1; }
  50% { opacity:0.4; }
}
@keyframes af-slide-up {
  from { opacity:0; transform:translateY(8px); }
  to { opacity:1; transform:translateY(0); }
}
.af-app .slide-up { animation:af-slide-up 0.35s ease-out; }

@media (max-width:880px) {
  .af-app .sidebar { display:none; }
  .af-app .content-inner { padding:var(--s-300) var(--s-200) var(--s-600); }
  .af-app .page-head { flex-direction:column; align-items:stretch; gap:var(--s-200); }
  .af-app .input-row { flex-wrap:wrap; }
  .af-app .ticker-display { width:100%; padding:var(--s-100) var(--s-200); border-left:none; border-top:1px solid var(--n30); }
}
`;
