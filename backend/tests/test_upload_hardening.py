"""Uploaded files are untrusted (audit 21 Oct): every bad file gets a clear 4xx, never a 5xx, and the status code says why."""
import io
import os
import zipfile

import pytest
from test_api import new_student


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def _upload(client, name, data, ctype="application/octet-stream", endpoint="transcript/parse"):
    sid, h = new_student(client)
    return client.post(f"/api/students/{sid}/{endpoint}", headers=h, files={"file": (name, data, ctype)})


def _zip_with(name: str, size: int) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(name, b"\0" * size)
    return buf.getvalue()


@pytest.mark.parametrize("endpoint", ["transcript/parse", "evidence/cv"])
def test_damaged_documents_are_a_client_error_with_the_right_code(client, endpoint):
    assert _upload(client, "a.pdf", b"", endpoint=endpoint).status_code == 415             # not a PDF at all
    assert _upload(client, "a.pdf", b"MZ\x90\x00" + os.urandom(2000), endpoint=endpoint).status_code == 415
    assert _upload(client, "a.pdf", b"%PDF-1.4 garbage", endpoint=endpoint).status_code == 422
    # a damaged Word file is not "too large": 422, not 413 (audit finding)
    assert _upload(client, "a.docx", b"PK\x03\x04" + os.urandom(500), endpoint=endpoint).status_code == 422


def test_a_zip_bomb_disguised_as_docx_is_refused_as_too_large(client):
    bomb = _zip_with("word/document.xml", 45 * 1024 * 1024)       # ~45 KB on the wire, 45 MB when unpacked
    assert len(bomb) < 1024 * 1024
    r = _upload(client, "cv.docx", bomb)
    assert r.status_code == 413, r.text


def test_oversized_uploads_are_refused_before_parsing(client):
    r = _upload(client, "a.pdf", b"%PDF-1.4\n" + os.urandom(6 * 1024 * 1024), "application/pdf")
    assert r.status_code == 413


def test_plain_text_and_odd_file_names_never_crash(client):
    assert _upload(client, "nilai.txt", ("Basis Data A\n" * 40).encode(), "text/plain").status_code == 200
    for name in ("../../x.pdf", "a" * 400 + ".pdf", "<script>.pdf", "nul\x00.pdf"):
        assert _upload(client, name, b"%PDF-1.4").status_code in (415, 422)
