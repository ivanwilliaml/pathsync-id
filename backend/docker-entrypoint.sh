#!/bin/sh
# First start on an empty database: build the market map and the expert study from data/raw, then serve.
set -e
if ! python -c "
from pathsync.db import MarketSnapshot, get_session, init_db
from sqlalchemy import select
init_db()
with get_session() as s:
    raise SystemExit(0 if s.scalar(select(MarketSnapshot.id).limit(1)) else 1)
"; then
  echo "[entrypoint] database kosong: membangun peta pasar dan studi pakar"
  python -m pipeline.build_market --extractor "${PATHSYNC_BUILD_EXTRACTOR:-lexicon}" --ref "${PATHSYNC_REF_DATE:-$(date +%F)}"   # postings published after the reference date are left out of the window
  python -m pipeline.expert_study
fi
exec uvicorn api.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers --workers "${PATHSYNC_WORKERS:-1}"
