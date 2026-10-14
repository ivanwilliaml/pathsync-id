"""API tests run against a throwaway copy of the database built by the pipelines, so the
real data/pathsync.db is never modified. The copy is made before pathsync.config is imported.

Set PATHSYNC_TEST_DATABASE_URL (for example a PostgreSQL database already filled by
build_market and expert_study) to run the suite against that database instead; it is
modified by the tests, so point it at a throwaway database."""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

_SRC_DB = Path(__file__).resolve().parents[1] / "data" / "pathsync.db"
_TMP_DIR = Path(tempfile.mkdtemp(prefix="pathsync-test-"))
_EXTERNAL_DB = os.getenv("PATHSYNC_TEST_DATABASE_URL")
HAVE_DB = bool(_EXTERNAL_DB) or _SRC_DB.exists()

if _EXTERNAL_DB:
    os.environ["PATHSYNC_DATABASE_URL"] = _EXTERNAL_DB
elif HAVE_DB:
    shutil.copy(_SRC_DB, _TMP_DIR / "pathsync.db")
    os.environ["PATHSYNC_DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'pathsync.db').as_posix()}"
os.environ["PATHSYNC_WARMUP"] = "0"
os.environ.setdefault("PATHSYNC_EXTRACTOR", "lexicon")


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP_DIR, ignore_errors=True)

# fixed admin token for the API tests; rate limiting off so the suite can create many profiles
ADMIN_TOKEN = "test-admin-token-0123456789"
os.environ["PATHSYNC_ADMIN_TOKEN"] = ADMIN_TOKEN
os.environ["PATHSYNC_RATE_LIMIT"] = "0"
os.environ["PATHSYNC_MIN_SECONDS_PER_ITEM"] = "0"
