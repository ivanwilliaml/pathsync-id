"""PM audit P0-3: the rate-limit key must not be spoofable through X-Forwarded-For."""
from types import SimpleNamespace

from pathsync.security import client_ip


def req(peer, xff=None):
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers={"x-forwarded-for": xff} if xff else {})


def test_direct_client_cannot_spoof():
    assert client_ip(req("203.0.113.9", "10.0.0.1")) == "203.0.113.9"


def test_trusted_proxy_appends_real_peer_after_spoofed_value():
    # browser sent "X-Forwarded-For: 10.0.0.1"; the local proxy (127.0.0.1) appended the real peer
    assert client_ip(req("127.0.0.1", "10.0.0.1, 198.51.100.7")) == "198.51.100.7"


def test_chain_of_trusted_proxies():
    assert client_ip(req("127.0.0.1", "198.51.100.7, 127.0.0.1")) == "198.51.100.7"
    assert client_ip(req("127.0.0.1")) == "127.0.0.1"


def test_frontend_header_needs_the_shared_secret(monkeypatch):
    import pathsync.security as sec
    monkeypatch.setattr(sec, "PROXY_SECRET", "s3cret")
    h = {"x-pathsync-client-ip": "198.51.100.7", "x-pathsync-proxy-secret": "s3cret"}
    assert client_ip(SimpleNamespace(client=SimpleNamespace(host="76.76.21.1"), headers=h)) == "198.51.100.7"
    h["x-pathsync-proxy-secret"] = "wrong"
    assert client_ip(SimpleNamespace(client=SimpleNamespace(host="76.76.21.1"), headers=h)) == "76.76.21.1"
    monkeypatch.setattr(sec, "PROXY_SECRET", "")
    h["x-pathsync-proxy-secret"] = ""
    assert client_ip(SimpleNamespace(client=SimpleNamespace(host="76.76.21.1"), headers=h)) == "76.76.21.1"
