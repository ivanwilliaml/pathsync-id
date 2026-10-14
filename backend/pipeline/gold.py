"""Human gold set workflow (plan A1).

    python -m pipeline.gold split       # writes data/seed/gold_split.json once (refuses to overwrite)
    python -m pipeline.gold status      # progress per annotator on the split
    python -m pipeline.gold consensus   # annotations -> gold_consensus.json + open disputes

Annotators label in Admin > Annotation; postings in the split are served first. Disputed
(posting, skill) pairs go to a third rater, whose decisions are written to
data/seed/gold_adjudication.json as {"posting_id": {"skill_id": true|false}}.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict

from sqlalchemy import select

from pathsync.config import MODELS_DIR
from pathsync.db import Annotation, Posting, SessionLocal, init_db
from pathsync.gold import ADJUDICATION_FILE, CONSENSUS_FILE, SPLIT_FILE, agreement, consensus, load_split, make_split
from pathsync.taxonomy import load_skills


def _annotations(s, ids: set[str]) -> dict[str, dict[str, set]]:
    by_post: dict[str, dict[str, set]] = defaultdict(dict)
    for a in s.scalars(select(Annotation).where(Annotation.posting_id.in_(ids))).all():
        by_post[a.posting_id][a.annotator] = set(a.skill_ids)
    return by_post


def cmd_split() -> None:
    if SPLIT_FILE.exists():
        raise SystemExit(f"{SPLIT_FILE.name} already exists; the split is locked. Delete it by hand only "
                         "if no annotation has started.")
    with SessionLocal() as s:
        rows = s.execute(select(Posting.id, Posting.role).where(Posting.duplicate_of.is_(None))).all()
    doc = make_split(dict(rows))
    SPLIT_FILE.write_text(json.dumps(doc, indent=1), encoding="utf-8")
    print(f"dev {len(doc['dev'])}, test {len(doc['test'])} -> {SPLIT_FILE}")


def cmd_status() -> None:
    split = load_split() or {"dev": [], "test": []}
    ids = set(split["dev"]) | set(split["test"])
    with SessionLocal() as s:
        by_post = _annotations(s, ids)
    per = defaultdict(int)
    for anns in by_post.values():
        for n in anns:
            per[n] += 1
    print(json.dumps({"split_postings": len(ids), "annotated_by": dict(per),
                      "with_two_or_more": sum(len(a) >= 2 for a in by_post.values())}, indent=1))


def cmd_consensus() -> None:
    split = load_split()
    if not split:
        raise SystemExit("run `python -m pipeline.gold split` first")
    ids = set(split["dev"]) | set(split["test"])
    adjudication = json.loads(ADJUDICATION_FILE.read_text(encoding="utf-8")) if ADJUDICATION_FILE.exists() else {}
    with SessionLocal() as s:
        by_post = _annotations(s, ids)
        roles = dict(s.execute(select(Posting.id, Posting.role).where(Posting.id.in_(ids))).all())
    doc, open_disputes = consensus(by_post, roles, adjudication)
    agree = agreement(by_post, list(load_skills()))
    CONSENSUS_FILE.write_text(json.dumps(doc, indent=1), encoding="utf-8")
    (MODELS_DIR / "gold_agreement.json").write_text(json.dumps({"pairs": agree, "open_disputes": open_disputes},
                                                               indent=1), encoding="utf-8")
    print(f"consensus postings: {len(doc['postings'])}, open disputes: {len(open_disputes)}")
    for p in agree:
        print(f"kappa {p['annotators']}: {p['kappa']} on {p['postings']} postings (target >= 0.70)")


def main() -> None:
    init_db()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    {"split": cmd_split, "status": cmd_status, "consensus": cmd_consensus}.get(cmd, lambda: sys.exit(__doc__))()


if __name__ == "__main__":
    main()
