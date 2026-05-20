from functools import lru_cache
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
    # Max retries on 429 / 5xx before giving up (Anthropic SDK built-in)
    anthropic_max_retries: int = 5
    # Hard timeout per Anthropic API request (seconds)
    anthropic_request_timeout: float = 120.0
    # Hard timeout per specialist agent run (seconds); 0 = disabled
    agent_timeout_seconds: int = 360
    # Pause between sequential agent runs to respect TPM rate limits
    agent_inter_delay_seconds: int = 15

    # External APIs
    tavily_api_key: str
    sec_edgar_user_agent: str = "AuditForge bimalkumal2004@gmail.com"

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
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # App
    environment: str = "development"
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
