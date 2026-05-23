"""JWT authentication utilities."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_session
from backend.models.db import User

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer()


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.secret_key,
        algorithm="HS256",
    )


def _token_blacklist_key(token: str) -> str:
    """Store a short hash of the token to avoid keeping full tokens in Redis."""
    return "auditforge:blacklist:" + hashlib.sha256(token.encode()).hexdigest()


def blacklist_token(token: str) -> None:
    """Add token to Redis blacklist. Expires after the token's own TTL."""
    try:
        import redis as _redis
        settings = get_settings()
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        exp = payload.get("exp", 0)
        ttl = max(1, int(exp - datetime.now(timezone.utc).timestamp()))
        client = _redis.from_url(settings.redis_url, socket_connect_timeout=2)
        client.setex(_token_blacklist_key(token), ttl, "1")
        client.close()
    except Exception:
        pass  # logout is best-effort; log but never fail the request


def _is_token_blacklisted(token: str) -> bool:
    try:
        import redis as _redis
        client = _redis.from_url(get_settings().redis_url, socket_connect_timeout=2)
        result = client.exists(_token_blacklist_key(token))
        client.close()
        return bool(result)
    except Exception:
        return False  # Redis unavailable → allow the request


def _decode_token(token: str) -> UUID:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        return UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_session),
) -> User:
    if _is_token_blacklisted(creds.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = _decode_token(creds.credentials)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
