"""Authentication, authorisation and request hygiene.

* Students get a random bearer token when their profile is created; only its sha256 is stored.
  Every /students/{id}/... route checks that the token belongs to that student.
* Staff roles (admin, expert, advisor) use tokens from `api_tokens`. The first admin token comes
  from PATHSYNC_ADMIN_TOKEN, or is generated on first start and written to data/admin_token.txt.
* Simple per-client rate limiting and upload limits protect the CPU-heavy endpoints.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DATA_DIR
from .db import ApiToken, Student, get_session, utcnow

MAX_UPLOAD_BYTES = int(os.getenv("PATHSYNC_MAX_UPLOAD_MB", "5")) * 1024 * 1024
MAX_TEXT_CHARS = 200_000
ALLOWED_UPLOADS = (".pdf", ".docx", ".txt", ".md", ".csv", ".sql", ".py", ".ipynb", ".json")


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    return value.strip() if scheme.lower() == "bearer" and value.strip() else None


def db_session():
    s = get_session()
    try:
        yield s
    finally:
        s.close()


# ------------------------------------------------------------------ students
def student_access(sid: str, authorization: str | None = Header(default=None),
                   s: Session = Depends(db_session)) -> Student:
    """Load the student and verify the caller holds its token (404 if unknown, 401/403 otherwise)."""
    st = s.get(Student, sid)
    if st is None:
        raise HTTPException(404, "Student not found.")
    token = _bearer(authorization)
    if token is None:
        raise HTTPException(401, "Sign in again: this request has no access token.")
    if st.token_hash is None or not hmac.compare_digest(st.token_hash, hash_token(token)):
        raise HTTPException(403, "This access token does not belong to this profile.")
    return st


# ---------------------------------------------------------------------- staff
def ensure_admin_token(s: Session) -> str | None:
    """Make sure at least one admin token exists. Returns a newly generated token (to log once) or None."""
    env = os.getenv("PATHSYNC_ADMIN_TOKEN")
    if env:
        h = hash_token(env)
        if s.scalar(select(ApiToken.id).where(ApiToken.token_hash == h)) is None:
            s.add(ApiToken(role="admin", token_hash=h, label="PATHSYNC_ADMIN_TOKEN"))
            s.commit()
        return None
    if s.scalar(select(ApiToken.id).where(ApiToken.role == "admin", ApiToken.revoked_at.is_(None))) is not None:
        return None
    token = new_token()
    s.add(ApiToken(role="admin", token_hash=hash_token(token), label="generated on first start"))
    s.commit()
    try:
        (DATA_DIR / "admin_token.txt").write_text(token + "\n", encoding="utf-8")
    except OSError:
        pass
    return token


def issue_token(s: Session, role: str, subject_id: str = "", label: str = "") -> str:
    token = new_token()
    s.add(ApiToken(role=role, subject_id=subject_id, token_hash=hash_token(token), label=label))
    return token


def _staff(s: Session, authorization: str | None, roles: tuple[str, ...]) -> ApiToken:
    token = _bearer(authorization)
    if token is None:
        raise HTTPException(401, "Staff sign-in required.")
    row = s.scalars(select(ApiToken).where(ApiToken.token_hash == hash_token(token), ApiToken.revoked_at.is_(None))).first()
    if row is None:
        raise HTTPException(401, "Unknown or revoked staff token.")
    if row.role not in roles:
        raise HTTPException(403, "Your role cannot use this page.")
    return row


def require_admin(authorization: str | None = Header(default=None), s: Session = Depends(db_session)) -> ApiToken:
    return _staff(s, authorization, ("admin",))


def require_expert(authorization: str | None = Header(default=None), s: Session = Depends(db_session)) -> ApiToken:
    """Experts act as themselves; admins may act for any expert (subject from the request)."""
    return _staff(s, authorization, ("expert", "admin"))


def require_advisor(authorization: str | None = Header(default=None), s: Session = Depends(db_session)) -> ApiToken:
    return _staff(s, authorization, ("advisor", "admin"))


def revoke(s: Session, token_id: int) -> None:
    row = s.get(ApiToken, token_id)
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()


# ---------------------------------------------------------------- rate limits
class RateLimiter:
    """Sliding-window limiter keyed by client IP and route group (in-process; use Redis behind several workers)."""

    def __init__(self):
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: tuple[str, str], limit: int, window: float) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


limiter = RateLimiter()
ENABLED = os.getenv("PATHSYNC_RATE_LIMIT", "1") != "0"


def rate_limit(group: str, limit: int, window: float = 60.0):
    def dep(request: Request):
        if not ENABLED:
            return
        ip = request.client.host if request.client else "?"
        if not limiter.check((ip, group), limit, window):
            raise HTTPException(429, "Too many requests. Wait a minute and try again.")
    return dep


# -------------------------------------------------------------------- uploads
def read_upload(file, max_bytes: int = MAX_UPLOAD_BYTES) -> tuple[bytes, str]:
    """Read an UploadFile (sync), enforcing type and size limits."""
    name = (file.filename or "upload.txt").lower()
    if not name.endswith(ALLOWED_UPLOADS):
        raise HTTPException(415, f"Unsupported file type. Use one of: {', '.join(ALLOWED_UPLOADS)}.")
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"File too large (max {max_bytes // (1024 * 1024)} MB).")
    return data, name


def clip_text(text: str) -> str:
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(413, f"Text too long (max {MAX_TEXT_CHARS:,} characters).")
    return text
