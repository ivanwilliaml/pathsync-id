"""Query-plan audit for plan B4. Run against a THROWAWAY PostgreSQL database that already holds the
demo data (build_market + expert_study); it adds synthetic students and answers, then explains every
SQL statement the heavy endpoints issue.

    cd backend
    PATHSYNC_DATABASE_URL=postgresql+psycopg://user@host/throwaway python ../deploy/explain_queries.py [students]

Synthetic rows are named "Synthetic load N" and only ever go into the database you point it at.
Prints, per endpoint, each statement's execution time and any sequential scan on a large table.
"""
from __future__ import annotations

import os
import random
import re
import sys
from datetime import timedelta

sys.path.insert(0, os.getcwd())
os.environ.setdefault("PATHSYNC_WARMUP", "0")
os.environ.setdefault("PATHSYNC_RATE_LIMIT", "0")

from sqlalchemy import event, func, select, text  # noqa: E402

from pathsync.db import (  # noqa: E402
    AssessmentResponse,
    Evidence,
    ProductEvent,
    RecommendationHistory,
    SessionLocal,
    Student,
    _engine,
    utcnow,
)

N_STUDENTS = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
LARGE = ("students", "assessment_responses", "recommendation_history", "evidence", "product_events",
         "posting_mentions", "postings", "audit_log", "assessment_sessions")


def seed(n: int) -> None:
    if _engine.dialect.name != "postgresql":
        raise SystemExit("point PATHSYNC_DATABASE_URL at a throwaway PostgreSQL database")
    with SessionLocal() as s:
        have = s.scalar(select(func.count()).select_from(Student).where(Student.display_name.like("Synthetic load %")))
        if have >= n:
            return
        from pathsync import assessment
        items = list(assessment.item_bank().values())
        rng = random.Random(0)
        now = utcnow()
        for i in range(have, n):
            st = Student(display_name=f"Synthetic load {i}", program="Information Systems", target_role="business_analyst",
                         consent_at=now, last_seen_at=now - timedelta(days=rng.randint(0, 60)))
            s.add(st)
            s.flush()
            s.add(Evidence(student_id=st.id, kind="academic", title="Transcript", scores={"sql": 0.7, "excel": 0.8},
                           details={"strength": 1.0, "courses": []}))
            for it in rng.sample(items, 20):
                s.add(AssessmentResponse(student_id=st.id, item_id=it["id"], skill_id=it["skill_id"], correct=rng.random() < 0.6,
                                         phase="diagnostic", session_id="synthetic", choice_canon=rng.randint(0, 3)))
            for k in range(3):
                s.add(RecommendationHistory(student_id=st.id, trigger="evidence", summary="synthetic", reasons=[], ranking=[],
                                            path=[], coverage=0.5, market_version="synthetic", model_name="synthetic"))
            for k in range(10):
                s.add(ProductEvent(name="view", student_id=st.id, props={}, created_at=now - timedelta(days=rng.randint(0, 30))))
            if i % 200 == 199:
                s.commit()
        s.commit()
        s.execute(text("ANALYZE"))
        s.commit()


def capture(fn) -> list[tuple[str, object]]:
    seen: list[tuple[str, object]] = []

    def hook(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            seen.append((statement, parameters))
    event.listen(_engine, "before_cursor_execute", hook)
    try:
        fn()
    finally:
        event.remove(_engine, "before_cursor_execute", hook)
    return seen


def explain(statement: str, params) -> tuple[float, list[str]]:
    with _engine.connect() as c:
        rows = c.exec_driver_sql("EXPLAIN (ANALYZE, BUFFERS) " + statement, params).fetchall()
    plan = [r[0] for r in rows]
    ms = next((float(m.group(1)) for line in plan if (m := re.search(r"Execution Time: ([\d.]+) ms", line))), 0.0)
    seq = [line.strip() for line in plan if "Seq Scan on" in line and any(f" {t} " in line + " " for t in LARGE)]
    return ms, seq


def main() -> None:
    from fastapi.testclient import TestClient

    from api.main import app

    seed(N_STUDENTS)
    with TestClient(app) as c:
        admin = {"Authorization": f"Bearer {os.environ['PATHSYNC_ADMIN_TOKEN']}"}
        j = c.post("/api/students", json={"display_name": "Explain", "target_role": "business_analyst", "consent": True}).json()
        h = {"Authorization": f"Bearer {j['token']}"}
        flows = {
            "transcript": lambda: c.post(f"/api/students/{j['id']}/evidence/academic", headers=h,
                                         json={"courses": [{"name": "Basis Data", "grade": "A"}]}),
            "dashboard": lambda: c.get(f"/api/students/{j['id']}/dashboard", headers=h),
            "history": lambda: c.get(f"/api/students/{j['id']}/history", headers=h),
            "admin metrics": lambda: c.get("/api/admin/metrics", headers=admin),
            "admin stats": lambda: c.get("/api/admin/stats", headers=admin),
            "item analysis": lambda: c.get("/api/admin/item-analysis", headers=admin),
            "market": lambda: c.get("/api/market/business_analyst"),
        }
        flows["dashboard"]()                       # warm the shared context first
        bad = 0
        for name, fn in flows.items():
            stmts = capture(fn)
            total, worst = 0.0, []
            for stmt, params in stmts:
                ms, seq = explain(stmt, params)
                total += ms
                if seq:
                    worst.append((ms, seq, " ".join(stmt.split())[:160]))
            print(f"\n== {name}: {len(stmts)} SELECTs, {total:.1f} ms in the database")
            for ms, seq, stmt in sorted(worst, reverse=True):
                bad += 1
                print(f"   {ms:7.2f} ms  {seq[0]}\n             {stmt}")
        print(f"\nsequential scans on large tables: {bad}")


if __name__ == "__main__":
    main()
