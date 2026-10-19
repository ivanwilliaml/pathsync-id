"""Learn page: the demo student starts with this semester's courses, and finished materials are tracked without
ever changing mastery."""
import pytest


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def student(client):
    j = client.post("/api/demo/profile").json()
    return j["id"], {"Authorization": f"Bearer {j['token']}"}


def test_demo_profile_has_current_courses(client, student):
    sid, h = student
    courses = client.get(f"/api/students/{sid}/courses", headers=h).json()
    assert len(courses) >= 3 and all(c["mapping"] for c in courses)
    room = client.get(f"/api/students/{sid}/classroom", headers=h).json()
    assert room["courses"] and any(sk["on_path"] for c in room["courses"] for sk in c["skills"])


def test_finishing_a_material_is_tracked_but_never_raises_mastery(client, student):
    sid, h = student
    before = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    # the demo has already finished some materials; take one that is still open
    i, step, m = next((i, s, x) for i, s in enumerate(before["path"]) for x in s["materials"] if not x["done"])
    r = client.put(f"/api/students/{sid}/materials/{m['id']}", json={"done": True}, headers=h)
    assert r.status_code == 200 and m["id"] in r.json()["materials_done"]
    after = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    assert next(x for x in after["path"][i]["materials"] if x["id"] == m["id"])["done"] is True
    assert after["coverage"] == before["coverage"] and after["path"][i]["p"] == step["p"]
    client.put(f"/api/students/{sid}/materials/{m['id']}", json={"done": False}, headers=h)
    again = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    assert next(x for x in again["path"][i]["materials"] if x["id"] == m["id"])["done"] is False


def test_unknown_material_and_other_students_are_refused(client, student):
    sid, h = student
    assert client.put(f"/api/students/{sid}/materials/nope", json={"done": True}, headers=h).status_code == 404
    other = client.post("/api/demo/profile").json()
    assert client.put(f"/api/students/{other['id']}/materials/m001", json={"done": True}, headers=h).status_code in (401, 403)
