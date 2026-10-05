"""API tests run against a throwaway copy of the database built by the pipelines, so the
real data/pathsync.db is never modified. The copy is made before pathsync.config is imported."""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

_SRC_DB = Path(__file__).resolve().parents[1] / "data" / "pathsync.db"
_TMP_DIR = Path(tempfile.mkdtemp(prefix="pathsync-test-"))
HAVE_DB = _SRC_DB.exists()

if HAVE_DB:
    shutil.copy(_SRC_DB, _TMP_DIR / "pathsync.db")
    os.environ["PATHSYNC_DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'pathsync.db').as_posix()}"
os.environ["PATHSYNC_WARMUP"] = "0"
os.environ.setdefault("PATHSYNC_EXTRACTOR", "lexicon")


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP_DIR, ignore_errors=True)
