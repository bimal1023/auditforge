# Arthvion

**AI-powered private equity due diligence — in minutes, not weeks.**

Arthvion deploys a team of specialized AI agents that simultaneously research a company's financials, risks, market position, and legal exposure by reading live SEC filings, the web, and your own uploaded deal-room documents — then synthesizes everything into a structured, fully-cited investment memo with confidence scores and a one-click PDF.

It's more than a memo generator. Arthvion is a workspace for the whole diligence workflow: comparable-company analysis, a fundamentals screener, earnings-call analysis, a deal pipeline, continuous watchlist monitoring, and a grounded Q&A over your private data room.

---

## What it does

### 1. The diligence memo

Enter a company name. Four specialist agents go to work:

| Agent | Data sources | Output |
|-------|-------------|--------|
| **Financial** | SEC EDGAR (10-K/10-Q) + web + your uploaded docs | Revenue, EBITDA, net income, debt, cash, segments, cash-flow, margins, key ratios |
| **Risk** | SEC EDGAR (Item 1A) + web + your docs | Risk factors ranked by severity (high / medium / low) |
| **Market** | Web search + your docs | TAM, competitors, growth drivers, headwinds |
| **Legal** | SEC EDGAR (Item 3) + web + your docs | Active litigation, regulatory actions, potential liabilities |

An orchestrator model (Claude Opus) synthesizes the four sections into an executive summary with an overall investment score. Every claim links back to its source — an SEC filing accession number, a URL, or an uploaded document. Progress streams to the browser live over SSE.

### 2. Analyst surfaces

Beyond the memo, the dashboard ships a full set of PE workflows:

- **Comps** — comparable-company analysis. Pulls peer multiples (P/E, EV/EBITDA, EV/Revenue) and margins from Financial Modeling Prep, computes peer medians and implied valuations **deterministically in Python**, and has Claude write the narrative.
- **Screener** — filter a curated universe by fundamentals (market cap, margins, growth), with an AI summary.
- **Earnings** — fetch earnings-call transcripts and analyze tone, guidance, and red flags.
- **Deal pipeline** — track companies through the diligence funnel (kanban), kick off a deep-dive from any stage.
- **Action queue** — turn a finished memo into a prioritized list of concrete, assignable next-step diligence tasks.
- **Watchlist** — add companies for continuous monitoring; a scheduled scan detects material drift (new filings, guidance changes) and raises notifications.
- **Deal Room Q&A** — ask natural-language questions about your uploaded documents; answers are retrieved from a workspace-scoped pgvector store and cited.
- **Documents** — upload PDF / Word / Excel / PowerPoint / CSV / text. Files are parsed, chunked, embedded, and made searchable to every agent.
- **Team & workspaces** — multi-tenant workspaces with admin / analyst roles, invites, and an activity feed.
- **Billing** — Stripe-backed plans (Solo / Desk / Firm), workspace memo credits, and mid-cycle credit top-ups.

---

## Architecture

```
Browser
  │
  ├─ POST /api/v1/reports ──────────────────► Celery task queue (Redis)
  │                                                    │
  ├─ GET  /api/v1/reports/{id}/events ◄── SSE ─── Orchestrator (Claude Opus 4.7)
  │        live agent progress                         │
  │                                         ┌──────────┼──────────┬──────────┐
  └─ GET  /api/v1/reports/{id} ◄── JSON     ▼          ▼          ▼          ▼
           final report                Financial    Risk      Market      Legal
                                        Agent       Agent      Agent       Agent
                                      (Sonnet 4.6 each)
                                          │           │          │           │
                                      SEC EDGAR   SEC EDGAR  Web Search  SEC EDGAR
                                       + pgvector RAG (your uploaded docs, workspace-scoped)
                                            └── all via MCP stdio servers ──┘
```

Each specialist runs an autonomous tool-use loop — it decides which filings to pull, what to search, and when it has enough to write its section. When the workspace has uploaded documents, a pgvector RAG server is **additionally** bolted onto each agent's MCP client (read-only `similarity_search`, scoped to the workspace server-side) so agents can cite private deal-room files alongside public filings. RAG is best-effort: if it can't spawn, the agent falls back to SEC/web and core analysis never breaks.

### Hook lifecycle

Every agent call passes through a consistent middleware chain:

```
InputNormalizationHook → PolicyEnforcementHook → AuditLoggingHook
        ──── agentic loop (MCP tool calls) ────
OutputValidationHook → AuditLoggingHook → PolicyEnforcementHook
```

### Real-time streaming

The frontend opens an SSE stream right after submitting a report. Redis pub/sub relays agent events (`agent_start`, `agent_done`, `agent_fail`, `status`, `complete`, `error`) from the Celery worker to the browser, with an event-log replay on reconnect and a polling fallback if the stream drops.

---

## Tech stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async REST API
- [Celery](https://docs.celeryq.dev/) + Redis — task queue (worker) and periodic scans (beat)
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) — Claude agents with tool use + prompt caching
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) — stdio tool servers (SEC EDGAR, web search, file ingest, pgvector RAG, earnings)
- [SQLAlchemy 2 async](https://docs.sqlalchemy.org/en/20/) + PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) — persistence + embeddings
- [sentence-transformers](https://www.sbert.net/) — CPU embeddings for RAG
- [Stripe](https://stripe.com/) — subscriptions + one-time credit top-ups
- [fpdf2](https://py-pdf.github.io/fpdf2/) — PDF export

**Frontend**
- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- **Inline styles + scoped CSS token sheets** (Atlassian-inspired). No Tailwind — the design system is two scoped palettes injected as CSS strings.
- Fetch-based SSE streaming (EventSource can't send auth headers)

**Infrastructure**
- Docker + docker-compose · PostgreSQL 16 (pgvector) · Redis 7

---

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for Postgres + Redis)
- [Anthropic API key](https://console.anthropic.com/)
- [Tavily API key](https://tavily.com/) (web search)
- *(optional)* [Financial Modeling Prep API key](https://site.financialmodelingprep.com/) — required for Comps, Screener, and Earnings (free tier: 250 req/day)
- *(optional)* Stripe keys for billing, Resend key for transactional email

### 1. Clone and install

```bash
git clone https://github.com/bimal1023/arthvion.git
cd arthvion

# Install Python deps and make backend + mcp_servers importable
pip install -e . -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp infra/.env.example infra/.env
```

Open `infra/.env` and fill in at least:

```env
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
SEC_EDGAR_USER_AGENT="Your Name your@email.com"   # SEC requires a real contact
SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">

# Optional — enable the analyst surfaces
FMP_API_KEY=...            # Comps / Screener / Earnings

# Optional — billing & email
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_DESK_PRICE_ID=price_...
STRIPE_TOPUP_PRICE_ID=price_...
RESEND_API_KEY=...
```

### 3. Start everything with one command

```bash
# From repo root — boots Postgres, Redis, backend, Celery worker + beat, and frontend
./dev.sh
```

Open `http://localhost:3000`, create an account (you can set your firm/company name at signup), and enter a company — **Apple**, **Microsoft**, **Tesla** — to watch the agents work in real time.

**Logs** stream to `/tmp/arthvion-*.log`:
```bash
tail -f /tmp/arthvion-backend.log
tail -f /tmp/arthvion-worker.log
```

Press **Ctrl+C** to stop all services.

### (Optional) Stripe webhook testing

```bash
brew install stripe/stripe-cli/stripe
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

Copy the printed signing secret into `infra/.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Advanced: manual setup (without dev.sh)

```bash
# Infrastructure
docker compose -f infra/docker-compose.yml up postgres redis

# Terminal 1 — API
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Celery worker (agents run here, not in the API process)
celery -A backend.core.celery_app worker --loglevel=info --concurrency=1

# Terminal 3 — Celery beat (periodic watchlist scans)
celery -A backend.core.celery_app beat --loglevel=info

# Terminal 4 — frontend
cd frontend && npm install && npm run dev
```

Run any MCP server standalone for debugging:
```bash
python mcp_servers/sec_edgar/server.py
python mcp_servers/web_search/server.py
python mcp_servers/file_ingest/server.py
```

---

## Docker deployment

```bash
cp infra/.env.example infra/.env   # use Docker service names for DATABASE_URL / REDIS_URL
docker compose -f infra/docker-compose.yml up --build
```

Use service names `postgres` and `redis` (not `localhost`) in the Docker `DATABASE_URL` / `REDIS_URL`.

---

## API reference

All routes are mounted under `/api/v1`.

| Area | Key endpoints |
|------|---------------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `PATCH /auth/profile`, `PUT /auth/password` |
| **Reports** | `POST /reports`, `GET /reports`, `GET /reports/{id}`, `GET /reports/{id}/events` (SSE), `GET /reports/{id}/pdf`, `DELETE /reports/{id}` |
| **Documents** | `POST /documents` (PDF/CSV/XLSX/DOCX/PPTX/TXT), `GET /documents`, `DELETE /documents/{id}`, `POST /documents/query` (Deal Room Q&A) |
| **Comps** | `POST /comps/analyze`, `GET /comps/history`, `DELETE /comps/{id}` |
| **Screener** | `POST /screener/search`, `GET /screener/filters` |
| **Earnings** | `POST /earnings/analyze`, `GET /earnings/history` |
| **Pipeline** | `GET/POST /deals`, `POST /deals/{id}/deep-dive`, `PATCH/DELETE /deals/{id}` |
| **Actions** | `POST /reports/{id}/actions/generate`, `GET /reports/{id}/actions` |
| **Watchlist** | `POST /watchlist`, `GET /watchlist`, `GET /watchlist/{id}/events`, `POST /watchlist/{id}/rerun` |
| **Team** | `GET /team`, `PATCH /team/workspace` (rename, admin), member invites & roles |
| **Billing** | `POST /billing/checkout`, `POST /billing/topup`, `POST /billing/portal`, `POST /billing/webhook`, `GET /billing/usage` |
| **Notifications** | `GET /notifications`, `GET /notifications/count`, `POST /notifications/mark-read` |
| **Health** | `GET /health` |

---

## Project structure

```
arthvion/
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py        # coordinates the four specialists + synthesis
│   │   ├── financial_agent.py / risk_agent.py / market_agent.py / legal_agent.py
│   │   ├── drift_agent.py         # watchlist change detection
│   │   ├── _mcp_client.py         # MCP stdio transport wrapper (+ MultiMCPClient)
│   │   ├── _rag.py                # bolts pgvector RAG onto each agent, workspace-scoped
│   │   └── _prompt_cache.py       # cache_control=ephemeral helpers for system prompts
│   ├── api/                       # one router per surface
│   │   ├── routes.py              # reports + SSE          ├── comps_routes.py
│   │   ├── auth_routes.py         ├── upload_routes.py     ├── screener_routes.py
│   │   ├── qa_routes.py           ├── earnings_routes.py   ├── deals_routes.py
│   │   ├── actions_routes.py      ├── watchlist_routes.py  ├── team_routes.py
│   │   ├── billing_routes.py      ├── comments_routes.py   ├── activity_routes.py
│   │   └── notifications_routes.py
│   ├── core/                      # config, auth (JWT), database, celery_app,
│   │   │                          # redis events, workspace context, rate limit
│   ├── hooks/                     # pre/post agent middleware (HookContext chain)
│   ├── models/                    # Pydantic report schemas + SQLAlchemy ORM models
│   ├── services/                  # action_generator, billing, email, pdf_export
│   └── tasks/                     # report_task.py, watchlist_tasks.py (Celery)
├── mcp_servers/
│   ├── sec_edgar/   web_search/   file_ingest/   pgvector_rag/   earnings/
├── frontend/
│   └── src/
│       ├── app/                   # App Router: / (landing), /app (dashboard), /login
│       ├── components/            # ReportViewer, CompsView, ScreenerView, EarningsView,
│       │                          # PipelineView, WatchlistView, DealRoomQA, UploadDocument,
│       │                          # SettingsView, UsageView, CommentsPanel,
│       │                          # NotificationsDropdown, WorkspaceActivityFeed,
│       │                          # report/* sections, ui.tsx
│       └── lib/                   # auth.ts, hooks.ts, types.ts
└── infra/
    ├── docker-compose.yml
    └── .env.example
```

---

## Key design decisions

**Valuation math runs in Python, not the LLM.** For comps, the model is reliable at *transcribing* a table but not at *arithmetic*. Peer medians, implied valuations (EV/EBITDA, EV/Revenue, P/E), and the premium-vs-peers figure are computed deterministically in code and overwrite whatever the model returns — so the implied numbers always reconcile with the displayed multiples. Claude only writes the narrative.

**RAG is additive, never fatal.** The pgvector server lazy-loads sentence-transformers (which can segfault on spawn). Uploads succeed even if embedding fails, and agents fall back to SEC/web if the RAG subprocess won't come up. Tenant isolation is enforced server-side via a `WORKSPACE_SCOPE` env var the LLM never sees.

**File type is detected from content, not headers.** Uploads are validated by magic bytes — `%PDF`, the `PK\x03\x04` ZIP signature (then OOXML introspection to tell docx/xlsx/pptx apart), or a UTF-8 decode for csv/txt — so a renamed or mislabeled file can't slip through.

**Parallel agents via `asyncio.gather()`.** All four specialists run concurrently. This requires an Anthropic Tier 2+ key to avoid 429s on the 30K TPM free tier. A sequential fallback is trivial: replace the `gather()` call with a `for`-loop and set `agent_inter_delay_seconds` back to 10 in config.

**MCP for tool access.** Each data source runs as an isolated stdio subprocess, giving every agent a clean, sandboxed connection that can be tested independently of the agent code.

**Celery, not FastAPI BackgroundTasks.** A full report takes minutes. Celery tasks survive server restarts, can be retried, and report progress through Redis — background tasks tied to the HTTP worker would be lost on reload.

---

## Rate limits & costs

A single memo makes ~40–60 Anthropic API calls across the four agents. On the free tier (30K TPM) expect **5–10 minutes**; on a paid tier with the inter-agent delay removed, **2–3 minutes**. SEC EDGAR calls are bounded by a semaphore with exponential back-off; comps/screener/earnings depend on your FMP plan's daily quota.

---

## License

MIT
