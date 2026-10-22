"""Students sign in with email + password instead of copying an access key."""
import uuid

import pytest


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def _signup(client, email, password="rahasia123"):
    return client.post("/api/students", json={"display_name": "Rani", "consent": True, "email": email, "password": password})


def test_signup_and_login_on_a_second_device(client):
    email = f"rani-{uuid.uuid4().hex[:6]}@Contoh.ac.id"
    r = _signup(client, email)
    assert r.status_code == 200
    sid, first = r.json()["id"], r.json()["token"]
    profile = client.get(f"/api/students/{sid}", headers={"Authorization": f"Bearer {first}"}).json()
    assert profile["email"] == email.lower()

    login = client.post("/api/students/login", json={"email": email.upper(), "password": "rahasia123"})
    assert login.status_code == 200 and login.json()["id"] == sid
    second = login.json()["token"]
    assert second != first
    # both devices stay signed in
    for tok in (first, second):
        assert client.get(f"/api/students/{sid}", headers={"Authorization": f"Bearer {tok}"}).status_code == 200


def test_wrong_password_and_unknown_email_give_the_same_answer(client):
    email = f"budi-{uuid.uuid4().hex[:6]}@contoh.id"
    _signup(client, email)
    a = client.post("/api/students/login", json={"email": email, "password": "salah-sekali"})
    b = client.post("/api/students/login", json={"email": f"nobody-{uuid.uuid4().hex[:6]}@contoh.id", "password": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_duplicate_email_and_weak_input_are_rejected(client):
    email = f"sari-{uuid.uuid4().hex[:6]}@contoh.id"
    assert _signup(client, email).status_code == 200
    assert _signup(client, email).status_code == 409
    assert _signup(client, "bukan-email", ).status_code == 400
    assert _signup(client, f"x-{uuid.uuid4().hex[:6]}@contoh.id", password="pendek").status_code == 400


def test_session_token_cannot_open_another_profile(client):
    a = _signup(client, f"a-{uuid.uuid4().hex[:6]}@contoh.id").json()
    b = _signup(client, f"b-{uuid.uuid4().hex[:6]}@contoh.id").json()
    assert client.get(f"/api/students/{b['id']}", headers={"Authorization": f"Bearer {a['token']}"}).status_code == 403


def test_old_profile_can_add_an_account_and_change_the_password(client):
    old = client.post("/api/students", json={"display_name": "Lama", "consent": True}).json()
    h = {"Authorization": f"Bearer {old['token']}"}
    email = f"lama-{uuid.uuid4().hex[:6]}@contoh.id"
    assert client.put(f"/api/students/{old['id']}/account", headers=h, json={"email": email, "password": "rahasia123"}).status_code == 200
    assert client.post("/api/students/login", json={"email": email, "password": "rahasia123"}).status_code == 200
    # changing it needs the current password
    assert client.put(f"/api/students/{old['id']}/account", headers=h, json={"password": "baru-sekali1"}).status_code == 403
    assert client.put(f"/api/students/{old['id']}/account", headers=h,
                      json={"password": "baru-sekali1", "current_password": "rahasia123"}).status_code == 200
    assert client.post("/api/students/login", json={"email": email, "password": "baru-sekali1"}).status_code == 200


def test_erasing_the_profile_ends_every_session(client):
    email = f"hapus-{uuid.uuid4().hex[:6]}@contoh.id"
    sid = _signup(client, email).json()["id"]
    tok = client.post("/api/students/login", json={"email": email, "password": "rahasia123"}).json()["token"]
    assert client.delete(f"/api/students/{sid}", headers={"Authorization": f"Bearer {tok}"}).status_code in (200, 204)
    assert client.post("/api/students/login", json={"email": email, "password": "rahasia123"}).status_code == 401
    from sqlalchemy import func, select

    from pathsync.db import ApiToken, get_session

    with get_session() as s:
        assert s.scalar(select(func.count()).select_from(ApiToken).where(ApiToken.subject_id == sid)) == 0
