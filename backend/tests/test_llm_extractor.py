"""The LLM extraction path with a fake client (no network): structured output becomes mentions,
the quote gate still rejects invented quotes, failures fall back to the lexicon, and the generic
ranking baseline always returns every candidate once (plan C5)."""
from __future__ import annotations

import pytest

from pathsync.extraction.llm import GeminiClient, LLMExtractor, LLMUnavailable, llm_configured

POSTING = ("Kualifikasi:\n- Mampu menulis query SQL untuk analisis data penjualan.\n"
           "- Berpengalaman menyusun BRD bersama stakeholder.\n- Menguasai Microsoft Excel.")


class FakeClient:
    def __init__(self, reply=None, fail=False):
        self.reply, self.fail, self.calls = reply, fail, []

    def json_call(self, system, user, schema, effort="low", max_tokens=8000):
        self.calls.append((system, user, schema, effort))
        if self.fail:
            raise LLMUnavailable("down")
        return self.reply


@pytest.fixture()
def fake(monkeypatch):
    holder = {}

    def init(self, model=None):
        self.model = model or "fake"

    monkeypatch.setattr(GeminiClient, "__init__", init)

    def make(reply=None, fail=False):
        from pathsync.taxonomy import load_skills

        ex = LLMExtractor(load_skills())
        ex.client = FakeClient(reply, fail)
        holder["ex"] = ex
        return ex
    return make


def test_structured_output_becomes_mentions_and_gates_apply(fake):
    from pathsync.extraction import apply_gates, skill_index
    from pathsync.taxonomy import load_skills

    ex = fake({"skills": [
        {"skill_id": "sql", "surface": "query SQL", "quote": "Mampu menulis query SQL untuk analisis data penjualan.", "level": "mandiri"},
        {"skill_id": "excel", "surface": "Excel", "quote": "Ahli VBA dan macro tingkat lanjut.", "level": "mahir"},
        {"skill_id": "NEW", "surface": "Jira", "quote": "Menguasai Microsoft Excel.", "level": "dasar"},
    ]})
    raw = ex.extract(POSTING)
    assert [m.method for m in raw] == ["llm"] * 3
    assert raw[2].skill_id is None and raw[2].status == "pending"
    system, user, schema, _ = ex.client.calls[0]
    assert "sql" in schema["properties"]["skills"]["items"]["properties"]["skill_id"]["enum"]
    assert user.endswith(POSTING) and "Taksonomi" in system
    res = apply_gates(raw, POSTING, skill_index(), set(load_skills()))
    assert "sql" in res.skills
    assert [m.skill_id for m in res.rejected] == ["excel"]          # quote not in the posting


def test_llm_failure_falls_back_to_lexicon(fake, monkeypatch):
    from pathsync import extraction

    ex = fake(fail=True)
    monkeypatch.setattr(extraction, "llm_extractor", lambda: ex)
    res = extraction.extract_skills(POSTING, prefer="llm")
    assert res.extractor == "lexicon" and "sql" in res.skills


def test_generic_ranking_and_project_rating(fake):
    ex = fake({"order": ["excel", "sql", "excel"]})
    assert ex.generic_ranking("profil", ["sql", "excel", "data_analysis"]) == ["excel", "sql", "data_analysis"]
    ex.client.reply = {"ratings": [{"skill_id": "sql", "level": 2, "quote": "q", "rationale": "r"}]}
    out = ex.rate_project("x" * 70000, ["sql", "not_a_skill"])
    _, user, schema, effort = ex.client.calls[-1]
    assert out[0]["skill_id"] == "sql" and effort == "medium"
    assert schema["properties"]["ratings"]["items"]["properties"]["skill_id"]["enum"] == ["sql"]
    assert len(user) < 60100                                         # artefact text is capped


def test_llm_configured_modes(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("PATHSYNC_EXTRACTOR", "auto")
    assert llm_configured() is False
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    assert llm_configured() is True
    monkeypatch.setenv("PATHSYNC_EXTRACTOR", "lexicon")
    assert llm_configured() is False
