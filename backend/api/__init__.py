"""PathSync API package.

Local secrets (e.g. GROQ_API_KEY for Sync) can live in backend/.env (git-ignored) as KEY=value lines. They are read
once here, before any module reads the environment, and never override a variable that is already set, so the real
environment (Railway, CI) always wins.
"""
from __future__ import annotations

import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(Path(__file__).resolve().parent.parent / ".env")
