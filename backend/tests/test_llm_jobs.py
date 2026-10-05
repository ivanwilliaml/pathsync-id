"""Offline LLM results pass through the same gates as live extraction."""
from __future__ import annotations

import json

import pytest

from pipeline import llm_jobs


@pytest.fixture()
def posting(monkeypatch, tmp_path):
    text = ("Kualifikasi:\n- Mampu menulis query SQL untuk analisis data.\n"
            "- Berpengalaman menyusun BRD dan user story bersama stakeholder.\n- Menguasai Microsoft Excel.")
    monkeypatch.setattr(llm_jobs, "_postings", lambda: [{"fingerprint": "fp1", "title": "BA", "text": text}])
    monkeypatch.setattr(llm_jobs, "EXTRACTION_CACHE", tmp_path / "cache.json")
    return text


def test_import_postings_applies_gates(posting, tmp_path):
    res = {"model": "qwen3-8b", "results": {"fp1": {"skills": [
        {"skill_id": "sql", "surface": "query SQL", "quote": "Mampu menulis query SQL untuk analisis data.", "level": "mandiri"},
        {"skill_id": "excel", "surface": "Excel", "quote": "Ahli pivot table dan VBA tingkat lanjut.", "level": "mahir"},
        {"skill_id": "brd_writing", "surface": "Microsoft Excel", "quote": "Menguasai Microsoft Excel.", "level": "mahir"},
    ]}, "unknown-fp": {"skills": []}}}
    p = tmp_path / "res.json"
    p.write_text(json.dumps(res), encoding="utf-8")
    llm_jobs.import_postings(str(p))

    cache = json.loads(llm_jobs.EXTRACTION_CACHE.read_text(encoding="utf-8"))
    (key, entry), = cache.items()
    assert key.startswith("fp1|llm|") and entry["extractor"] == "llm:qwen3-8b"
    by_status = {}
    for m in entry["mentions"]:
        by_status.setdefault(m["status"], []).append(m)
    assert [m["skill_id"] for m in by_status["rejected"]] == ["excel"]          # quote not in the posting
    auto = {m["skill_id"] for m in by_status["auto"]}
    assert "sql" in auto
    # an id outside the taxonomy is treated as free text and normalised by embedding similarity
    invented = next(m for m in entry["mentions"] if m["surface"] == "Microsoft Excel")
    assert invented["method"] == "llm" and invented["status"] in ("auto", "review", "new")
