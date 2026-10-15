"""Small launch load test (PM audit P0-3): N simulated students sign up, add a transcript and open the dashboard.

    python deploy/loadtest.py http://localhost:8000 200 40

Arguments: base URL, number of students, concurrency. Each simulated student sends its own X-Forwarded-For, which a
trusted reverse proxy would set to the real client address (see deploy/Caddyfile). Prints latency percentiles per step.

Through Caddy the forged X-Forwarded-For is replaced by the real address, so every student shares one IP and the sign-up
limit applies (that is the point). To measure capacity, run it inside the compose network instead:
    docker compose run --rm --no-deps -v ./deploy:/deploy backend python /deploy/loadtest.py http://backend:8000 200 40
PATHSYNC_LOADTEST_INSECURE=1 accepts the self-signed certificate of https://localhost. With PATHSYNC_LOADTEST_OUT set,
the summary is also written there as JSON (pipeline.report reads data/models/loadtest.json).
"""
import json
import os
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 100
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 20
lat: dict[str, list[float]] = {"signup": [], "transcript": [], "dashboard": []}
errors: list[str] = []
lock = threading.Lock()


def timed(step, fn):
    t = time.perf_counter()
    try:
        r = fn()
    except httpx.HTTPError as e:
        with lock:
            errors.append(f"{step}:{type(e).__name__}")
        return httpx.Response(599)
    with lock:
        lat[step].append((time.perf_counter() - t) * 1000)
        if r.status_code >= 400:
            errors.append(f"{step}:{r.status_code}")
    return r


def student(i: int):
    ip = {"X-Forwarded-For": f"10.{i // 250}.{i % 250}.{i % 200 + 1}"}
    with httpx.Client(base_url=BASE, timeout=60, headers=ip, verify=os.getenv("PATHSYNC_LOADTEST_INSECURE") != "1") as c:
        r = timed("signup", lambda: c.post("/api/students", json={"display_name": f"Load {i}", "program": "Information Systems",
                                                                  "target_role": "business_analyst", "consent": True}))
        if r.status_code != 200:
            return
        j = r.json()
        h = {"Authorization": f"Bearer {j['token']}"}
        timed("transcript", lambda: c.post(f"/api/students/{j['id']}/evidence/academic", headers=h, json={"courses": [
            {"name": "Basis Data", "grade": "A"}, {"name": "Analisis dan Perancangan Sistem", "grade": "B+"}]}))
        timed("dashboard", lambda: c.get(f"/api/students/{j['id']}/dashboard", headers=h))
        c.delete(f"/api/students/{j['id']}", headers=h)   # clean up


t0 = time.time()
with ThreadPoolExecutor(CONC) as ex:
    list(ex.map(student, range(N)))
print(f"{N} students, concurrency {CONC}, {time.time() - t0:.1f}s, errors: {len(errors)} {sorted(set(errors))[:5]}")
summary = {"base": BASE, "students": N, "concurrency": CONC, "seconds": round(time.time() - t0, 1),
           "errors": len(errors), "error_kinds": sorted(set(errors))[:5], "steps": {}}
for step, v in lat.items():
    if v:
        v.sort()
        p95 = v[max(0, int(len(v) * .95) - 1)]
        summary["steps"][step] = {"n": len(v), "p50_ms": round(statistics.median(v)), "p95_ms": round(p95), "max_ms": round(v[-1])}
        print(f"{step:11s} n={len(v):4d} p50={statistics.median(v):6.0f} ms  p95={p95:6.0f} ms  max={v[-1]:6.0f} ms")
if os.getenv("PATHSYNC_LOADTEST_OUT"):
    with open(os.environ["PATHSYNC_LOADTEST_OUT"], "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=1)
