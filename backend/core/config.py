from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="infra/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str
    orchestrator_model: str = "claude-opus-4-7"
    specialist_model: str = "claude-sonnet-4-6"
    # Lighter model for less complex agents (market + risk) — fewer tokens, same quality
    fast_model: str = "claude-haiku-4-5-20251001"
    # Max retries on 429 / 529 / 5xx before giving up (Anthropic SDK built-in)
    anthropic_max_retries: int = 8
    # Hard timeout per Anthropic API request (seconds)
    anthropic_request_timeout: float = 180.0
    # Hard timeout per specialist agent run (seconds); 0 = disabled
    agent_timeout_seconds: int = 480
    # Pause between sequential agent runs to respect TPM rate limits.
    # Default 0 because specialists now run in parallel via asyncio.gather().
    # If you revert to sequential execution (e.g. because you're on the free
    # tier and hitting 429s), raise this to 10-30s.
    agent_inter_delay_seconds: int = 0

    # External APIs
    tavily_api_key: str
    sec_edgar_user_agent: str = "Arthvion contact@example.com"
    fmp_api_key: str = ""  # Financial Modeling Prep — free tier: 250 req/day
    # FRED (St. Louis Fed macro data) — free key: https://fredaccount.stlouisfed.org/apikey
    fred_api_key: str = ""
    # CourtListener / RECAP litigation data — optional token (raises rate limits):
    # https://www.courtlistener.com/help/api/rest/
    courtlistener_api_token: str = ""
    # OpenSanctions sanctions/PEP screening — key (free tier): https://www.opensanctions.org/api/
    opensanctions_api_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/arthvion"
    redis_url: str = "redis://localhost:6379/0"

    # MCP server entry points (run as subprocesses via stdio transport)
    sec_edgar_mcp_script: str = "mcp_servers/sec_edgar/server.py"
    web_search_mcp_script: str = "mcp_servers/web_search/server.py"
    file_ingest_mcp_script: str = "mcp_servers/file_ingest/server.py"
    pgvector_mcp_script: str = "mcp_servers/pgvector_rag/server.py"
    earnings_mcp_script: str = "mcp_servers/earnings/server.py"
    fred_mcp_script: str = "mcp_servers/fred/server.py"
    courtlistener_mcp_script: str = "mcp_servers/courtlistener/server.py"
    opensanctions_mcp_script: str = "mcp_servers/opensanctions/server.py"

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 60 * 2  # 2 hours
    # Password reset tokens — short-lived so a leaked email doesn't sit
    # vulnerable indefinitely. User has 15 minutes to click the link.
    password_reset_token_minutes: int = 15

    # Email (Resend) — used for password resets and welcome messages.
    # Get your key at https://resend.com/api-keys. Leaving empty disables email
    # entirely (auth endpoints will succeed but no message is sent — useful in dev).
    resend_api_key: str = ""
    # Must be a domain verified in your Resend dashboard. In dev,
    # "onboarding@resend.dev" works for sending to your own verified email.
    resend_from_email: str = "Arthvion <onboarding@resend.dev>"
    # Public URL of the frontend, used to build links inside email bodies.
    app_url: str = "http://localhost:3000"

    # ── Stripe billing ────────────────────────────────────────────────────────
    # Test keys start with `sk_test_...`. Live keys start with `sk_live_...`.
    # Never commit live keys; never log them.
    stripe_secret_key: str = ""
    # Webhook signing secret — fetched from `stripe listen` for local dev,
    # or from the dashboard for production endpoints.
    stripe_webhook_secret: str = ""
    # Price ID of the Desk plan ($399/mo, created in Stripe catalog).
    # Starts with `price_...`. Free tier needs no price ID.
    stripe_desk_price_id: str = ""
    # Price ID of the one-time "extra memo credit" top-up (Stripe one-time
    # price, billed per unit). Checkout quantity == number of credits bought.
    # Lets a Desk customer buy overage credits mid-cycle without changing plan.
    stripe_topup_price_id: str = ""
    # Bounds on a single top-up purchase (number of memo credits).
    topup_min_credits: int = 1
    topup_max_credits: int = 500
    # Trial length in days. Set to 0 (default) to charge immediately on
    # subscription start — Solo plan (3 free memos) serves as the de-facto
    # trial. Most B2B SaaS in 2026 follows this pattern (Linear, Notion,
    # Vercel, Cursor) because per-use API cost makes time-based trials a
    # net-negative on cold signups.
    stripe_trial_days: int = 0

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.secret_key == "change-me-in-production-use-openssl-rand-hex-32":
            raise ValueError(
                "SECRET_KEY is still the default placeholder. "
                "Generate a real key: python3 -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Response cache — reuse completed reports for the same company within this window
    report_cache_ttl_hours: int = 24

    # ── Watchlist ─────────────────────────────────────────────────────────
    watchlist_scan_interval_hours: int = 6
    drift_agent_max_iterations: int = 4
    drift_agent_timeout_seconds: int = 120

    # App
    environment: str = "development"
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
