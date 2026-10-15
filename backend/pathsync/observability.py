"""Runtime observability (plan C4): JSON log lines, per-route latency and error counts, and the
health of the database and the market snapshot.

Latency is kept per worker process in a bounded ring per route template (ids never become
separate routes). With several uvicorn workers each one reports its own window; the admin view
says which worker answered.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from collections import defaultdict, deque
from datetime import date

SNAPSHOT_MAX_AGE_DAYS = 45      # alert when the market map is older than this (monthly refresh + slack)
WINDOW = 500                    # latest requests kept per route


class JsonFormatter(logging.Formatter):
    """One JSON object per line; a message that is already JSON is merged in, not quoted."""

    def format(self, record: logging.LogRecord) -> str:
        base = {"ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"), "level": record.levelname, "logger": record.name}
        msg = record.getMessage()
        try:
            extra = json.loads(msg)
            base.update(extra if isinstance(extra, dict) else {"msg": msg})
        except ValueError:
            base["msg"] = msg
        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)
        return json.dumps(base, ensure_ascii=False)


def configure_logging() -> None:
    level = os.getenv("PATHSYNC_LOG_LEVEL", "INFO")
    handler = logging.StreamHandler()
    if os.getenv("PATHSYNC_LOG_JSON", "1" if os.getenv("PATHSYNC_ENV") == "production" else "0") == "1":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)


class RouteStats:
    def __init__(self):
        self._lock = threading.Lock()
        self._ms: dict[str, deque] = defaultdict(lambda: deque(maxlen=WINDOW))
        self._count: dict[str, int] = defaultdict(int)
        self._errors: dict[str, int] = defaultdict(int)

    def record(self, route: str, status: int, ms: float) -> None:
        with self._lock:
            self._ms[route].append(ms)
            self._count[route] += 1
            if status >= 500:
                self._errors[route] += 1

    def snapshot(self) -> dict[str, dict]:
        out = {}
        with self._lock:
            for route, ms in self._ms.items():
                xs = sorted(ms)
                pick = lambda q: round(xs[min(len(xs) - 1, int(q * len(xs)))], 1)  # noqa: E731
                n = self._count[route]
                out[route] = {"requests": n, "errors_5xx": self._errors[route],
                              "error_rate": round(self._errors[route] / n, 4) if n else 0.0,
                              "p50_ms": pick(0.50), "p95_ms": pick(0.95), "max_ms": round(xs[-1], 1)}
        return dict(sorted(out.items(), key=lambda kv: -kv[1]["p95_ms"]))

    def reset(self) -> None:
        with self._lock:
            self._ms.clear()
            self._count.clear()
            self._errors.clear()


STATS = RouteStats()


def health(s) -> tuple[bool, dict]:
    """Database reachable and market snapshot fresh. Returns (database_ok, details)."""
    from sqlalchemy import func, select, text

    from .db import MarketSnapshot

    try:
        s.execute(text("SELECT 1"))
    except Exception as e:  # noqa: BLE001 - reported, not raised
        return False, {"database": f"error: {type(e).__name__}"}
    newest = s.scalar(select(func.max(MarketSnapshot.reference_date)).where(MarketSnapshot.simulated.is_(False)))
    age = (date.today() - newest).days if newest else None
    return True, {"database": "ok", "market_reference_date": newest.isoformat() if newest else None,
                  "market_age_days": age, "market_stale": age is None or age > SNAPSHOT_MAX_AGE_DAYS,
                  "market_max_age_days": SNAPSHOT_MAX_AGE_DAYS}
