"""PathSync REST API (FastAPI). Run: uvicorn api.main:app --port 8000

Routers: public (catalogue, market, graph, governance, model card), students (profile, evidence,
dashboard, history, decision trace, data rights), assessment (issued sessions), classroom (courses,
weekly plan/reflection, pulse, cohort and study enrolment), expert panel, advisor, admin.
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pathsync.db import get_session, init_db
from pathsync.engine import ensure_seed
from pathsync.security import ensure_admin_token

from .routers import admin, advisor, assessment, classroom, experts, public, students

log = logging.getLogger("pathsync")
logging.basicConfig(level=os.getenv("PATHSYNC_LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")


def _warmup():
    """Load the embedding model and skill index in the background so the first upload is not slow."""
    from pathsync.extraction import skill_index
    from pathsync.intake import _posting_corpus, map_course
    try:
        skill_index()
        map_course("Basis Data")
        _posting_corpus()
    except Exception as e:  # pragma: no cover - warmup is best effort
        log.warning("warmup failed: %s", e)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with get_session() as s:
        ensure_seed(s)
        token = ensure_admin_token(s)
    if token:
        log.warning("No PATHSYNC_ADMIN_TOKEN set: generated an admin token, saved to data/admin_token.txt")
    if os.getenv("PATHSYNC_WARMUP", "1") != "0":
        threading.Thread(target=_warmup, daemon=True).start()
    yield


app = FastAPI(title="PathSync API", version="1.0.0", lifespan=lifespan,
              description="Adaptive, evidence-based learning navigator. Student routes need the bearer token returned "
                          "at sign-up; staff routes need an admin, expert or advisor token.")
origins = [o.strip() for o in os.getenv("PATHSYNC_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PATCH", "DELETE"],
                   allow_headers=["Authorization", "Content-Type"], allow_credentials=False)


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Request-ID"] = rid
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api/") and ms > 1500:
        log.info("slow request %s %s %.0f ms rid=%s", request.method, request.url.path, ms, rid)
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):   # pragma: no cover - last-resort guard
    log.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Try again in a moment."})


for r in (public, students, assessment, classroom, experts, advisor, admin):
    app.include_router(r.router)
