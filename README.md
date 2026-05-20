# AuditForge

**AI-powered private equity due diligence — in minutes, not weeks.**

AuditForge deploys a team of specialized AI agents that simultaneously research a company's financials, risks, market position, and legal exposure by reading live SEC filings and the web — then synthesizes everything into a structured report with citations, confidence scores, and a one-click PDF.

---

## What it does

Enter a company name. Four agents go to work in parallel:

| Agent | Data sources | Output |
|-------|-------------|--------|
| **Financial** | SEC EDGAR 10-K (Item 7, Item 8) | Revenue, EBITDA, net income, debt, cash, key ratios — 3 years |
| **Risk** | SEC EDGAR 10-K (Item 1A) + web search | Risk factors ranked by severity (high / medium / low) |
| **Market** | Web search + analyst reports | TAM, competitors, growth drivers, headwinds |
| **Legal** | SEC EDGAR 10-K (Item 3) + web search | Active litigation, regulatory actions, potential liabilities |

An orchestrator model (Claude Opus) synthesizes the four sections into an executive summary with an overall investment score. Every claim links back to its source — SEC filing accession number or URL.

---

## Architecture

```
Browser
  │
  ├─ POST /api/v1/reports ──────────────────► Celery task queue (Redis)
  │                                                    │
  ├─ GET  /api/v1/reports/{id}/events ◄── SSE ─── Orchestrator (Claude Opus 4.7)
  │        live agent progress                         │
  │                                         ┌──────────┼──────────┐
  └─ GET  /api/v1/reports/{id} ◄── JSON     │          │          │
           final report                     ▼          ▼          ▼
                                      Financial     Risk       Market    Legal
                                       Agent        Agent      Agent     Agent
                                    (Sonnet 4.6) (Sonnet 4.6)(Sonnet 4.6)(Sonnet 4.6)
                                         │           │           │          │
                                    SEC EDGAR    SEC EDGAR   Web Search  SEC EDGAR
                                      MCP           MCP        MCP      + Web MCP
                                    (stdio)       (stdio)    (stdio)    (stdio)
```

Each specialist agent runs an autonomous tool-use loop — it decides which SEC filings to pull, what web searches to run, and when it has enough data to write its section. Tool results are truncated to 12K chars and agents retry on rate limits with exponential back-off.

### Hook lifecycle

Every agent call passes through a consistent middleware chain:

```
InputNormalizationHook → PolicyEnforcementHook → AuditLoggingHook
        ──── agentic loop (MCP tool calls) ────
OutputValidationHook → AuditLoggingHook → PolicyEnforcementHook
```

### Real-time streaming

The frontend opens an SSE stream immediately after submitting a report. Redis pub/sub relays agent events (`agent_start`, `agent_done`, `agent_fail`, `complete`) from the Celery worker to the browser in real time — no polling.

---

## Tech stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async REST API
- [Celery](https://docs.celeryq.dev/) + Redis — task queue for long-running agent runs
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) — Claude agents with tool use
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) — stdio-transport tool servers for SEC EDGAR and web search
- [SQLAlchemy 2 async](https://docs.sqlalchemy.org/en/20/) + PostgreSQL (pgvector) — report persistence
- [fpdf2](https://py-pdf.github.io/fpdf2/) — PDF generation

**Frontend**
- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- Fetch-based SSE streaming (EventSource doesn't support auth headers)

**Infrastructure**
- Docker + docker-compose
- PostgreSQL 16 with pgvector
- Redis 7

---

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for Postgres + Redis, or run locally)
- [Anthropic API key](https://console.anthropic.com/)
- [Tavily API key](https://tavily.com/) (web search)

### 1. Clone and install

```bash
git clone https://github.com/bimal1023/auditforge.git
cd auditforge

# Install Python deps and make backend + mcp_servers importable
pip install -e . -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp infra/.env.example infra/.env
```

Open `infra/.env` and fill in:

```env
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
```

### 3. Start infrastructure

```bash
# Postgres + Redis only (recommended for local dev)
docker compose -f infra/docker-compose.yml up postgres redis
```

### 4. Start the backend

```bash
# Terminal 1 — API server (run from repo root)
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Celery worker
celery -A backend.core.celery_app worker --loglevel=info --concurrency=2
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### 6. Register and run your first report

1. Open `http://localhost:3000` → create an account
2. Enter a company name (e.g. **Apple**, **Microsoft**, **Tesla**)
3. Watch the four agents work in real time
4. Download the PDF when complete

---

## Docker deployment

```bash
# Copy env and fill in your API keys + use Docker service names for DB/Redis
cp infra/.env.example infra/.env

# Full stack
docker compose -f infra/docker-compose.yml up --build
```

See `.env.example` for the Docker-specific `DATABASE_URL` and `REDIS_URL` values (use service names `postgres` and `redis` instead of `localhost`).

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/token` | Get JWT |
| `POST` | `/api/v1/reports` | Start a report (202 + id) |
| `GET`  | `/api/v1/reports/{id}/events` | SSE stream of agent progress |
| `GET`  | `/api/v1/reports/{id}` | Fetch completed report |
| `GET`  | `/api/v1/reports/{id}/pdf` | Download PDF |
| `GET`  | `/api/v1/reports` | List your reports |
| `DELETE` | `/api/v1/reports/{id}` | Delete a report |
| `GET`  | `/health` | Health check |

---

## Project structure

```
auditforge/
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py       # Coordinates all specialists
│   │   ├── financial_agent.py
│   │   ├── risk_agent.py
│   │   ├── market_agent.py
│   │   ├── legal_agent.py
│   │   └── _mcp_client.py        # MCP stdio transport wrapper
│   ├── api/
│   │   ├── routes.py             # Report endpoints + SSE
│   │   ├── auth_routes.py
│   │   └── upload_routes.py
│   ├── core/
│   │   ├── config.py             # Pydantic settings
│   │   ├── auth.py               # JWT
│   │   ├── database.py           # Async SQLAlchemy engine
│   │   ├── celery_app.py
│   │   └── redis_events.py       # Pub/sub event bus
│   ├── hooks/                    # Pre/post agent middleware
│   ├── models/                   # Pydantic + SQLAlchemy models
│   ├── services/
│   │   └── pdf_export.py         # PDF generation
│   └── tasks/
│       └── report_task.py        # Celery task
├── mcp_servers/
│   ├── sec_edgar/server.py       # SEC EDGAR tool server
│   ├── web_search/server.py      # Tavily web search server
│   └── file_ingest/server.py     # Document upload server
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Main dashboard + SSE client
│       │   └── login/page.tsx
│       ├── components/
│       │   ├── ReportViewer.tsx
│       │   ├── ReportForm.tsx
│       │   └── UploadDocument.tsx
│       └── lib/
│           ├── auth.ts
│           └── types.ts
└── infra/
    ├── docker-compose.yml
    └── .env.example
```

---

## Key design decisions

**Why sequential agents instead of parallel?**
The Anthropic free tier has a 30K input tokens/minute limit. Four agents running in parallel each making 10+ API calls would hit that wall every time. Sequential execution with a 15-second inter-agent delay keeps throughput within limits without sacrificing report quality.

**Why MCP for tool access?**
MCP servers run as isolated subprocesses with stdio transport. This means each agent gets a clean, sandboxed connection to its data sources, and the servers can be tested independently without touching the agent code.

**Why Celery instead of FastAPI BackgroundTasks?**
A full report takes 5–10 minutes. FastAPI background tasks are tied to the HTTP worker process — a server restart loses them. Celery tasks survive restarts, can be retried on failure, and their status is persisted in Redis.

---

## Rate limits & costs

A single report makes approximately 40–60 Anthropic API calls across all four agents. On the free tier (30K TPM), expect reports to take **5–10 minutes**. On a paid tier (higher TPM), you can reduce `AGENT_INTER_DELAY_SECONDS` to 0 and reports complete in **2–3 minutes**.

---

## License

MIT
