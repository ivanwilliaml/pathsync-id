"""Gemini adapter: schema conversion, provider choice, postings stay on the lexicon."""
from __future__ import annotations

from pathsync.extraction import llm


def test_schema_drops_unsupported_keys():
    s = {"type": "object", "additionalProperties": False, "properties": {
        "level": {"type": "integer", "enum": [0, 1, 2, 3]}, "skill_id": {"type": "string", "enum": ["sql"]}}}
    out = llm._gemini_schema(s)
    assert "additionalProperties" not in out
    assert "enum" not in out["properties"]["level"] and out["properties"]["skill_id"]["enum"] == ["sql"]


def test_provider_follows_the_key(monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "PATHSYNC_LLM_PROVIDER", "PATHSYNC_EXTRACTOR"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    assert llm.llm_configured() and llm.llm_provider() == "gemini"


def test_postings_stay_on_lexicon_when_a_key_exists(monkeypatch):
    from pathsync import extraction

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("PATHSYNC_EXTRACTOR", raising=False)
    called = []
    monkeypatch.setattr(extraction, "llm_extractor", lambda: called.append(1))
    res = extraction.extract_skills("Wajib menguasai SQL.")
    assert res.extractor == "lexicon" and not called


def test_busy_model_falls_through_to_the_next(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("PATHSYNC_GEMINI_FALLBACKS", "second-model")
    client = llm.GeminiClient("first-model")
    tried = []

    def fake_call(model, *a):
        tried.append(model)
        if model == "first-model":
            e = llm.LLMUnavailable("busy")
            e.busy = True
            raise e
        return {"ok": True}

    monkeypatch.setattr(client, "_call", fake_call)
    monkeypatch.setattr("time.sleep", lambda *_: None)
    assert client.json_call("s", "u", {}) == {"ok": True} and tried == ["first-model", "second-model"]
