"""Sync, the in-app assistant: grounded tools, verbatim posting cards, no identifying data to the model, read only.
The Groq call is replaced by a scripted model, so these tests never reach the network."""
from __future__ import annotations

import json

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


def test_off_without_a_key(client, student, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    sid, h = student
    assert client.get("/api/sync/status").json() == {"enabled": False}
    r = client.post(f"/api/students/{sid}/sync", headers=h, json={"messages": [{"role": "user", "content": "halo"}]})
    assert r.status_code == 503


def test_posting_fit_is_grounded_and_shown_verbatim(client, student, monkeypatch):
    import pathsync.sync_agent as sa

    sid, h = student
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    posting = client.get("/api/postings?role=business_analyst&limit=1").json()[0]
    full = client.get(f"/api/postings/{posting['id']}").json()
    sent: list[list[dict]] = []
    script = [
        {"content": "", "tool_calls": [
            {"id": "a", "type": "function", "function": {"name": "my_profile", "arguments": "{}"}},
            {"id": "b", "type": "function", "function": {"name": "open_posting", "arguments": json.dumps({"posting_id": posting["id"]})}},
            {"id": "c", "type": "function", "function": {"name": "match_posting", "arguments": json.dumps({"posting_id": posting["id"]})}},
        ]},
        {"content": "Kamu cukup cocok; lihat kartu di bawah."},
    ]

    def fake(messages, tools=True):
        sent.append(json.loads(json.dumps(messages)))
        return script[len(sent) - 1]

    monkeypatch.setattr(sa, "_groq", fake)
    r = client.post(f"/api/students/{sid}/sync", headers=h,
                    json={"messages": [{"role": "user", "content": "Seberapa cocok aku dengan lowongan ini?"}]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["reply"].startswith("Kamu cukup cocok")
    kinds = [c["type"] for c in out["cards"]]
    assert kinds == ["posting", "match"]
    assert out["cards"][0]["description"] == full["description"]          # the posting, word for word
    match = out["cards"][1]
    assert all(row["status"] in ("met", "close", "gap", "unproven") for row in match["rows"])
    # the model was given tool results, and nothing that identifies the student
    blob = json.dumps(sent)
    assert "Rani" not in blob and sid not in blob
    assert any(m.get("role") == "tool" for m in sent[-1])


def test_unknown_tools_and_ids_are_handled(client, student, monkeypatch):
    import pathsync.sync_agent as sa

    sid, h = student
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    calls = iter([
        {"content": "", "tool_calls": [
            {"id": "x", "type": "function", "function": {"name": "delete_everything", "arguments": "{}"}},
            {"id": "y", "type": "function", "function": {"name": "open_posting", "arguments": "{\"posting_id\": \"nope\"}"}},
        ]},
        {"content": "Aku tidak bisa melakukan itu."},
    ])
    monkeypatch.setattr(sa, "_groq", lambda messages, tools=True: next(calls))
    out = client.post(f"/api/students/{sid}/sync", headers=h, json={"messages": [{"role": "user", "content": "hapus"}]}).json()
    assert out["cards"] == [] and out["reply"]


def test_other_students_cannot_use_my_sync(client, student, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    sid, _ = student
    other = client.post("/api/demo/profile").json()
    r = client.post(f"/api/students/{sid}/sync", headers={"Authorization": f"Bearer {other['token']}"},
                    json={"messages": [{"role": "user", "content": "halo"}]})
    assert r.status_code in (401, 403)


def test_rate_limit_becomes_a_clear_retry_message(client, student, monkeypatch):
    import pathsync.sync_agent as sa

    sid, h = student
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    def busy(messages, tools=True):
        raise sa.SyncBusy(9)

    monkeypatch.setattr(sa, "_groq", busy)
    r = client.post(f"/api/students/{sid}/sync", headers={**h, "X-PathSync-Lang": "id"},
                    json={"messages": [{"role": "user", "content": "halo"}]})
    assert r.status_code == 429 and "9 detik" in r.json()["detail"]


def test_replies_are_plain_text():
    from pathsync.sync_agent import _plain

    assert (_plain("**Cocok** untuk\n## Judul\n* a **b**  \n\n\n\nLangkah berikutnya: Belajar")
            == "**Cocok** untuk Judul\n\n- a **b**\n\nLangkah berikutnya: Belajar")
    assert _plain("satu **dua") == "satu dua"


def test_replies_are_cut_to_one_shape():
    from pathsync.sync_agent import _plain

    drifted = ("Kamu belum cocok, ada 4 skill *gap*:\n\n- a – x\n- b – y\n- c – z\n- d – w\n\nTidak ada yang terpenuhi.\n\n"
               "Langkah selanjutnya di PathSync: 1. Kenali Skill → cek detail. 2. Belajar → ikuti kursus.")
    assert _plain(drifted) == ("Kamu belum cocok, ada 4 skill gap:\n\n- a – x\n- b – y\n- c – z\n\n"
                               "Langkah berikutnya: Kenali Skill → cek detail.")
    assert _plain("Maaf, itu di luar topik.") == "Maaf, itu di luar topik."
