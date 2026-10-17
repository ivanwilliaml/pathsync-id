"""Career Map: readiness for every role, and the role graph."""
import pytest


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def _student(client):
    j = client.post("/api/demo/profile").json()
    return j["id"], {"Authorization": f"Bearer {j['token']}"}


def test_career_graph_links_overlapping_roles(client):
    g = client.get("/api/careers/graph").json()
    ids = {n["id"] for n in g["nodes"]}
    assert len(ids) == len(g["nodes"]) >= 10
    assert all(e["a"] in ids and e["b"] in ids and e["overlap"] >= g["min_overlap"] for e in g["edges"])
    assert any({e["a"], e["b"]} == {"data_engineer", "data_scientist"} for e in g["edges"])
    assert all(n["limited_data"] == (n["n_postings"] < 30) for n in g["nodes"])


def test_target_readiness_matches_dashboard(client):
    sid, h = _student(client)
    careers = client.get(f"/api/students/{sid}/careers", headers=h).json()
    dash = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    target = next(c for c in careers["careers"] if c["is_target"])
    assert careers["any_evidence"] is True
    assert abs(target["readiness"] - dash["coverage"]) < 1e-3
    assert all(0 <= c["readiness"] <= 1 and c["n_measured"] <= c["n_skills"] for c in careers["careers"])
    assert [c["readiness"] for c in careers["careers"]] == sorted((c["readiness"] for c in careers["careers"]), reverse=True)


def test_careers_need_the_students_token(client):
    sid, _ = _student(client)
    assert client.get(f"/api/students/{sid}/careers").status_code in (401, 403)


def test_careers_list_required_skills(client):
    sid, h = _student(client)
    c = client.get(f"/api/students/{sid}/careers", headers=h).json()["careers"]
    ba = next(x for x in c if x["id"] == "business_analyst")
    assert ba["skills"] and all({"skill_id", "name"} <= set(s) for s in ba["skills"])


def test_history_records_readiness_for_every_career(client):
    sid, h = _student(client)
    hist = client.get(f"/api/students/{sid}/history", headers=h).json()
    assert hist and hist[0]["careers"] and "business_analyst" in hist[0]["careers"]
    careers = client.get(f"/api/students/{sid}/careers", headers=h).json()["careers"]
    assert len(hist[0]["careers"]) == len(careers)
