# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: AuditForge

Multi-agent PE due diligence platform. An orchestrator agent (claude-opus-4-7) delegates to specialist agents in parallel; each specialist connects to dedicated MCP servers for data sourcing.

## Commands

**Backend (run from repo root):**
```bash
# Install deps + make `backend` and `mcp_servers` importable (do this once)
pip install -e . -r backend/requirements.txt

# Start API server
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

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
npm run type-check   # tsc --noEmit
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

### Request flow
```
POST /api/v1/reports
  → Celery task (run_report)
  → Orchestrator (claude-opus-4-7) — sequential with 15s inter-agent delay
      ├── FinancialAgent (claude-sonnet-4-6) ─── SEC EDGAR MCP
      ├── RiskAgent      (claude-sonnet-4-6) ─── SEC EDGAR + web-search MCP
      ├── MarketAgent    (claude-sonnet-4-6) ─── web-search MCP
      └── LegalAgent     (claude-sonnet-4-6) ─── SEC EDGAR + web-search MCP
  → Synthesis prompt → executive_summary + overall_score
  → DueDiligenceReport persisted to PostgreSQL
  → Redis pub/sub publishes per-agent progress events
GET /api/v1/reports/{id}/events  → SSE stream (browser gets live progress)
GET /api/v1/reports/{id}         → final report JSON
GET /api/v1/reports/{id}/pdf     → PDF download
```

### Hook lifecycle (every agent call)
`InputNormalizationHook.pre_run` → `PolicyEnforcementHook.pre_run` → `AuditLoggingHook.pre_run` → **agentic loop** → `OutputValidationHook.post_run` → `AuditLoggingHook.post_run` → `PolicyEnforcementHook.post_run`

`HookContext` (dataclass in `backend/hooks/base.py`) is the mutable bag passed through all hooks. It carries `normalized_input`, `raw_output`, `validated_output`, `tool_calls`, and `policy_violations`.

### MCP servers
Each server is a standalone Python script using `FastMCP` (from the `mcp` package) with stdio transport. Agents connect by spawning a subprocess via `MCPClient` (`backend/agents/_mcp_client.py`), which wraps the `mcp.ClientSession` and converts MCP tool schemas to Anthropic's `input_schema` format.

`MCPClient.anthropic_tools()` → list of Anthropic-format tool dicts  
`MCPClient.call_tool(name, args)` → JSON string for `tool_result` content block

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

### Stub
`mcp_servers/pgvector_rag/server.py` raises `NotImplementedError` — RAG over uploaded documents is not yet wired up.

## Key constraints
- All I/O is `async` — no blocking calls anywhere. MCP tool calls are awaited inside the loop; agents run sequentially (not parallel) to respect the Anthropic free-tier 30K TPM limit.
- SEC EDGAR rate limit: `asyncio.Semaphore(8)` in `mcp_servers/sec_edgar/server.py` with exponential back-off on 429 responses. The `User-Agent` header must be set to a real contact (`SEC_EDGAR_USER_AGENT` env var).
- MCP tool results are truncated at 12,000 chars in `_mcp_client.py` to prevent large SEC filings from burning the token budget.
- Each agent has a hard `asyncio.wait_for` timeout (`AGENT_TIMEOUT_SECONDS`, default 360s). Fallback sections (`confidence_score=0.0`) are discarded before synthesis.
- Reports are persisted to PostgreSQL via async SQLAlchemy. Tables are auto-created on startup via `Base.metadata.create_all`.
