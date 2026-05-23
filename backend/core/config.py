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
    # 10s is enough headroom for Haiku; increase to 30-60 if you see 429/529 errors.
    agent_inter_delay_seconds: int = 10

    # External APIs
    tavily_api_key: str
    sec_edgar_user_agent: str = "AuditForge contact@example.com"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/auditforge"
    redis_url: str = "redis://localhost:6379/0"

    # MCP server entry points (run as subprocesses via stdio transport)
    sec_edgar_mcp_script: str = "mcp_servers/sec_edgar/server.py"
    web_search_mcp_script: str = "mcp_servers/web_search/server.py"
    file_ingest_mcp_script: str = "mcp_servers/file_ingest/server.py"
    pgvector_mcp_script: str = "mcp_servers/pgvector_rag/server.py"

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 60 * 2  # 2 hours

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

    # App
    environment: str = "development"
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
