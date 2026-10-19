"""Learning loop (pathsync.learning_loop): content integrity, the adapt rules, grading, and that practice never moves
mastery."""
from datetime import datetime, timedelta

import pytest

from pathsync.learning_loop import TIERS, LoopState, TierState, decide, display_order, grade_practice, practice_bank


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def demo(client):
    j = client.post("/api/demo/profile").json()
    return j["id"], {"Authorization": f"Bearer {j['token']}"}


# ------------------------------------------------------------------ content
CORE_BA = {"requirements_elicitation", "requirements_documentation", "business_process_modeling", "system_modeling_uml", "sql"}


def _id(x):
    return x["id"] if isinstance(x, dict) else x


def test_practice_content_is_complete():
    """Every skill: an objective, at least three criteria, and at least 2 basic, 2 applied and 1 transfer task in
    Indonesian, each choice with exactly one key and feedback on every option. Core BA skills have 3/3/2."""
    bank = practice_bank()
    for sid, body in bank.items():
        assert _id(body["objective"]), sid
        crit = body["criteria"] if isinstance(body["criteria"], list) else body["criteria"]["id"]
        assert len(crit) >= 3, sid
        tiers = [t["tier"] for t in body["tasks"]]
        need = {"basic": 3, "applied": 3, "transfer": 2} if sid in CORE_BA else {"basic": 2, "applied": 2, "transfer": 1}
        assert all(tiers.count(t) >= n for t, n in need.items()), (sid, tiers)
        ids = [t["id"] for t in body["tasks"]]
        assert len(ids) == len(set(ids)), sid
        for t in body["tasks"]:
            assert _id(t["stem"]), t["id"]
            if t["type"] == "choice":
                assert len(t["options"]) == 4 and sum(o["correct"] for o in t["options"]) == 1, t["id"]
                assert all(_id(o["text"]) and _id(o["feedback"]) for o in t["options"]), t["id"]
            else:
                assert t["type"] == "order" and len(t["steps"]) >= 4 and all(_id(x) for x in t["steps"]), t["id"]


def test_task_ids_are_unique_across_skills():
    ids = [t["id"] for b in practice_bank().values() for t in b["tasks"]]
    assert len(ids) == len(set(ids))


def test_practice_skills_exist_in_the_taxonomy():
    from pathsync.taxonomy import load_skills

    assert set(practice_bank()) <= set(load_skills())


def test_key_position_is_spread_out_after_the_per_student_shuffle():
    """The correct option must not sit in one display position (a cue a student could learn instead of the skill)."""
    positions = []
    for body in practice_bank().values():
        for t in body["tasks"]:
            if t["type"] == "choice":
                key = next(i for i, o in enumerate(t["options"]) if o["correct"])
                positions.append(display_order("student-x", t).index(key))
    assert max(positions.count(k) for k in range(4)) / len(positions) < 0.5


def test_order_tasks_never_start_solved():
    for body in practice_bank().values():
        for t in body["tasks"]:
            if t["type"] == "order":
                for sid in ("a", "b", "c", "d"):
                    assert display_order(sid, t) != list(range(len(t["steps"])))


# ------------------------------------------------------------------ grading
def _first(kind: str) -> dict:
    return next(t for b in practice_bank().values() for t in b["tasks"] if t["type"] == kind)


def test_choice_grading_reveals_feedback_for_every_option():
    t = _first("choice")
    key = next(i for i, o in enumerate(t["options"]) if o["correct"])
    right, wrong = grade_practice(t, key), grade_practice(t, (key + 1) % len(t["options"]))
    assert right["correct"] and not wrong["correct"]
    assert wrong["feedback"] and len(wrong["options"]) == len(t["options"])
    assert all(o["feedback"] for o in wrong["options"])


def test_order_grading_marks_the_first_wrong_position():
    t = _first("order")
    n = len(t["steps"])
    assert grade_practice(t, list(range(n)))["correct"]
    swapped = [1, 0, *range(2, n)]
    g = grade_practice(t, swapped)
    assert not g["correct"] and g["first_wrong"] == 0


def test_malformed_answers_are_rejected():
    from pathsync.learning_loop import PracticeError

    with pytest.raises(PracticeError):
        grade_practice(_first("choice"), 9)
    with pytest.raises(PracticeError):
        grade_practice(_first("order"), [0, 0, 1])


# ------------------------------------------------------------------ adapt rules
def _state(**kw) -> LoopState:
    tiers = {"basic": TierState(3, 0, 0), "applied": TierState(3, 0, 0), "transfer": TierState(2, 0, 0)}
    tiers.update(kw.pop("tiers", {}))
    return LoopState(**{"supported": True, "target": 0.7, "p": 0.3, "p_proven": None, "tiers": tiers, **kw})


def test_decide_walks_the_loop_in_order():
    assert decide(_state()) == "practice_basic"
    assert decide(_state(tiers={"basic": TierState(3, 3, 1)})) == "review_basic"
    assert decide(_state(tiers={"basic": TierState(3, 3, 2)})) == "practice_applied"
    passed = {"basic": TierState(3, 3, 3), "applied": TierState(3, 3, 2)}
    assert decide(_state(tiers=passed)) == "prove"


def test_failed_check_after_practice_means_retry_not_prove():
    now = datetime(2026, 10, 20, 12)
    passed = {"basic": TierState(3, 3, 3), "applied": TierState(3, 3, 3)}
    st = _state(tiers=passed, last_practice_at=now - timedelta(hours=1), last_prove_at=now, last_prove_correct=1, last_prove_total=4)
    assert decide(st) == "retry"
    # practising again after the failed check re-opens the check
    st.last_practice_at = now + timedelta(minutes=5)
    assert decide(st) == "prove"


def test_proven_skill_goes_to_transfer_then_mastered():
    assert decide(_state(p_proven=0.8)) == "transfer"
    assert decide(_state(p_proven=0.8, tiers={"transfer": TierState(2, 2, 1)})) == "transfer"
    assert decide(_state(p_proven=0.8, tiers={"transfer": TierState(2, 2, 2)})) == "mastered"


def test_grades_alone_never_count_as_proven():
    """p from a transcript can exceed the target, but without direct evidence the skill is not proven."""
    assert decide(_state(p=0.9, p_proven=None, tiers={"basic": TierState(3, 3, 3), "applied": TierState(3, 3, 3)})) == "prove"


def test_missing_prerequisite_comes_before_more_practice():
    assert decide(_state(unmet_prereqs=["requirements_elicitation"])) == "prerequisite"
    # but a proven skill is never sent back
    assert decide(_state(unmet_prereqs=["x"], p_proven=0.9, tiers={"transfer": TierState(2, 2, 2)})) == "mastered"


def test_skills_without_content_fall_back_to_learn_then_prove():
    assert decide(_state(supported=False, tiers={})) == "prove"
    assert decide(_state(supported=False, tiers={}, p_proven=0.9)) == "mastered"


# ------------------------------------------------------------------ API
def test_status_endpoint_returns_a_decision_per_route_skill(client, demo):
    sid, h = demo
    r = client.get(f"/api/students/{sid}/loop?skills=requirements_elicitation,sql,nope", headers=h)
    assert r.status_code == 200
    rows = {x["skill_id"]: x for x in r.json()["skills"]}
    assert set(rows) == {"requirements_elicitation", "sql"}
    re = rows["requirements_elicitation"]
    assert re["supported"] and re["decision"]["code"] and re["decision"]["href"].startswith("/")
    assert set(re["stages"]["practice"]) == set(TIERS)


def test_practice_flow_records_feedback_and_never_moves_mastery(client, demo):
    sid, h = demo
    loop = client.get(f"/api/students/{sid}/loop/requirements_elicitation", headers=h).json()
    assert loop["tasks"] and "correct" not in str(loop["tasks"][0].get("options", ""))
    p_before = loop["p"]
    bank = {t["id"]: t for t in practice_bank()["requirements_elicitation"]["tasks"]}
    for task in [t for t in loop["tasks"] if t["tier"] == "basic"]:
        key = next(i for i, o in enumerate(bank[task["id"]]["options"]) if o["correct"])
        r = client.post(f"/api/students/{sid}/loop/requirements_elicitation/practice", headers=h,
                        json={"task_id": task["id"], "answer": key})
        assert r.status_code == 200 and r.json()["correct"]
    after = r.json()["status"]
    assert after["stages"]["practice"]["basic"]["passed"]
    assert after["p"] == p_before                      # practice is learning, not evidence
    assert after["decision"]["code"] in {"practice_applied", "prerequisite"}


def test_practice_rejects_unknown_tasks_and_other_students(client, demo):
    sid, h = demo
    assert client.post(f"/api/students/{sid}/loop/requirements_elicitation/practice", headers=h,
                       json={"task_id": "nope", "answer": 0}).status_code == 404
    other = client.post("/api/demo/profile").json()
    assert client.get(f"/api/students/{other['id']}/loop/sql", headers=h).status_code == 403


def test_practice_attempts_are_exported_and_erased(client, demo):
    sid, h = demo
    exp = client.get(f"/api/students/{sid}/export", headers=h).json()
    assert exp["practice_attempts"]
    from pathsync.db import PracticeAttempt, get_session
    from pathsync.retention import erase_students
    from sqlalchemy import func, select

    with get_session() as s:
        erase_students(s, [sid])
        s.commit()
        assert s.scalar(select(func.count()).select_from(PracticeAttempt).where(PracticeAttempt.student_id == sid)) == 0


def test_no_task_repeats_an_option_or_names_the_key_in_its_text():
    for body in practice_bank().values():
        for t in body["tasks"]:
            if t["type"] != "choice":
                continue
            texts = [_id(o["text"]).strip().lower() for o in t["options"]]
            assert len(set(texts)) == len(texts), t["id"]
            assert not any(x.startswith(("tepat", "benar", "jawaban")) for x in texts), t["id"]
