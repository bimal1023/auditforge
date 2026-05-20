"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import get_settings

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_settings().database_url,
            pool_size=10,
            max_overflow=20,
            echo=False,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), expire_on_commit=False
        )
    return _session_factory


async def get_session() -> AsyncSession:
    """FastAPI dependency — yields a session and closes it after the request."""
    async with get_session_factory()() as session:
        yield session
