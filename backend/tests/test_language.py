"""Display language per request: the web app's ID/EN switch sends X-PathSync-Lang and every display text follows it,
while scores, rankings and answer keys stay identical."""
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


def _get(client, path, headers, lang):
    return client.get(path, headers={**headers, "X-PathSync-Lang": lang}).json()


def test_dashboard_text_follows_the_requested_language(client, student):
    sid, h = student
    en = _get(client, f"/api/students/{sid}/dashboard", h, "en")
    id_ = _get(client, f"/api/students/{sid}/dashboard", h, "id")
    # same decision in both languages
    assert [r["skill_id"] for r in en["ranking"]] == [r["skill_id"] for r in id_["ranking"]]
    assert en["coverage"] == id_["coverage"]
    top_en, top_id = en["ranking"][0], id_["ranking"][0]
    assert top_en["explanation"]["what"].startswith("Focus on")
    assert top_id["explanation"]["what"].startswith("Fokus pada")
    # skill names follow the language too (decision 18 Oct: the Indonesian interface shows Indonesian skill names)
    assert top_en["name"] != top_id["name"]
    step_en, step_id = en["path"][0], id_["path"][0]
    assert step_en["learn_what"] != step_id["learn_what"]


def test_requests_without_a_language_use_the_server_default(client, student):
    from pathsync.config import LANG

    sid, h = student
    plain = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    explicit = _get(client, f"/api/students/{sid}/dashboard", h, LANG)
    assert plain["ranking"][0]["explanation"] == explicit["ranking"][0]["explanation"]


def test_unknown_language_falls_back(client, student):
    sid, h = student
    r = client.get(f"/api/students/{sid}/dashboard", headers={**h, "X-PathSync-Lang": "fr"})
    assert r.status_code == 200


def test_errors_are_translated(client):
    r = client.get("/api/market/no_such_role", headers={"X-PathSync-Lang": "id"})
    assert r.status_code == 404 and r.json()["detail"] == "Role tidak dikenal."
    r = client.get("/api/market/no_such_role", headers={"X-PathSync-Lang": "en"})
    assert r.json()["detail"] == "Unknown role."


def test_item_bank_shares_the_answer_key_across_languages():
    from pathsync.assessment import item_bank

    en, id_ = item_bank("en"), item_bank("id")
    assert en.keys() == id_.keys()
    assert all(en[k]["answer"] == id_[k]["answer"] for k in en)
