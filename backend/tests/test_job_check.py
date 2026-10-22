"""One-posting analysis: browser spans, honest scores, path, and route access."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from pathsync.extraction.base import ExtractionResult, Mention
from pathsync.job_check import analyze_job, check_job
from pathsync.ranker import RankingModel
from pathsync.taxonomy import Edge, SkillGraph


def _state(p: float, proven: float | None = None, evidence: bool = False):
    return SimpleNamespace(p=p, p_proven=proven, has_evidence=evidence, confidence=0.5)


def _context():
    graph = SkillGraph({"elicitation": object(), "sql": object()},
                       [Edge("elicitation", "sql", "test", "needed first", "approved")])
    return SimpleNamespace(skills=graph.skills, names={"elicitation": "Elisitasi Kebutuhan", "sql": "SQL"},
                           graph=graph, model=RankingModel())


def test_check_job_uses_posting_requirements_and_starts_with_prerequisite():
    text = "🧭 Mampu menggunakan SQL secara mandiri."
    result = ExtractionResult(mentions=[Mention("SQL", text[2:], "mandiri", "sql")])
    states = {"sql": _state(0.60, 0.30, True), "elicitation": _state(0.10)}

    out = analyze_job(text, result, states, _context())

    assert out["n_recognized_skills"] == 1
    assert out["readiness"]["score"] == round(0.60 / 0.725, 4)
    assert out["skills"][0]["evidence_status"] == "direct"
    assert out["next_step"]["skill_id"] == "elicitation"
    assert out["next_step"]["unlocks_requested"][0]["skill_id"] == "sql"
    span = out["skills"][0]
    assert text.encode("utf-16-le")[span["start"] * 2:span["end"] * 2].decode("utf-16-le") == "SQL"


def test_no_recognized_skill_does_not_invent_a_readiness_score():
    result = ExtractionResult(new_candidates=[Mention("Rust", "Menguasai Rust.", "mandiri", None, status="new")])
    out = analyze_job("Menguasai Rust.", result, {"sql": _state(0.1), "elicitation": _state(0.1)}, _context())

    assert out["readiness"]["score"] is None
    assert out["next_step"] is None
    assert out["terms_to_review"][0]["text"] == "Rust"


def test_repeated_skill_mentions_do_not_double_count_score():
    text = "SQL diperlukan. SQL dipakai setiap hari."
    result = ExtractionResult(mentions=[Mention("SQL", "SQL diperlukan.", "mandiri", "sql"),
                                        Mention("SQL", "SQL dipakai setiap hari.", "mandiri", "sql")])
    out = analyze_job(text, result, {"sql": _state(0.4, evidence=True), "elicitation": _state(0.1)}, _context())

    assert out["n_recognized_skills"] == 1
    assert len(out["skills"]) == 2
    assert all(item["evidence_status"] == "academic" for item in out["skills"])


def test_free_phrase_is_shown_as_candidate_without_embedding_cache(monkeypatch):
    from pathsync import job_check

    text = "Mampu menggunakan SQL dan alat baru."
    raw = [Mention("SQL", text, "mandiri", "sql"),
           Mention("alat baru", text, "mandiri", None, method="pattern")]
    monkeypatch.setattr(job_check, "load_context", lambda *_: _context())
    monkeypatch.setattr(job_check, "student_states", lambda *_: {"sql": _state(0.1), "elicitation": _state(0.1)})
    monkeypatch.setattr(job_check, "responses", lambda *_: [])
    monkeypatch.setattr(job_check, "lexicon_extractor", lambda: SimpleNamespace(extract=lambda _: raw))

    out = check_job(None, SimpleNamespace(id="student", target_role="business_analyst"), text)

    assert out["n_recognized_skills"] == 1
    assert out["terms_to_review"][0]["text"] == "alat baru"


@pytest.mark.skipif(not __import__("conftest").HAVE_DB, reason="requires a built market database")
def test_route_requires_student_token_and_does_not_save_posting():
    from fastapi.testclient import TestClient
    from sqlalchemy import func, select

    from api.main import app
    from pathsync.db import Posting, Student, get_session
    from pathsync.security import hash_token

    token = "test-job-check-token"
    with get_session() as s:
        student = Student(display_name="Uji Lowongan", target_role="business_analyst", token_hash=hash_token(token))
        s.add(student)
        s.commit()
        sid = student.id
        before = s.scalar(select(func.count(Posting.id)))

    client = TestClient(app)  # no lifespan: the copied test database is already seeded
    url = f"/api/students/{sid}/check-job"
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post(url, json={"text": "Mampu menggunakan SQL untuk analisis data."}).status_code == 401
    result = client.post(url, headers=headers, json={"text": "Mampu menggunakan SQL untuk analisis data."})
    assert result.status_code == 200, result.text
    assert result.json()["n_recognized_skills"] >= 1
    assert result.json()["readiness"]["score"] is not None
    assert "proven" not in result.json()["readiness"]
    assert client.post(url, headers=headers, json={"text": "pendek"}).status_code == 422
    with get_session() as s:
        assert s.scalar(select(func.count(Posting.id))) == before
