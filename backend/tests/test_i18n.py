"""Per-request display language (plan BE-12): one process serves Indonesian and English, with identical numbers."""
import re
import string

import pytest
from test_api import new_student


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def _fields(text: str) -> set[str]:
    return {f for _, f, _, _ in string.Formatter().parse(text) if f}


def test_every_message_exists_in_both_languages_with_the_same_placeholders():
    from pathsync.i18n import MESSAGES, SUPPORTED

    for key, entry in MESSAGES.items():
        assert set(entry) == set(SUPPORTED), key
        assert entry["en"].strip() and entry["id"].strip(), key
        assert _fields(entry["en"]) == _fields(entry["id"]), key


def test_negotiation():
    from pathsync.i18n import negotiate

    assert negotiate("id", "en-US") == "id"
    assert negotiate(None, "id-ID,id;q=0.9,en;q=0.8") == "id"
    assert negotiate(None, "fr-FR,en;q=0.5") == "en"
    assert negotiate(None, "fr-FR") is None
    assert negotiate("xx", None) is None


def test_dashboard_is_identical_in_numbers_and_different_in_words(client):
    sid, h = new_student(client)
    client.post(f"/api/students/{sid}/evidence/academic", headers=h, json={"courses": [{"name": "Basis Data", "grade": "A"}]})
    en = client.get(f"/api/students/{sid}/dashboard", headers={**h, "Accept-Language": "en"})
    idr = client.get(f"/api/students/{sid}/dashboard", headers={**h, "Accept-Language": "id"})
    assert en.headers["Content-Language"] == "en" and idr.headers["Content-Language"] == "id"
    a, b = en.json(), idr.json()
    assert a["coverage"] == b["coverage"] and a["coverage_proven"] == b["coverage_proven"]
    assert [r["skill_id"] for r in a["ranking"]] == [r["skill_id"] for r in b["ranking"]]
    assert [r["score"] for r in a["ranking"]] == [r["score"] for r in b["ranking"]]
    top_en, top_id = a["ranking"][0], b["ranking"][0]
    assert top_en["name"] != top_id["name"]                         # skill names follow the language
    assert top_en["explanation"]["why_now"] != top_id["explanation"]["why_now"]
    assert re.search(r"\b(lowongan|prasyarat|kamu|skill)\b", top_id["explanation"]["why_now"] + top_id["explanation"]["why"])
    soft_id = {s["skill_id"]: s for s in b["soft_skills"]}
    assert soft_id["verbal_communication"]["level_label"] == "Belum ada pengalaman"


def test_quick_check_items_follow_the_language_with_the_same_key(client):
    from pathsync import assessment
    from pathsync.i18n import use_lang

    with use_lang("en"):
        en = assessment.item_bank()
    with use_lang("id"):
        idr = assessment.item_bank()
    assert set(en) == set(idr)
    same_key = sum(en[k]["answer"] == idr[k]["answer"] for k in en)
    assert same_key == len(en)                                       # grading never depends on the language
    legacy = next(k for k in en if k.startswith("sql-"))
    assert en[legacy]["stem"] != idr[legacy]["stem"]


def test_default_language_without_header(client):
    from pathsync.config import LANG

    r = client.get("/api/meta")
    assert r.headers["Content-Language"] == LANG


def test_every_role_has_an_indonesian_description_and_family_label():
    from pathsync.roles import BLURB_ID, CATALOG, FAMILIES, FAMILIES_ID

    assert {r.id for r in CATALOG} == set(BLURB_ID)
    assert set(FAMILIES) == set(FAMILIES_ID)


def test_meta_roles_and_model_card_follow_the_language(client):
    en = client.get("/api/meta", headers={"Accept-Language": "en"}).json()
    idr = client.get("/api/meta", headers={"X-PathSync-Lang": "id"}).json()
    assert [r["id"] for r in en["roles"]] == [r["id"] for r in idr["roles"]]
    hr_en = next(r for r in en["roles"] if r["id"] == "hr_specialist")["blurb"]
    hr_id = next(r for r in idr["roles"] if r["id"] == "hr_specialist")["blurb"]
    assert hr_en != hr_id and "rekrutmen" in hr_id.lower()
    assert idr["families"]["finance"] == "Keuangan & Akuntansi" and en["families"]["finance"] == "Finance & Accounting"
    card_id = client.get("/api/model-card", headers={"X-PathSync-Lang": "id"}).json()
    assert "bukan LLM" in card_id["decision_model"]["type"] or card_id["decision_model"]["type"].startswith("formula (5)")
