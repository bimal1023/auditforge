# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Arthvion

Multi-agent PE due diligence platform. An orchestrator agent (claude-opus-4-7) delegates to specialist agents in parallel; each specialist connects to dedicated MCP servers for data sourcing.

## Commands

**One-command launcher (recommended for local dev):**
```bash
./dev.sh   # boots postgres+redis, backend, celery worker + beat, frontend in one shot
```
The script activates `.venv`, starts Docker for `postgres`+`redis`, runs uvicorn on `:8000`, runs **two Celery processes** (worker + beat scheduler), and runs `npm run dev` on `:3000`. Ctrl+C tears everything down. Logs go to `/tmp/arthvion-{backend,worker,beat,frontend}.log`.

For **Stripe webhook testing** in local dev:
1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe` (macOS) or follow https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:8000/api/v1/billing/webhook`
3. Copy the signing secret printed by Stripe CLI
4. Add to `infra/.env`: `STRIPE_WEBHOOK_SECRET=<secret>`

**Backend (run from repo root):**
```bash
# Install deps + make `backend` and `mcp_servers` importable (do this once)
pip install -e . -r backend/requirements.txt

# Activate the venv (it lives at repo root, NOT inside backend/)
source .venv/bin/activate

# Start API server (in terminal 1)
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Start the Celery worker (in terminal 2 — required, agents run inside Celery, not the API)
celery -A backend.core.celery_app worker --loglevel=info --concurrency=1

# Start the Celery beat scheduler (in terminal 3 — triggers periodic watchlist scans)
celery -A backend.core.celery_app beat --loglevel=info

# Run a single MCP server directly (stdio transport for debugging)
python mcp_servers/sec_edgar/server.py
python mcp_servers/web_search/server.py
python mcp_servers/file_ingest/server.py

# Syntax-check all Python files
python3 -c "import ast, pathlib; [ast.parse(f.read_text()) for f in pathlib.Path('.').rglob('*.py')]"
```

**Frontend (from `frontend/`):**
```bash
npm install
npm run dev          # http://localhost:3000
npm run type-check   # tsc --noEmit  — run before considering any TS change done
npm run build
```

**Infrastructure:**
```bash
# Start postgres (pgvector) + redis only
docker compose -f infra/docker-compose.yml up postgres redis

# Full stack
docker compose -f infra/docker-compose.yml up
```

**Environment:** Copy `infra/.env.example` → `infra/.env` and fill in `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`. `pydantic-settings` loads from `infra/.env` relative to the working directory, so always run from repo root.

## Architecture

### Backend request flow
```
POST /api/v1/reports
  → cache lookup (TTL: settings.report_cache_ttl_hours)
      → HIT: bump record.updated_at, return 200 + cached DueDiligenceReport
      → MISS: create ReportRecord, dispatch Celery task → return 202 + {id}
  → Celery task (run_report)
  → Orchestrator (claude-opus-4-7) — runs specialists in PARALLEL via asyncio.gather()
      ├── FinancialAgent (claude-sonnet-4-6) ─── SEC EDGAR MCP
      ├── RiskAgent      (claude-sonnet-4-6) ─── SEC EDGAR + web-search MCP
      ├── MarketAgent    (claude-sonnet-4-6) ─── web-search MCP
      └── LegalAgent     (claude-sonnet-4-6) ─── SEC EDGAR + web-search MCP
  → Synthesis prompt → executive_summary + overall_score
  → DueDiligenceReport persisted to PostgreSQL
  → Redis pub/sub publishes per-agent progress events
GET /api/v1/reports                → ReportStatusResponse[] (ordered by updated_at.desc)
GET /api/v1/reports/{id}/events    → SSE stream (browser gets live progress)
GET /api/v1/reports/{id}/event-log → Replay of past events from Redis stream
GET /api/v1/reports/{id}           → final report JSON
GET /api/v1/reports/{id}/pdf       → PDF download
DELETE /api/v1/reports/{id}        → cancels running task + deletes record

POST   /api/v1/documents      → upload PDF/CSV/XLSX/DOCX/PPTX/TXT (multipart/form-data, file field)
GET    /api/v1/documents      → list user's documents (used by UploadDocument mount fetch)
DELETE /api/v1/documents/{id} → remove document
```

### Cache TTL behavior (important — confuses people)
`create_report` first looks for an existing **complete** report for the same `(user_id, company)` within `report_cache_ttl_hours`. On a hit it:
1. Touches `record.updated_at = now()` so the cached row bubbles to the top of `GET /reports`
2. Returns HTTP **200** with the full cached `DueDiligenceReport` (vs 202 + `{id}` when running fresh)

The frontend dashboard branches on `createRes.status === 200` and skips SSE entirely. To force a fresh run, send `force_refresh: true` in the request body — not yet exposed in the UI.

### Hook lifecycle (every agent call)
`InputNormalizationHook.pre_run` → `PolicyEnforcementHook.pre_run` → `AuditLoggingHook.pre_run` → **agentic loop** → `OutputValidationHook.post_run` → `AuditLoggingHook.post_run` → `PolicyEnforcementHook.post_run`

`HookContext` (dataclass in `backend/hooks/base.py`) is the mutable bag passed through all hooks. It carries `normalized_input`, `raw_output`, `validated_output`, `tool_calls`, and `policy_violations`.

### MCP servers
Each server is a standalone Python script using `FastMCP` (from the `mcp` package) with stdio transport. Agents connect by spawning a subprocess via `MCPClient` (`backend/agents/_mcp_client.py`), which wraps the `mcp.ClientSession` and converts MCP tool schemas to Anthropic's `input_schema` format.

`MCPClient.anthropic_tools()` → list of Anthropic-format tool dicts
`MCPClient.call_tool(name, args)` → JSON string for `tool_result` content block

**Data-source servers and which agent uses each:**

| Server (`mcp_servers/…`) | Tools | Used by | Key (env) |
|---|---|---|---|
| `sec_edgar` | `search_company`, `get_filing_list`, `get_latest_filing`, `get_recent_8k_filings`, `get_company_facts` (XBRL), `get_filing_text` | Financial, Risk, Legal | `SEC_EDGAR_USER_AGENT` (required) |
| `web_search` | `search_web` (Tavily) | Financial, Risk, Market, Legal | `TAVILY_API_KEY` (required) |
| `fred` | `search_economic_series`, `get_series_observations` | Market | `FRED_API_KEY` (optional) |
| `courtlistener` | `search_court_cases` (RECAP dockets) | Legal | `COURTLISTENER_API_TOKEN` (optional) |
| `opensanctions` | `screen_sanctions` (sanctions/PEP) | Legal | `OPENSANCTIONS_API_KEY` (optional) |
| `pgvector_rag` | `similarity_search` (+ hidden write/delete) | all specialists (via `_rag.py`) | scoped by `WORKSPACE_SCOPE` |

`FMP_API_KEY` is **not** an agent data source — it powers the standalone Comps (`comps_routes.py`), Screener (`screener_routes.py`), and Earnings (`earnings_routes.py` + the `mcp_servers/earnings` server) features, which call FMP's `/stable/` API directly. Those routes hard-require the key (return 503 without it). It was briefly wired into the Financial agent but removed — agents rely on SEC XBRL, which works for private companies too.

The three optional sources (FRED, CourtListener, OpenSanctions) **degrade gracefully**: each server imports and spawns even with no key, and its tools return an `{"error": …}` dict at call time rather than raising — so a missing key never breaks a report run. Keys are passed to subprocesses explicitly via each agent's `agent_mcp(..., base_env={...})` (the `_SAFE_ENV_KEYS` whitelist in `_mcp_client.py` only covers `os.environ` forwarding). **If you add a new data-source server, it MUST import cleanly without its key**, or `MultiMCPClient.__aenter__` will fail and take down the whole agent.

**pgvector_rag is best-effort, not fatal.** The upload route at `backend/api/upload_routes.py` wraps the `ingest_document` MCP call in `try/except Exception`. If the pgvector subprocess crashes (common — sentence-transformers can segfault, PG connection may fail), the upload still succeeds with `chunks_ingested=0` and logs a warning. Retrieval **is** wired into the agent pipeline: `backend/agents/_rag.py` (`agent_mcp`) bolts the pgvector server onto each specialist agent's MCP client, exposes the read-only `similarity_search` tool (write/delete tools hidden via `_HIDDEN_RAG_TOOLS`), and scopes it to the calling workspace server-side via the `WORKSPACE_SCOPE` env var. It falls back to base-servers-only if pgvector won't spawn, so RAG can never break core SEC/web analysis.

**file_ingest macOS symlink gotcha.** `_ALLOWED_DIRS` in `mcp_servers/file_ingest/server.py` resolves each candidate path via `Path(d).resolve()` so that `/var/folders/…` matches the symlinked `/private/var/folders/…`. Without this, uploads fail with "Access denied: path must be inside a temp directory" on macOS — the file lands in a tempdir whose resolved path doesn't match the unresolved allowed list. If you touch `_ALLOWED_DIRS`, keep the `.resolve()` call.

### Agent agentic loop pattern
All four specialist agents follow the same pattern:
1. Run pre-run hooks on `HookContext`
2. Open `MCPClient` as async context manager
3. Loop: `messages.create(tools=mcp.anthropic_tools())` → if `stop_reason == "tool_use"`, execute all tool blocks, append `tool_result` messages, continue; if `end_turn`, break
4. Parse the final text block as JSON into the section Pydantic model
5. Run post-run hooks; return `ctx.validated_output`

`MAX_ITERATIONS = 12` caps runaway loops.

### Data contracts
All monetary values are **raw floats in USD** — never strings. Every section model (`FinancialSection`, `RiskSection`, etc.) requires a non-empty `citations` list enforced by both a Pydantic `field_validator` and `OutputValidationHook`. `confidence_score` is `0.0–1.0`.

## Frontend architecture

### Routes (Next.js App Router)
| Path | File | Purpose |
|------|------|---------|
| `/` | `src/app/page.tsx` | Public landing page (marketing, pricing) |
| `/app` | `src/app/app/page.tsx` | Authed dashboard — the whole product lives here |
| `/login` | `src/app/login/page.tsx` | Sign in / sign up. Has "← Back to home" link to `/` |

`src/app/layout.tsx` is intentionally minimal (no body `overflow: hidden`) so the landing page can scroll. The dashboard manages its own viewport with `height: 100vh; overflow: hidden` on its root `<div>`.

Directories starting with `_` (e.g. `src/app/_landing/`) are **not routes** — Next.js App Router treats `_*` as private folders. Use them for page-local internals.

### Directory layout (production split — none of the top-level files exceed ~300 lines)
```
src/app/
├── page.tsx                   ← landing (43 lines, composes sections)
├── layout.tsx                 ← root layout (no body overflow:hidden)
│
├── _landing/                  ← landing-page internals (private; not a route)
│   ├── css.ts                 ← Atlassian-inspired tokens + styles, scoped to .lp-wrap
│   ├── icons.tsx              ← all inline SVG icon components
│   └── sections/
│       ├── Nav.tsx            ← top nav with brand, links, Sign-in / Get-started
│       ├── Hero.tsx           ← headline, CTAs, stats, mock report card
│       ├── Components.tsx     ← Specialist agents + Surfaces card grids
│       ├── HowItWorks.tsx     ← 4-step pipeline explainer
│       ├── Output.tsx         ← "Apple memo" preview with sticky right card
│       ├── Pricing.tsx        ← Solo / Desk / Firm cards
│       ├── CTA.tsx            ← end-of-page conversion strip
│       └── Footer.tsx         ← dark footer with link columns
│
├── app/                       ← /app dashboard
│   ├── page.tsx               ← orchestration only (auth, ⌘K, tab state, mobile branch)
│   ├── css.ts                 ← .af-app scoped CSS string
│   ├── types.ts               ← AgentKey, AgentTone, AgentStatus, NavTab, RunStatus, Phase
│   ├── constants.ts           ← AGENT_DEFS, AGENT_LABEL, TAB_LABELS, TAB_PARENT, RECENTS
│   ├── components/
│   │   ├── Sidebar.tsx        ← left rail nav (with NavItem subcomponent)
│   │   ├── Topbar.tsx         ← breadcrumb + status pill + icon buttons + sign-out
│   │   ├── NewReportForm.tsx  ← company input, ticker, scope, context, submit
│   │   ├── RunPipeline.tsx    ← run banner + progress + AgentTile grid
│   │   ├── TeamView.tsx       ← team members, invites, workspace admin
│   │   ├── UpgradeGate.tsx    ← paywall prompt for Desk/Firm-only features
│   │   └── ComingSoon.tsx     ← placeholder for unbuilt tabs (citations only)
│   └── hooks/
│       └── useReportRun.ts    ← all the report-run lifecycle: SSE → poll → backfill → land
│
└── login/                     ← /login
    ├── page.tsx               ← thin (17 lines): BrandPanel + AuthForm
    ├── css.ts                 ← responsive layout + spin/pulse keyframes
    ├── icons.tsx              ← LogoMark, GoogleIcon, SSOIcon
    └── components/
        ├── BrandPanel.tsx     ← dark left panel (hidden <880px)
        ├── AuthForm.tsx       ← SSO + email/password form, owns auth state
        └── Field.tsx          ← Field + InputWrapper + inputCss

src/components/                ← cross-page shared components
├── ReportViewer.tsx           ← header + tabs (composes report/ subsections)
├── report/                    ← one file per report section
│   ├── SectionHeader.tsx      ← reused at top of each tab
│   ├── CitationFooter.tsx     ← source chip row at bottom of each tab
│   ├── Financial.tsx          ← table + sparklines + key ratios
│   ├── Risk.tsx               ← severity-grouped risk cards
│   ├── Market.tsx             ← TAM + competitors + drivers/headwinds
│   └── Legal.tsx              ← litigation table + regulatory issues
├── RecentReports.tsx          ← compact list shown on dashboard idle state
├── ReportForm.tsx             ← new-report form (company, ticker, scope, context)
├── LibraryView.tsx            ← full Memos tab (search, filter, status badges)
├── TemplatesView.tsx          ← 6 pre-configured analysis profiles
├── ActivityView.tsx           ← Live monitor timeline
├── UploadDocument.tsx         ← PDF/CSV/XLSX/DOCX/PPTX/TXT upload + list + delete
├── DealRoomQA.tsx             ← natural-language Q&A over uploaded documents (pgvector)
├── CompsView.tsx              ← comparable-company analysis with peer multiples
├── ScreenerView.tsx           ← fundamentals screener (market cap, margins, growth)
├── EarningsView.tsx           ← earnings-call transcript analysis
├── PipelineView.tsx           ← deal pipeline kanban (drag stages, kick off deep-dive)
├── WatchlistView.tsx          ← continuous company monitoring + drift alerts
├── SettingsView.tsx           ← workspace / user profile settings
├── UsageView.tsx              ← memo credit usage + plan display
├── CommentsPanel.tsx          ← inline commenting on report sections
├── NotificationsDropdown.tsx  ← notification bell + unread badge
├── WorkspaceActivityFeed.tsx  ← team activity log
├── SearchModal.tsx            ← ⌘K palette
├── Logo.tsx                   ← brand logomark component
└── ui.tsx                     ← ScoreGauge, ConfidencePill, Sparkline, Eyebrow, Spinner, formatters

src/lib/
├── auth.ts                    ← getToken/setToken/clearToken, apiFetch, logout, authHeaders
├── hooks.ts                   ← useIsMobile (resize-based, 768px breakpoint)
└── types.ts                   ← shared domain types (Report, ReportRequest, sections, Citation)
```

### Refactor rules — keep it this way
1. **No single file over ~300 lines of logic.** CSS string files are allowed to be bigger because they're static data.
2. **Pure data lives in `.ts` files** (`types.ts`, `constants.ts`, `css.ts`) — no React, no imports beyond other data modules.
3. **One responsibility per file.** Adding a new report section = new file in `src/components/report/`. New dashboard tab = new component in `src/app/app/components/`.
4. **Hooks own async lifecycle.** Pages should call `const x = useThing()`, not contain 200-line `handleSubmit` functions. The dashboard's SSE/polling lives in `src/app/app/hooks/useReportRun.ts`.
5. **Always run `npm run type-check` before considering a change done.** Zero errors is the standing baseline.

### Auth
JWT is stored in `localStorage` as `arthvion_token`. Helpers in `src/lib/auth.ts`:
- `getToken()` / `setToken()` / `clearToken()`
- `apiFetch(path, init)` — adds `Authorization` and `Content-Type` headers (skips Content-Type for FormData so the browser sets the multipart boundary). On `401` it clears the token and redirects to `/login?next=<current-path>`.
- `logout()` — best-effort POST to `/api/v1/auth/logout`, then clears the token.

The dashboard guards itself: `useEffect` checks `getToken()` on mount and calls `router.replace("/login")` if missing.

### Design system
Two scoped Atlassian-inspired token palettes embedded as CSS strings via `dangerouslySetInnerHTML`:
- `.lp-wrap` (landing page) — from `src/app/_landing/css.ts`, injected by `src/app/page.tsx`
- `.af-app` (dashboard chrome) — from `src/app/app/css.ts`, injected by `src/app/app/page.tsx`

The login page has its own smaller responsive sheet at `src/app/login/css.ts` (scoped to `.lp-login`).

All three sheets define `--n0..n900` (neutrals), `--b50..b900` (blues), and tone-specific scales (`--g/r/y/p/t` for green/red/yellow/purple/teal). Inter for body, JetBrains Mono for tabular numbers and source citations. Do NOT add Tailwind — the project uses inline styles and these scoped token sheets only.

### Dashboard state machine
The dashboard composes three top-level state buckets:
- **Auth/identity** (`ready`, `userName`) — `src/app/app/page.tsx` only
- **UI state** (`activeTab`, `searchOpen`, `recentCount`, `formKey`, `formInitial`) — `page.tsx` only
- **Report-run lifecycle** (`report`, `loading`, `agents`, `statusMsg`, `polling`, `error`, `activeReq`, `refreshKey`, plus actions `handleSubmit`/`handleAbort`/`handleSelectHistorical`) — encapsulated in `useReportRun()`

The hook exposes a derived `phase: idle | generating | loaded` that page.tsx branches on:
- **idle** → renders `<NewReportForm>` (with template prefill support via `formKey` + `formInitial`)
- **generating** → renders `<RunPipeline>` with live SSE stream + polling fallback if the connection drops
- **loaded** → renders `<ReportViewer>`

Sidebar nav switches `activeTab`: `new-report | memos | live-monitor | watchlist | knowledge-base | templates | citations | team | usage | settings`. Most tabs render fully-built components; only `citations` still shows `<ComingSoon>`:

| Tab | Component |
|-----|-----------|
| `memos` | `LibraryView` |
| `live-monitor` | `ActivityView` |
| `watchlist` | `WatchlistView` |
| `knowledge-base` | `UploadDocument` + `DealRoomQA` |
| `templates` | `TemplatesView` |
| `comps` | `CompsView` |
| `screener` | `ScreenerView` |
| `earnings` | `EarningsView` |
| `pipeline` | `PipelineView` |
| `team` | `TeamView` |
| `usage` | `UsageView` |
| `settings` | `SettingsView` |
| `citations` | `<ComingSoon>` (not built yet) |

The SSE handler inside `useReportRun` parses Redis events (`agent_start | agent_done | agent_fail | status | complete | error`), backfills missing events from `/event-log` on reconnect, and polls `/reports/{id}` until completion or 80 attempts (5s→10s→15s ladder).

## Pricing tiers (UI-only — no backend enforcement yet)
- **Solo** — Free · 3 memos / month
- **Desk** — $399 / month · 50 memos / month · Earnings, Comps & Screener (most popular)
- **Firm** — Custom · everything in Desk + private corpus + SSO + dedicated tenancy

These numbers are currently just marketing copy on `src/app/page.tsx`. The dashboard banner uses `Math.max(0, 3 - recentCount)` to show free runs remaining, but there's no actual gate. **TODO:** add `plan_tier` to `User`, a monthly memo counter, and a 402 response from `create_report` when over cap.

## Key constraints
- All I/O is `async` — no blocking calls anywhere. MCP tool calls are awaited inside the loop. The four specialist agents run **in parallel** via `asyncio.gather()` in `backend/agents/orchestrator.py` (each catches its own exceptions, so `gather()` never raises on partial failure). This requires an Anthropic Tier 2+ key to avoid 429s. To revert to sequential, replace the `gather()` call with a `for`-loop and raise `agent_inter_delay_seconds` back to 10.
- SEC EDGAR rate limit: `asyncio.Semaphore(8)` in `mcp_servers/sec_edgar/server.py` with exponential back-off on 429 responses. The `User-Agent` header must be set to a real contact (`SEC_EDGAR_USER_AGENT` env var).
- MCP tool results are truncated at 12,000 chars in `_mcp_client.py` to prevent large SEC filings from burning the token budget.
- Each agent has a hard `asyncio.wait_for` timeout (`AGENT_TIMEOUT_SECONDS`, default 360s). Fallback sections (`confidence_score=0.0`) are discarded before synthesis.
- Reports are persisted to PostgreSQL via async SQLAlchemy. Tables are auto-created on startup via `Base.metadata.create_all`.
- `npm run type-check` must pass cleanly before any frontend change is considered done — the project has zero TypeScript errors and we keep it that way.

# Strip skills
npx skills add -y https://docs.stripe.com