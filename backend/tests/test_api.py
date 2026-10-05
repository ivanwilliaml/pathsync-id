"""End-to-end checks of the REST API (student flow, adaptive triggers, expert panel, admin).

Needs the database produced by `python -m pipeline.build_market` and `python -m pipeline.expert_study`;
the tests run on a temporary copy of it (see conftest.py)."""
from __future__ import annotations

import pytest

from conftest import HAVE_DB

pytestmark = pytest.mark.skipif(not HAVE_DB, reason="jalankan pipeline.build_market dan pipeline.expert_study dulu")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def sid(client):
    r = client.post("/api/students", json={"display_name": "Uji API", "program": "Sistem Informasi",
                                           "target_role": "business_analyst", "consent": True})
    assert r.status_code == 200
    return r.json()["id"]


def test_meta_and_catalog(client):
    m = client.get("/api/meta").json()
    assert {r["id"] for r in m["roles"]} == {"business_analyst", "data_analyst"}
    assert len(m["skills"]) >= 42 and m["n_items"] >= 210
    c = client.get("/api/catalog").json()
    assert c["courses"] and c["certificates"] and "A" in c["grades"]


def test_consent_required(client):
    r = client.post("/api/students", json={"display_name": "x", "consent": False})
    assert r.status_code == 400


def test_unknown_student_is_404(client):
    assert client.get("/api/students/tidak-ada/dashboard").status_code == 404


def test_dashboard_before_evidence(client, sid):
    d = client.get(f"/api/students/{sid}/dashboard").json()
    assert d["diagnostic_done"] is False
    assert 1 <= len(d["ranking"][:3]) and d["path"]
    # every path step is schedulable: the recommended order never blocks a step
    assert d["blocked_in_path"] == 0 and d["counterfactual"]["recommended_blocked"] == 0
    top = d["ranking"][0]
    assert {"what", "why", "why_now", "next"} <= set(top["explanation"])


def test_transcript_parse_and_academic_evidence(client, sid):
    parsed = client.post(f"/api/students/{sid}/transcript/parse",
                         data={"text": "Basis Data, A\nStatistika Bisnis\tB\nSIF2201 Sistem Informasi Manajemen 3 A-"}).json()
    names = [c["name"] for c in parsed["courses"]]
    assert "Basis Data" in names and len(names) == 3
    r = client.post(f"/api/students/{sid}/evidence/academic", json={"courses": parsed["courses"]}).json()
    assert r["scores"]["sql"] == pytest.approx(0.8)          # Basis Data: A (1.0) x mapping strength 0.8


def test_certificate_and_project_evidence(client, sid):
    r = client.post(f"/api/students/{sid}/evidence/certificate",
                    json={"certificates": [{"name": "Google Data Analytics Professional Certificate"}]}).json()
    assert r["certificates"][0]["method"] == "katalog" and "data_analysis" in r["scores"]
    proj = ("Analisis penjualan\nSELECT region, SUM(amount) FROM orders o JOIN customers c ON o.cid = c.id GROUP BY region;\n"
            "Hasilnya divisualisasikan dalam dashboard.")
    r = client.post(f"/api/students/{sid}/evidence/project", data={"title": "Analisis penjualan", "text": proj}).json()
    sql = next(x for x in r["ratings"] if x["skill_id"] == "sql")
    assert sql["level"] == 2 and sql["quote"] in proj      # JOIN/GROUP BY -> "mandiri", quote verbatim


def test_cv_claims_do_not_count_as_mastery(client, sid):
    before = {c["skill_id"]: c["p"] for c in client.get(f"/api/students/{sid}/dashboard").json()["competencies"]}
    client.post(f"/api/students/{sid}/evidence/cv", data={"text": "Pengalaman menggunakan Jira dan Confluence untuk mengelola backlog tim."})
    after = {c["skill_id"]: c for c in client.get(f"/api/students/{sid}/dashboard").json()["competencies"]}
    claimed = [k for k, c in after.items() if c["claimed"]]
    assert claimed
    for k in claimed:
        assert after[k]["p"] == pytest.approx(before[k])


def test_diagnostic_and_reassessment(client, sid):
    items = client.get(f"/api/students/{sid}/assessment/diagnostic").json()["items"]
    assert 20 <= len(items) <= 30
    assert "answer" not in items[0]                         # answer key never sent to the browser
    r = client.post(f"/api/students/{sid}/assessment/submit",
                    json={"phase": "diagnostic", "answers": [{"item_id": i["id"], "choice": 0} for i in items]}).json()
    assert r["total"] == len(items)
    d = client.get(f"/api/students/{sid}/dashboard").json()
    assert d["diagnostic_done"] is True
    skill = d["ranking"][0]["skill_id"]
    re = client.get(f"/api/students/{sid}/assessment/reassess/{skill}").json()
    answered = {i["id"] for i in items}
    assert re["items"] and not {i["id"] for i in re["items"]} & answered


def test_role_change_trigger_is_recorded(client, sid):
    n0 = len(client.get(f"/api/students/{sid}/history").json())
    assert client.patch(f"/api/students/{sid}", json={"target_role": "data_analyst"}).status_code == 200
    h = client.get(f"/api/students/{sid}/history").json()
    assert len(h) == n0 + 1 and h[0]["trigger"] == "role"
    client.patch(f"/api/students/{sid}", json={"target_role": "business_analyst"})


def test_market_simulation_trigger_and_reset(client, sid):
    client.get(f"/api/students/{sid}/dashboard")
    real = client.get("/api/market/business_analyst").json()["version"]
    sim = client.post("/api/admin/market/simulate", json={"role": "business_analyst", "skill_id": "sql",
                                                          "demand_delta": 0.5, "trend": 0.5}).json()
    m = client.get("/api/market/business_analyst").json()
    assert m["simulated"] and m["version"] == sim["version"]
    client.get(f"/api/students/{sid}/dashboard")
    triggers = [h["trigger"] for h in client.get(f"/api/students/{sid}/history").json()]
    assert "market" in triggers
    assert client.post("/api/admin/market/reset?role=business_analyst").json()["version"] == real


def test_market_quotes_trace_to_postings(client):
    ev = client.get("/api/market/business_analyst/skill/requirements_elicitation").json()["evidence"]
    assert ev
    p = client.get(f"/api/postings/{ev[0]['posting_id']}").json()
    assert ev[0]["quote"].strip("- ").split()[0] in p["description"]


def test_graph_payload(client, sid):
    g = client.get(f"/api/students/{sid}/graph").json()
    assert len(g["nodes"]) >= 42 and len(g["edges"]) >= 50
    assert any(n["in_path"] for n in g["nodes"])


def test_expert_panel_flow(client):
    ids = [client.post("/api/experts", json={"name": f"Pakar {i}", "kind": "dosen"}).json()["id"] for i in range(3)]
    edges = client.get("/api/expert/edges").json()
    e0, e1 = edges[0]["id"], edges[1]["id"]
    for i, ex in enumerate(ids):
        client.post(f"/api/expert/edges/{e0}/vote", json={"expert_id": ex, "approve": True})
        client.post(f"/api/expert/edges/{e1}/vote", json={"expert_id": ex, "approve": i == 0})
    s = client.post("/api/expert/edges/finalize").json()
    assert s["approved"] >= 1 and s["rejected"] >= 1
    status = {e["id"]: e["status"] for e in client.get("/api/expert/edges").json()}
    assert status[e0] == "approved" and status[e1] == "rejected"
    # a cycle-creating proposal is refused
    first = edges[0]
    assert client.post("/api/expert/edges", json={"src": first["to"], "dst": first["from"]}).status_code == 400

    sc = client.get("/api/expert/scenarios").json()[0]["id"]
    det = client.get(f"/api/expert/scenarios/{sc}").json()
    assert "priority" not in det["candidates"][0]           # experts rank blind to the system output
    order = [c["skill_id"] for c in det["candidates"]]
    assert client.post(f"/api/expert/scenarios/{sc}/rank", json={"expert_id": ids[0], "order": order[:-1]}).status_code == 400
    assert client.post(f"/api/expert/scenarios/{sc}/rank", json={"expert_id": ids[0], "order": order}).status_code == 200
    assert client.post("/api/expert/train", json={"use_simulated": False}).status_code == 400   # < 3 base scenarios


def test_annotation_f1(client):
    p = client.get("/api/annotation/next?annotator=uji").json()
    gold = client.get(f"/api/postings/{p['posting_id']}").json()
    skills = sorted({m["skill_id"] for m in gold["mentions"] if m["status"] == "auto" and m["skill_id"]})
    client.post("/api/annotation", json={"posting_id": p["posting_id"], "annotator": "uji", "skill_ids": skills})
    ev = client.get("/api/annotation/eval").json()
    assert ev["n_postings"] >= 1 and ev["f1"] == pytest.approx(1.0)


def test_market_update_can_be_stopped(client, monkeypatch):
    import time

    import api.main as m

    assert client.post("/api/admin/market/refresh/cancel").status_code == 409     # nothing running yet
    monkeypatch.setattr(m, "_REFRESH_STEPS", [("tests._sleeper", "Sleeping"), ("tests._sleeper", "Never reached")])
    assert client.post("/api/admin/market/refresh").json() == {"started": True}
    assert client.post("/api/admin/market/refresh").status_code == 409           # no second run in parallel
    for _ in range(50):
        if m._proc["p"] is not None:
            break
        time.sleep(0.1)
    t0 = time.time()
    assert client.post("/api/admin/market/refresh/cancel").json() == {"cancelled": True}
    for _ in range(100):
        job = client.get("/api/admin/market/refresh").json()
        if not job["running"]:
            break
        time.sleep(0.1)
    assert not job["running"] and job["cancelled"] and job["ok"] is False
    assert job["step_index"] == 0 and time.time() - t0 < 10                       # stopped in the first step
