"""Audit DATA-01: a posting that names a skill is not always asking for it."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from pathsync.extraction import lexicon_extractor
from pathsync.extraction.base import apply_gates
from pathsync.job_check import analyze_job
from pathsync.ranker import RankingModel
from pathsync.taxonomy import SkillGraph, load_skills


def _status(text: str) -> dict[str, str]:
    return {m.skill_id: m.requirement for m in lexicon_extractor().extract(text) if m.skill_id}


@pytest.mark.parametrize("text, expected", [
    ("SQL tidak diperlukan.", {"sql": "excluded"}),
    ("Python tidak dibutuhkan.", {"python_programming": "excluded"}),
    ("No prior Python experience required.", {"python_programming": "excluded"}),
    ("SQL is required.", {"sql": "required"}),
    ("SQL preferred, not mandatory.", {"sql": "preferred"}),
    ("Python menjadi nilai tambah.", {"python_programming": "preferred"}),
    ("Tidak hanya SQL, tetapi juga Python.", {"sql": "required", "python_programming": "required"}),
    ("Tidak perlu Python; wajib menguasai Excel.", {"python_programming": "excluded", "excel": "required"}),
    ("Pengalaman SQL tidak wajib, tetapi akan membantu.", {"sql": "preferred"}),
    ("Kami tidak menggunakan Java. Backend memakai Python.", {"java_spring": "excluded", "python_programming": "required"}),
    ("Dapat menggunakan Python atau Java.", {"python_programming": "alternative", "java_spring": "alternative"}),
    ("Pelatihan SQL akan diberikan.", {"sql": "mention_only"}),
    ("SQL diperlukan pada tim data, bukan posisi ini.", {"sql": "excluded"}),
    ("Tidak menutup kemungkinan memakai Python.", {"python_programming": "uncertain"}),
    # negation reaches only the names it is attached to
    ("Wajib menguasai SQL, Python tidak diperlukan.", {"sql": "required", "python_programming": "excluded"}),
    ("SQL, Excel, dan Python tidak diperlukan.", {"sql": "excluded", "excel": "excluded", "python_programming": "excluded"}),
    ("Menguasai SQL, tidak diperlukan pengalaman kerja.", {"sql": "required"}),
    # found in the corpus: the aside's negation is about Flask only
    ("Proficiency in Python (Flask experience is not required, but AWS is a plus).",
     {"python_programming": "required", "python_backend": "excluded"}),
])
def test_requirement_status(text, expected):
    got = _status(text)
    assert {k: got.get(k) for k in expected} == expected


def _ctx():
    skills = load_skills()
    ids = ["requirements_elicitation", "requirements_documentation", "sql", "python_programming", "excel", "java_spring"]
    graph = SkillGraph({k: skills[k] for k in ids}, [])
    return SimpleNamespace(skills=graph.skills, names={k: skills[k].name for k in ids}, graph=graph, model=RankingModel())


def _state(p):
    return SimpleNamespace(p=p, p_proven=None, has_evidence=False, confidence=0.0)


def test_audit_posting_never_routes_to_an_excluded_skill():
    text = ("Lowongan Junior Business Analyst. Wajib mampu melakukan requirements elicitation,\n"
            "menyusun user story, dan membuat dokumentasi kebutuhan.\nSQL tidak diperlukan. Python tidak dibutuhkan.")
    ctx = _ctx()
    extracted = apply_gates(lexicon_extractor().extract(text), text, None, set(ctx.skills))
    states = {k: _state(0.1) for k in ctx.skills}
    states["sql"] = _state(0.0)
    out = analyze_job(text, extracted, states, ctx)

    assert out["n_recognized_skills"] == 2
    assert {x["skill_id"] for x in out["excluded"]} == {"sql", "python_programming"}
    assert all(x["skill_id"] not in ("sql", "python_programming") for x in out["skills"])
    assert out["next_step"]["skill_id"] in ("requirements_elicitation", "requirements_documentation")
    assert {g["skill_id"] for g in out["gaps"]} <= {"requirements_elicitation", "requirements_documentation"}


def test_preferred_and_unused_option_are_shown_but_not_counted():
    text = "Menguasai Excel. Dapat menggunakan Python atau Java. SQL menjadi nilai tambah."
    ctx = _ctx()
    extracted = apply_gates(lexicon_extractor().extract(text), text, None, set(ctx.skills))
    states = {k: _state(0.1) for k in ctx.skills}
    states["java_spring"] = _state(0.5)          # closer to Java, so Java is the option that counts
    out = analyze_job(text, extracted, states, ctx)

    req = {x["skill_id"]: x["requirement"] for x in out["skills"]}
    assert req == {"excel": "required", "java_spring": "required", "python_programming": "alternative", "sql": "preferred"}
    assert out["n_recognized_skills"] == 2
