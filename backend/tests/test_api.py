"""End-to-end checks of the REST API: student flow, security, adaptive triggers, classroom, expert panel,
advisor, study and admin.

Needs the database produced by `python -m pipeline.build_market` and `python -m pipeline.expert_study`;
the tests run on a temporary copy of it (see conftest.py)."""
from __future__ import annotations

import json

import pytest
from conftest import ADMIN_TOKEN, HAVE_DB

pytestmark = pytest.mark.skipif(not HAVE_DB, reason="run pipeline.build_market and pipeline.expert_study first")
ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def new_student(client, **kw):
    r = client.post("/api/students", json={"display_name": "Uji API", "program": "Sistem Informasi",
                                           "target_role": "business_analyst", "consent": True, **kw})
    assert r.status_code == 200, r.text
    j = r.json()
    return j["id"], {"Authorization": f"Bearer {j['token']}"}


@pytest.fixture(scope="module")
def stu(client):
    return new_student(client)


# ---------------------------------------------------------------- security
def test_student_routes_require_their_own_token(client, stu):
    sid, h = stu
    other_sid, other_h = new_student(client)
    assert client.get(f"/api/students/{sid}").status_code == 401                       # no token
    assert client.get(f"/api/students/{sid}", headers=other_h).status_code == 403      # someone else's token
    assert client.get(f"/api/students/{sid}", headers=h).status_code == 200
    assert client.get("/api/students/does-not-exist/dashboard", headers=h).status_code == 404


def test_staff_routes_require_admin(client, stu):
    _, h = stu
    assert client.get("/api/admin/stats").status_code == 401
    assert client.get("/api/admin/stats", headers=h).status_code == 401                # a student token is not staff
    assert client.post("/api/admin/models/1/activate").status_code == 401
    assert client.get("/api/admin/stats", headers=ADMIN).status_code == 200


def test_consent_required(client):
    assert client.post("/api/students", json={"display_name": "x", "consent": False}).status_code == 400


def test_upload_limits(client, stu):
    sid, h = stu
    big = "SELECT a FROM b;\n" * 20_000                                                # 340k characters
    assert client.post(f"/api/students/{sid}/evidence/project", headers=h, data={"title": "x", "text": big}).status_code == 413
    r = client.post(f"/api/students/{sid}/evidence/cv", headers=h, files={"file": ("cv.exe", b"MZ...", "application/octet-stream")})
    assert r.status_code == 415


# ---------------------------------------------------------------- student flow
def test_meta_catalog_and_model_card(client):
    m = client.get("/api/meta").json()
    assert {r["id"] for r in m["roles"]} == {"business_analyst", "data_analyst"}
    assert len(m["skills"]) >= 42 and m["n_items"] >= 210
    card = m["models"]
    assert "not an LLM" in card["decision_model"]["type"] and card["embedding_model"]["name"]
    assert "choosing priorities" in card["llm_is_never_used_for"]
    c = client.get("/api/catalog").json()
    assert c["courses"] and c["certificates"] and "A" in c["grades"]


def test_dashboard_is_read_only(client, stu):
    sid, h = stu
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    assert d["diagnostic_done"] is False and d["blocked_in_path"] == 0
    assert {"what", "why", "why_now", "next"} <= set(d["ranking"][0]["explanation"])
    assert client.get(f"/api/students/{sid}/history", headers=h).json() == []           # a page view writes nothing


def test_transcript_and_academic_evidence(client, stu):
    sid, h = stu
    parsed = client.post(f"/api/students/{sid}/transcript/parse", headers=h,
                         data={"text": "Basis Data, A\nStatistika Bisnis\tB\nSIF2201 Sistem Informasi Manajemen 3 A-"}).json()
    assert [c["name"] for c in parsed["courses"]][0] == "Basis Data" and len(parsed["courses"]) == 3
    r = client.post(f"/api/students/{sid}/evidence/academic", headers=h, json={"courses": parsed["courses"]}).json()
    assert r["scores"]["sql"] == pytest.approx(0.8)
    h1 = client.get(f"/api/students/{sid}/history", headers=h).json()
    assert len(h1) == 1 and h1[0]["trigger"] == "initial"                                # first evidence starts the history


def test_project_evidence_and_integrity(client, stu):
    sid, h = stu
    proj = ("Analisis penjualan toko kampus\nSaya menulis kueri berikut untuk menghitung omzet per wilayah:\n"
            "SELECT region, SUM(amount) FROM orders o JOIN customers c ON o.cid = c.id GROUP BY region;\n"
            "Hasilnya saya visualisasikan dalam dashboard dan menemukan wilayah timur tumbuh paling cepat.")
    r = client.post(f"/api/students/{sid}/evidence/project", headers=h, data={"title": "Analisis penjualan", "text": proj}).json()
    sql = next(x for x in r["ratings"] if x["skill_id"] == "sql")
    assert sql["level"] == 2 and sql["quote"] in proj
    # a job posting pasted as "my project" earns nothing
    from pathsync.config import RAW_DIR
    posting = json.loads((RAW_DIR / "karirhub_20261001.jsonl").read_text(encoding="utf-8").splitlines()[4])["description_text"]
    bad = client.post(f"/api/students/{sid}/evidence/project", headers=h, data={"title": "copy", "text": posting})
    assert bad.status_code == 422
    # keyword stuffing goes to human review and counts at half weight
    stuffed = "SQL. Power BI. Tableau. Agile. Scrum. BPMN. UAT. Jira. Excel pivot table. Stakeholder. BRD. User story.\n" * 4
    r2 = client.post(f"/api/students/{sid}/evidence/project", headers=h, data={"title": "list", "text": stuffed}).json()
    assert r2["review_status"] == "pending" and "keyword_list" in r2["checks"]["flags"]
    assert all(x["level"] <= 2 for x in r2["ratings"])                                   # keywords never reach "mahir"


def test_cv_claims_do_not_count_as_mastery(client, stu):
    sid, h = stu
    before = {c["skill_id"]: c["p"] for c in client.get(f"/api/students/{sid}/dashboard", headers=h).json()["competencies"]}
    client.post(f"/api/students/{sid}/evidence/cv", headers=h,
                data={"text": "Pengalaman menggunakan Jira dan Confluence untuk mengelola backlog tim."})
    after = {c["skill_id"]: c for c in client.get(f"/api/students/{sid}/dashboard", headers=h).json()["competencies"]}
    claimed = [k for k, c in after.items() if c["claimed"]]
    assert claimed and all(after[k]["p"] == pytest.approx(before[k]) for k in claimed)


def test_assessment_sessions_block_replay(client, stu):
    sid, h = stu
    d = client.get(f"/api/students/{sid}/assessment/diagnostic", headers=h).json()
    items, sess = d["items"], d["session_id"]
    assert 20 <= len(items) <= 30 and "answer" not in items[0]
    # an item that was not issued is refused, so is answering the same item twice
    assert client.post(f"/api/students/{sid}/assessment/submit", headers=h,
                       json={"session_id": sess, "answers": [{"item_id": "zzz-1", "choice": 0}]}).status_code == 400
    dup = [{"item_id": items[0]["id"], "choice": 0}] * 2
    assert client.post(f"/api/students/{sid}/assessment/submit", headers=h,
                       json={"session_id": sess, "answers": dup}).status_code == 400
    r = client.post(f"/api/students/{sid}/assessment/submit", headers=h,
                    json={"session_id": sess, "answers": [{"item_id": i["id"], "choice": 0} for i in items]}).json()
    assert r["total"] == len(items)
    # the session is single use and answered items are never served again
    again = client.post(f"/api/students/{sid}/assessment/submit", headers=h,
                        json={"session_id": sess, "answers": [{"item_id": items[0]["id"], "choice": r["results"][0]["answer"]}]})
    assert again.status_code == 409
    skill = "sql"
    seen = {i["id"] for i in items}
    for _ in range(3):
        re = client.get(f"/api/students/{sid}/assessment/reassess/{skill}", headers=h)
        if re.status_code == 409:
            break
        j = re.json()
        assert not {i["id"] for i in j["items"]} & seen
        seen |= {i["id"] for i in j["items"]}
        client.post(f"/api/students/{sid}/assessment/submit", headers=h,
                    json={"session_id": j["session_id"], "answers": [{"item_id": i["id"], "choice": 0} for i in j["items"]]})
    assert client.get(f"/api/students/{sid}/assessment/reassess/{skill}", headers=h).status_code == 409


def test_decision_trace(client, stu):
    sid, h = stu
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    top = d["ranking"][0]["skill_id"]
    t = client.get(f"/api/students/{sid}/trace/{top}", headers=h).json()
    names = [st["stage"] for st in t["stages"]]
    assert names[0].startswith("1.") and any("eq. 4" in n for n in names) and len(names) == 5
    score = next(st for st in t["stages"] if "eq. 4" in st["stage"])
    assert score["result"]["rank"] == 1
    assert sum(x["contribution"] for x in score["inputs"]) == pytest.approx(score["result"]["score"], abs=1e-3)


def test_role_change_trigger_is_recorded(client, stu):
    sid, h = stu
    n0 = len(client.get(f"/api/students/{sid}/history", headers=h).json())
    assert client.patch(f"/api/students/{sid}", headers=h, json={"target_role": "data_analyst"}).status_code == 200
    hist = client.get(f"/api/students/{sid}/history", headers=h).json()
    assert len(hist) == n0 + 1 and hist[0]["trigger"] == "role"
    client.patch(f"/api/students/{sid}", headers=h, json={"target_role": "business_analyst"})


def test_market_simulation_propagates_to_students(client, stu):
    sid, h = stu
    real = client.get("/api/market/business_analyst").json()["version"]
    sim = client.post("/api/admin/market/simulate", headers=ADMIN,
                      json={"role": "business_analyst", "skill_id": "sql", "demand_delta": 0.5, "trend": 0.5}).json()
    assert sim["students_updated"] >= 1
    m = client.get("/api/market/business_analyst").json()
    assert m["simulated"] and m["version"] == sim["version"]
    assert client.get(f"/api/students/{sid}/history", headers=h).json()[0]["trigger"] == "market"
    assert client.post("/api/admin/market/reset?role=business_analyst", headers=ADMIN).json()["version"] == real


def test_market_quotes_trace_to_postings(client):
    ev = client.get("/api/market/business_analyst/skill/requirements_elicitation").json()["evidence"]
    p = client.get(f"/api/postings/{ev[0]['posting_id']}").json()
    assert ev[0]["quote"].strip("- ").split()[0] in p["description"]


def test_graph_and_taxonomy_report(client, stu):
    sid, h = stu
    g = client.get(f"/api/students/{sid}/graph", headers=h).json()
    assert len(g["nodes"]) >= 42 and len(g["edges"]) >= 50 and any(n["in_path"] for n in g["nodes"])
    t = client.get("/api/taxonomy/report").json()
    assert set(t["criteria"]) == {"C1_coverage", "C2_no_frequent_candidate", "C3_grounding"} and len(t["sha256"]) == 64
    assert t["n_core"] + len(t["adjacent_skills"]) == t["n_skills"]


# ---------------------------------------------------------------- classroom
def test_classroom_cycle(client, stu):
    sid, h = stu
    assert client.post(f"/api/students/{sid}/courses", headers=h, json={"name": "Sistem Basis Data"}).status_code == 200
    client.post(f"/api/students/{sid}/courses", headers=h, json={"name": "Analisis dan Perancangan Sistem Informasi"})
    c = client.get(f"/api/students/{sid}/classroom", headers=h).json()
    assert c["courses"] and any(s["evidence_tip"] for s in c["courses"][0]["skills"])
    goals = c["suggested_goals"]
    assert goals and sum(g["minutes"] for g in goals) > 0
    plan = client.post(f"/api/students/{sid}/plans", headers=h, json={"goals": goals}).json()
    r = client.post(f"/api/students/{sid}/plans/{plan['id']}/reflect", headers=h,
                    json={"done_minutes": 200, "confidence": 4, "goals_done": [0], "clarity": 4}).json()
    assert r["ok"]
    c2 = client.get(f"/api/students/{sid}/classroom", headers=h).json()
    assert c2["summary"]["weeks_reflected"] == 1 and c2["clarity"][-1]["value"] == 4


def test_cohort_k_anonymity_and_advisor_scope(client):
    co = client.post("/api/admin/cohorts", headers=ADMIN, json={"name": "BA-2026 kelas A", "institution": "Uji"}).json()
    adv = {"Authorization": f"Bearer {co['advisor_token']}"}
    for _i in range(4):
        sid, h = new_student(client)
        client.post(f"/api/students/{sid}/cohort", headers=h, json={"join_code": co["join_code"]})
    rep = client.get(f"/api/advisor/cohorts/{co['id']}/report", headers=adv).json()
    assert rep["hidden"] is True                                                        # 4 < k = 5
    sid, h = new_student(client)
    client.post(f"/api/students/{sid}/cohort", headers=h, json={"join_code": co["join_code"]})
    rep = client.get(f"/api/advisor/cohorts/{co['id']}/report", headers=adv).json()
    assert rep["hidden"] is False and rep["n_students"] == 5 and rep["top_gaps"]
    other = client.post("/api/admin/cohorts", headers=ADMIN, json={"name": "kelas B"}).json()
    assert client.get(f"/api/advisor/cohorts/{other['id']}/report", headers=adv).status_code == 403


# ---------------------------------------------------------------- study
def test_study_arms_change_the_product(client):
    st = client.post("/api/admin/studies", headers=ADMIN, json={"name": "Uji 4 lengan"}).json()
    arms = {}
    for _i in range(8):
        sid, h = new_student(client)
        r = client.post(f"/api/students/{sid}/study", headers=h, json={"join_code": st["join_code"]}).json()
        arms.setdefault(r["arm"], []).append((sid, h))
    assert set(arms) == {"A", "B", "C", "D"} and all(len(v) == 2 for v in arms.values())    # balanced by minimisation
    sid, h = arms["A"][0]
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    assert d["path"] == [] and d["features"]["graph"] is False
    sid, h = arms["D"][0]
    assert client.get(f"/api/students/{sid}/dashboard", headers=h).json()["path"]
    start = client.post(f"/api/students/{sid}/study/plan/start", headers=h).json()["started_at"]
    r = client.post(f"/api/students/{sid}/study/plan", headers=h,
                    json={"plan_text": "Minggu 1 SQL dasar, minggu 2 analisis data dengan proyek mata kuliah Basis Data.",
                          "started_at": start}).json()
    assert r["ok"]
    res = client.get(f"/api/admin/studies/{st['id']}/results", headers=ADMIN).json()
    assert res["participants"] == {"A": 2, "B": 2, "C": 2, "D": 2}


# ---------------------------------------------------------------- experts & admin
def test_expert_panel_flow(client):
    tokens = [client.post("/api/admin/experts", headers=ADMIN, json={"name": f"Pakar {i}"}).json()["token"] for i in range(3)]
    hs = [{"Authorization": f"Bearer {t}"} for t in tokens]
    assert client.get("/api/expert/edges").status_code == 401
    edges = client.get("/api/expert/edges", headers=hs[0]).json()
    e0, e1 = edges[0]["id"], edges[1]["id"]
    for i, h in enumerate(hs):
        client.post(f"/api/expert/edges/{e0}/vote", headers=h, json={"approve": True})
        client.post(f"/api/expert/edges/{e1}/vote", headers=h, json={"approve": i == 0})
    s = client.post("/api/admin/edges/finalize", headers=ADMIN).json()
    assert s["approved"] >= 1 and s["rejected"] >= 1
    first = edges[0]
    assert client.post("/api/expert/edges", headers=hs[0], json={"src": first["to"], "dst": first["from"]}).status_code == 400
    sc = client.get("/api/expert/scenarios", headers=hs[0]).json()[0]["id"]
    det = client.get(f"/api/expert/scenarios/{sc}", headers=hs[0]).json()
    assert "priority" not in det["candidates"][0]
    order = [c["skill_id"] for c in det["candidates"]]
    assert client.post(f"/api/expert/scenarios/{sc}/rank", headers=hs[0], json={"order": order[:-1]}).status_code == 400
    assert client.post(f"/api/expert/scenarios/{sc}/rank", headers=hs[0], json={"order": order}).status_code == 200
    assert client.post("/api/admin/train", headers=ADMIN, json={"use_simulated": False}).status_code == 400


def test_annotation_f1_and_kappa(client):
    p = client.get("/api/admin/annotation/next?annotator=uji", headers=ADMIN).json()
    gold = client.get(f"/api/postings/{p['posting_id']}").json()
    skills = sorted({m["skill_id"] for m in gold["mentions"] if m["status"] == "auto" and m["skill_id"]})
    client.post("/api/admin/annotation", headers=ADMIN, json={"posting_id": p["posting_id"], "annotator": "uji", "skill_ids": skills})
    ev = client.get("/api/admin/annotation/eval", headers=ADMIN).json()
    assert ev["n_postings"] >= 1 and ev["f1"] == pytest.approx(1.0)


def test_project_review_queue(client, stu):
    sid, h = stu
    q = client.get("/api/admin/project-reviews", headers=ADMIN).json()
    assert q
    r = client.post(f"/api/admin/project-reviews/{q[0]['id']}", headers=ADMIN, json={"decision": "reject"})
    assert r.status_code == 200


def test_data_export_and_erasure(client):
    sid, h = new_student(client)
    client.post(f"/api/students/{sid}/courses", headers=h, json={"name": "Statistika Bisnis"})
    ex = client.get(f"/api/students/{sid}/export", headers=h).json()
    assert ex["profile"]["id"] == sid and ex["courses"] and "token_hash" not in json.dumps(ex)
    assert client.delete(f"/api/students/{sid}", headers=h).json() == {"deleted": True}
    assert client.get(f"/api/students/{sid}", headers=h).status_code == 404


def test_market_update_can_be_stopped(client, monkeypatch):
    import time

    import api.routers.admin as m

    assert client.post("/api/admin/market/refresh/cancel", headers=ADMIN).status_code == 409
    monkeypatch.setattr(m, "REFRESH_STEPS", [("tests._sleeper", "Sleeping"), ("tests._sleeper", "Never reached")])
    assert client.post("/api/admin/market/refresh", headers=ADMIN).json() == {"started": True}
    assert client.post("/api/admin/market/refresh", headers=ADMIN).status_code == 409
    for _ in range(50):
        if m.proc_ref["p"] is not None:
            break
        time.sleep(0.1)
    t0 = time.time()
    assert client.post("/api/admin/market/refresh/cancel", headers=ADMIN).json() == {"cancelled": True}
    for _ in range(100):
        job = client.get("/api/admin/market/refresh", headers=ADMIN).json()
        if not job["running"]:
            break
        time.sleep(0.1)
    assert not job["running"] and job["cancelled"] and job["ok"] is False and time.time() - t0 < 10
