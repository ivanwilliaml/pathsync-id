"""Staff accounts: email + password on top of the staff tokens, invites from the admin, and read-only demo accounts."""
from __future__ import annotations

import uuid

import pytest
from conftest import ADMIN_TOKEN

ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
CSRF = {"X-PathSync": "1"}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def test_password_hash_round_trip():
    from pathsync.staff_accounts import hash_password, verify_password

    h = hash_password("kata-sandi-panjang")
    assert h.startswith("scrypt$") and "kata-sandi" not in h
    assert verify_password("kata-sandi-panjang", h)
    assert not verify_password("salah-sandi-panjang", h)
    assert not verify_password("apa saja", None) and not verify_password("apa saja", "rusak")


def test_invite_set_password_sign_in_and_disable(client):
    email = f"pakar-{uuid.uuid4().hex[:6]}@kampus.ac.id"
    inv = client.post("/api/admin/staff-accounts", headers=ADMIN,
                      json={"email": email.upper(), "name": "Dr. Uji", "role": "expert", "affiliation": "Uji"})
    assert inv.status_code == 200, inv.text
    body = inv.json()
    assert body["status"] == "invited" and body["email"] == email and body["subject_id"]
    token = body["invite_path"].split("token=")[1]
    # the same email cannot be invited twice
    assert client.post("/api/admin/staff-accounts", headers=ADMIN, json={"email": email, "name": "x y", "role": "admin"}).status_code == 409

    assert client.get(f"/api/staff/invite?token={token}").json()["name"] == "Dr. Uji"
    assert client.post("/api/staff/accept", json={"token": token, "password": "pendek"}).status_code == 422
    ok = client.post("/api/staff/accept", json={"token": token, "password": "rahasia-yang-panjang"})
    assert ok.status_code == 200 and ok.json()["role"] == "expert"
    assert client.post("/api/staff/accept", json={"token": token, "password": "rahasia-yang-panjang"}).status_code == 404  # used up

    client.cookies.clear()
    assert client.post("/api/staff/login", json={"email": email, "password": "salah-salah-salah"}).status_code == 401
    assert client.post("/api/staff/login", json={"email": "tidak-ada@x.id", "password": "apa saja"}).status_code == 401
    assert client.post("/api/staff/login", json={"email": email, "password": "rahasia-yang-panjang"}).status_code == 200
    me = client.get("/api/staff/session").json()
    assert me["name"] == "Dr. Uji" and me["email"] == email and me["demo"] is False
    assert client.get("/api/expert/me").status_code == 200

    aid = body["id"]
    assert client.delete(f"/api/admin/staff-accounts/{aid}", headers=ADMIN).json()["status"] == "disabled"
    assert client.get("/api/expert/me").status_code == 401            # the open session ended with the account
    client.cookies.clear()
    assert client.post("/api/staff/login", json={"email": email, "password": "rahasia-yang-panjang"}).status_code == 401


def test_lecturer_invite_needs_a_class(client):
    r = client.post("/api/admin/staff-accounts", headers=ADMIN,
                    json={"email": f"dosen-{uuid.uuid4().hex[:6]}@kampus.ac.id", "name": "Bu Uji", "role": "advisor"})
    assert r.status_code == 400


def test_demo_accounts_can_look_but_not_change(client):
    client.cookies.clear()
    r = client.post("/api/staff/demo", json={"role": "advisor"})
    assert r.status_code == 200 and r.json()["demo"] is True
    cohorts = client.get("/api/advisor/cohorts").json()
    assert cohorts and cohorts[0]["n_students"] >= 5
    assert client.get(f"/api/advisor/cohorts/{cohorts[0]['id']}/report").status_code == 200

    client.cookies.clear()
    assert client.post("/api/staff/demo", json={"role": "expert"}).status_code == 200
    assert client.get("/api/expert/me").status_code == 200
    edges = client.get("/api/expert/edges").json()
    if edges:
        eid = edges[0]["id"]
        assert client.post(f"/api/expert/edges/{eid}/vote", json={"vote": "approve"}, headers=CSRF).status_code == 403
    assert client.post("/api/staff/demo", json={"role": "admin"}).status_code == 422     # no admin demo
    # the demo expert never counts as an expert
    assert all(e["name"] != "Budi Hartono" for e in client.get("/api/admin/experts", headers=ADMIN).json())
    # a demo account cannot be signed into with a password
    assert client.post("/api/staff/login", json={"email": "demo-expert@pathsync.local", "password": "x" * 12}).status_code == 401
