"""Plan C2: with Redis the limit is shared by every worker, and when Redis is down the limiter falls
back to per-worker memory with a logged warning and a counter (never silently).

The shared-limit test needs a Redis server: set PATHSYNC_TEST_REDIS_URL (CI runs a redis service)."""
from __future__ import annotations

import logging
import os
import uuid

import pytest

from pathsync.security import RateLimiter

REDIS = os.getenv("PATHSYNC_TEST_REDIS_URL")


@pytest.mark.skipif(not REDIS, reason="set PATHSYNC_TEST_REDIS_URL to a Redis server")
def test_limit_is_shared_across_workers():
    a, b = RateLimiter(REDIS), RateLimiter(REDIS)          # two workers, one Redis
    key = (f"10.0.0.{uuid.uuid4().int % 250}", f"test-{uuid.uuid4().hex[:8]}")
    allowed = [lim.check(key, 5, 60) for lim in (a, b, a, b, a, b, a)]
    assert allowed == [True] * 5 + [False] * 2              # the 6th request is refused whichever worker gets it
    assert a.backend == "redis" and a.fallbacks == b.fallbacks == 0


def test_redis_down_falls_back_with_a_warning(caplog):
    lim = RateLimiter("redis://127.0.0.1:1/0")             # nothing listens on port 1
    key = ("10.9.9.9", "test-fallback")
    with caplog.at_level(logging.WARNING, logger="pathsync"):
        allowed = [lim.check(key, 2, 60) for _ in range(3)]
    assert allowed == [True, True, False]                   # still limited, per worker
    assert lim.fallbacks == 3
    assert sum("rate_limit_fallback" in r.getMessage() for r in caplog.records) == 1   # warned once, not per request
