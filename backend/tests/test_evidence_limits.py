"""Audit COMP-01/04: indirect evidence is not mastery, and new answers always move the estimate."""
from __future__ import annotations

from pathsync.config import INDIRECT_CAP
from pathsync.evidence import EvidenceItem, Response, bkt_update, diagnose


def test_transcript_alone_is_capped_and_a_wrong_answer_still_counts():
    states = diagnose(["sql"], [EvidenceItem("academic", "Transcript", {"sql": 1.0})],
                      [Response("sql", False, "reassessment")])
    st = states["sql"]
    assert st.p0 == INDIRECT_CAP
    assert st.p < st.p0
    assert st.p_proven is not None and st.p_proven < 0.2


def test_bkt_never_sticks_at_one():
    assert bkt_update(1.0, False) < 0.99
    assert bkt_update(0.0, True) > 0.01


def test_completion_certificate_is_not_proof_but_an_exam_is():
    course = EvidenceItem("certificate", "Course", {"sql": 0.6}, direct={})
    exam = EvidenceItem("certificate", "Exam", {"english_proficiency": 0.9}, direct={"english_proficiency": 0.9})
    states = diagnose(["sql", "english_proficiency"], [course, exam], [])
    assert states["sql"].p_proven is None
    assert states["sql"].p0 <= INDIRECT_CAP
    assert states["english_proficiency"].p_proven == 0.9


def test_no_evidence_stays_at_prior_without_nan():
    st = diagnose(["sql"], [], [])["sql"]
    assert st.p == st.p0 == 0.10 and not st.has_evidence and st.p_proven is None
