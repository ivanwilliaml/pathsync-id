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
import ipaddress
import logging
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DATA_DIR, tr
from .db import ApiToken, AuditLog, Student, get_session, utcnow

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
        raise HTTPException(404, tr("Student not found.", "Mahasiswa tidak ditemukan."))
    token = _bearer(authorization)
    if token is None:
        raise HTTPException(401, tr("Sign in again: this request has no access token.", "Masuk lagi: permintaan ini tidak membawa access token."))
    if st.token_hash is None or not hmac.compare_digest(st.token_hash, hash_token(token)):
        raise HTTPException(403, tr("This access token does not belong to this profile.", "Access token ini bukan milik profil ini."))
    return st


# ---------------------------------------------------------------------- staff
def ensure_admin_token(s: Session) -> str | None:
    """Make sure at least one admin token exists. Returns a newly generated token (to log once) or None."""
    env = os.getenv("PATHSYNC_ADMIN_TOKEN")
    if env and os.getenv("PATHSYNC_ENV") == "production" and (len(env) < 32 or "demo" in env.lower()):
        raise RuntimeError("PATHSYNC_ADMIN_TOKEN must be 32+ random characters in production (openssl rand -base64 48).")
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


STAFF_TOKEN_DAYS = int(os.getenv("PATHSYNC_STAFF_TOKEN_DAYS", "30"))
STAFF_COOKIE = "ps_staff"
CSRF_HEADER = "x-pathsync"     # custom header: browsers cannot send it cross-site without a CORS preflight


STAFF_SESSION_HOURS = int(os.getenv("PATHSYNC_STAFF_SESSION_HOURS", "12"))
SESSION_PREFIX = "session of #"     # label of a browser session token; the number is the staff token it came from


def issue_token(s: Session, role: str, subject_id: str = "", label: str = "", expires_at=None) -> str:
    token = new_token()
    s.add(ApiToken(role=role, subject_id=subject_id, token_hash=hash_token(token), label=label,
                   expires_at=expires_at or utcnow() + timedelta(days=STAFF_TOKEN_DAYS)))
    return token


def issue_session(s: Session, parent: ApiToken) -> tuple[str, ApiToken]:
    """Browser sign-in: a short-lived session token derived from a staff token. The cookie carries this,
    never the staff token itself, so signing out can revoke it without touching the staff token."""
    ends = utcnow() + timedelta(hours=STAFF_SESSION_HOURS)
    if parent.expires_at is not None:
        ends = min(ends, parent.expires_at)
    token = issue_token(s, parent.role, parent.subject_id, f"{SESSION_PREFIX}{parent.id} {parent.label}"[:120], ends)
    s.flush()
    return token, s.scalars(select(ApiToken).where(ApiToken.token_hash == hash_token(token))).one()


def staff_token_row(s: Session, token: str | None) -> ApiToken | None:
    if not token:
        return None
    row = s.scalars(select(ApiToken).where(ApiToken.token_hash == hash_token(token), ApiToken.revoked_at.is_(None))).first()
    if row is None or (row.expires_at is not None and row.expires_at < utcnow()):
        return None
    if row.label.startswith(SESSION_PREFIX):          # a session dies with the staff token it came from
        try:
            parent = s.get(ApiToken, int(row.label[len(SESSION_PREFIX):].split(" ", 1)[0]))
        except ValueError:
            return None
        if parent is None or parent.revoked_at is not None or (parent.expires_at is not None and parent.expires_at < utcnow()):
            return None
    return row


def _staff(s: Session, request: Request, authorization: str | None, roles: tuple[str, ...]) -> ApiToken:
    """Staff authenticate with an HttpOnly session cookie (set by POST /api/staff/session) or, for scripts, a bearer
    token. Cookie-authenticated writes must carry the X-PathSync header (CSRF protection)."""
    token = _bearer(authorization)
    via_cookie = token is None
    if via_cookie:
        token = request.cookies.get(STAFF_COOKIE)
    if token is None:
        raise HTTPException(401, "Staff sign-in required.")
    row = staff_token_row(s, token)
    if row is None:
        raise HTTPException(401, "Unknown, expired or revoked staff token.")
    if via_cookie and request.method not in ("GET", "HEAD", "OPTIONS") and not request.headers.get(CSRF_HEADER):
        raise HTTPException(403, "Missing X-PathSync header.")
    if row.role not in roles:
        raise HTTPException(403, "Your role cannot use this page.")
    return row


def require_admin(request: Request, authorization: str | None = Header(default=None),
                  s: Session = Depends(db_session)) -> ApiToken:
    return _staff(s, request, authorization, ("admin",))


def require_expert(request: Request, authorization: str | None = Header(default=None),
                   s: Session = Depends(db_session)) -> ApiToken:
    """Experts act as themselves; admins may act for any expert (subject from the request)."""
    return _staff(s, request, authorization, ("expert", "admin"))


def require_advisor(request: Request, authorization: str | None = Header(default=None),
                    s: Session = Depends(db_session)) -> ApiToken:
    return _staff(s, request, authorization, ("advisor", "admin"))


def audit(s: Session, actor: str, action: str, target: str = "", detail: dict | None = None) -> None:
    s.add(AuditLog(actor=actor[:160], action=action[:60], target=target[:200], detail=detail or {}))


def audit_admin_writes(request: Request, tok: ApiToken = Depends(require_admin)):
    """Router dependency: every state-changing admin call is written to the audit log after it runs."""
    try:
        yield
    finally:
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            route = request.scope.get("route")
            s = get_session()
            try:
                audit(s, f"{tok.role}:{tok.label or tok.id}", f"{request.method} {getattr(route, 'path', request.url.path)}"[:60],
                      ",".join(f"{k}={v}" for k, v in request.path_params.items()))
                s.commit()
            finally:
                s.close()


def revoke(s: Session, token_id: int) -> None:
    row = s.get(ApiToken, token_id)
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()


# ---------------------------------------------------------------- rate limits
# Client IP (PM audit P0-3). Run uvicorn with --no-proxy-headers so request.client is the real TCP peer; the
# X-Forwarded-For chain is honoured only through proxies listed in PATHSYNC_TRUSTED_PROXIES (CIDRs). Walking the
# chain from the right and stopping at the first untrusted hop means a client cannot spoof its address by sending
# its own X-Forwarded-For header: the trusted proxy appends the real peer after whatever the client wrote.
TRUSTED_PROXIES = [ipaddress.ip_network(c.strip(), strict=False)
                   for c in os.getenv("PATHSYNC_TRUSTED_PROXIES", "127.0.0.1/32,::1/128").split(",") if c.strip()]


def _trusted(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in TRUSTED_PROXIES)


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "?"
    if not _trusted(peer):
        return peer
    chain = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    for hop in reversed(chain):
        if not _trusted(hop):
            return hop
    return chain[0] if chain else peer


class RateLimiter:
    """Sliding-window limiter, in-process. With PATHSYNC_REDIS_URL set, a shared fixed-window counter in Redis is used
    instead so the limit holds across several workers or containers."""

    def __init__(self, url: str | None = None):
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._redis = None
        self.fallbacks = 0            # checks answered locally because Redis failed (shown in /api/admin/runtime)
        self._warned_at = 0.0
        url = url if url is not None else os.getenv("PATHSYNC_REDIS_URL")
        if url:
            import redis  # optional dependency, only needed for multi-worker deployments

            self._redis = redis.Redis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)

    @property
    def backend(self) -> str:
        return "redis" if self._redis is not None else "memory"

    def check(self, key: tuple[str, str], limit: int, window: float) -> bool:
        if self._redis is not None:
            try:
                k = f"rl:{key[1]}:{key[0]}:{int(time.time() // window)}"
                pipe = self._redis.pipeline()
                pipe.incr(k)
                pipe.expire(k, int(window) + 1, nx=True)
                n = pipe.execute()[0]
                return n <= limit
            except Exception as e:  # noqa: BLE001 - Redis down: fall back to the local window rather than failing requests
                # the fallback limit is per worker, so it is looser than the shared one: say so, at most once a minute
                self.fallbacks += 1
                if time.monotonic() - self._warned_at > 60:
                    self._warned_at = time.monotonic()
                    logging.getLogger("pathsync").warning(
                        '{"event":"rate_limit_fallback","reason":"%s","fallbacks":%d}', type(e).__name__, self.fallbacks)
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
    """Limit per client IP, and additionally per student on routes under /students/{sid} (shared campus NAT)."""
    def dep(request: Request):
        if not ENABLED:
            return
        keys = [(client_ip(request), group)]
        sid = request.path_params.get("sid")
        if sid:
            keys.append((f"student:{sid}", group))
        for k in keys:
            if not limiter.check(k, limit, window):
                raise HTTPException(429, tr("Too many requests. Wait a minute and try again.", "Terlalu banyak permintaan. Tunggu satu menit lalu coba lagi."))
    return dep


# -------------------------------------------------------------------- uploads
def read_upload(file, max_bytes: int = MAX_UPLOAD_BYTES) -> tuple[bytes, str]:
    """Read an UploadFile (sync), enforcing type and size limits."""
    name = (file.filename or "upload.txt").lower()
    if not name.endswith(ALLOWED_UPLOADS):
        kinds = ", ".join(ALLOWED_UPLOADS)
        raise HTTPException(415, tr(f"Unsupported file type. Use one of: {kinds}.", f"Jenis file tidak didukung. Gunakan salah satu: {kinds}."))
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise HTTPException(413, tr(f"File too large (max {mb} MB).", f"File terlalu besar (maks {mb} MB)."))
    # the extension must match the content: a renamed binary is refused before any parser sees it
    magic = {".pdf": b"%PDF-", ".docx": b"PK\x03\x04"}
    for ext, head in magic.items():
        if name.endswith(ext) and not data.startswith(head):
            raise HTTPException(415, tr(f"This file is not a valid {ext} file.", f"File ini bukan file {ext} yang valid."))
    if not name.endswith((".pdf", ".docx")) and b"\x00" in data[:4096]:
        raise HTTPException(415, tr("Text uploads must be plain text.", "Unggahan teks harus berupa teks biasa."))
    return data, name


def clip_text(text: str) -> str:
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(413, tr(f"Text too long (max {MAX_TEXT_CHARS:,} characters).", f"Teks terlalu panjang (maks {MAX_TEXT_CHARS:,} karakter)."))
    return text
