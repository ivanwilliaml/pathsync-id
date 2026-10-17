"""Plan A9: add the six business roles (financial analyst, tax, internal audit and risk, HR, supply chain, product/project).

The new skill candidates live in data/seed/_a9/skills.json. A candidate stays in the taxonomy only if the market grounds
it (share of postings >= governance.GROUNDING_MIN_SHARE in at least one role, paper III.A.1 "bukti ekstraksi"), so the
flow is:

    python -m pipeline.add_business_roles skills       # merge candidates into taxonomy.json (aliases kept unique)
    python -m pipeline.build_market --extractor lexicon  # extract skills from every scraped posting
    python -m pipeline.add_business_roles grounding    # posting share of every candidate per business role
    python -m pipeline.add_business_roles prune        # drop candidates that no role grounds, list kept ones
    python -m pipeline.add_business_roles content      # edges, items and materials of the kept skills
    python -m pipeline.add_business_roles fix-aliases  # move contested aliases to the more specific new skill

Aliases are unique across the taxonomy and the soft-skill layer ("first owner wins" in the lexicon extractor), so a
candidate alias that an older skill or a soft skill already owns is dropped here and reported.
"""
from __future__ import annotations

import json
import random
import re
import sys

from pathsync.config import SEED_DIR

A9_DIR = SEED_DIR / "_a9"
BUSINESS_ROLES = ("financial_analyst", "tax_specialist", "internal_auditor", "hr_specialist", "supply_chain_analyst",
                  "project_coordinator")


# "first owner wins" left the general tax skill holding aliases that name a specific new skill ("pph 23" went to
# tax_compliance_id while "pph23" went to pph_corporate_withholding). The more specific skill owns them.
ALIAS_TRANSFERS = {
    ("tax_compliance_id", "pph_corporate_withholding"): ("pph 23", "pph 25", "pph 29", "pph 4(2)"),
    ("tax_compliance_id", "vat_ppn_mechanics"): ("ppn", "ppn masukan", "faktur pajak"),
    ("tax_compliance_id", "tax_dispute_audit"): ("tax audit",),
}


# Aliases that fired on unrelated text in the dev half of the verified gold set (17 Oct): generic words, an Indonesian
# word ("keras" = hard, as in "pekerja keras"), testing jargon ("regression" testing) and wrong neighbours (GraphQL is not
# REST design, fraud detection in ML postings is not internal audit). Tuned on dev only; the test half was measured once after.
ALIAS_DROPS = {
    "kpi_metrics": ("metrics", "retention", "metrik"),
    "warehouse_logistics": ("logistics", "logistik"),
    "ap_ar_reconciliation": ("rekonsiliasi",),
    "financial_analysis": ("revenue",),
    "data_structures_algorithms": ("algorithms", "algoritma", "data structures"),
    "audit_internal_control": ("fraud detection",),
    "rest_api_design": ("graphql",),
    "requirements_elicitation": ("business needs", "kebutuhan bisnis"),
}


def transfer_aliases(tax: dict) -> list[str]:
    by_id = {s["id"]: s for s in tax["skills"]}
    moved = []
    for sid, aliases in ALIAS_DROPS.items():
        for a in aliases:
            if sid in by_id and a in by_id[sid]["aliases"]:
                by_id[sid]["aliases"].remove(a)
                moved.append(f"{a}: dropped from {sid}")
    for (src, dst), aliases in ALIAS_TRANSFERS.items():
        if src not in by_id or dst not in by_id:
            continue
        for a in aliases:
            if a in by_id[src]["aliases"]:
                by_id[src]["aliases"].remove(a)
                moved.append(f"{a}: {src} -> {dst}")
            if a not in by_id[dst]["aliases"]:
                by_id[dst]["aliases"].append(a)
    return moved


def fix_aliases() -> None:
    tax = _load("taxonomy.json")
    moved = transfer_aliases(tax)
    _dump("taxonomy.json", tax)
    print(f"{len(moved)} aliases moved" + (": " + "; ".join(moved) if moved else " (already in place)"))


def _load(name: str) -> dict:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def _dump(name: str, data: dict) -> None:
    (SEED_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _candidates() -> dict:
    return json.loads((A9_DIR / "skills.json").read_text(encoding="utf-8"))


def merge_skills() -> None:
    cand = _candidates()
    tax = _load("taxonomy.json")
    new_ids = {s["id"] for s in cand["skills"]}
    tax["skills"] = [s for s in tax["skills"] if s["id"] not in new_ids]
    owned = {a.lower(): s["id"] for s in tax["skills"] for a in s["aliases"]}
    soft = {a.lower(): s["id"] for s in _load("soft_skills.json")["skills"] for a in s["aliases"]}
    for cid, (name, name_en) in cand["clusters"].items():
        tax["clusters"][cid], tax["clusters_en"][cid] = name, name_en
    dropped = []
    for sk in cand["skills"]:
        kept = []
        for a in sk["aliases"]:
            key = a.lower()
            if key in owned or key in soft:
                dropped.append((sk["id"], a, owned.get(key) or "soft:" + soft[key]))
                continue
            owned[key] = sk["id"]
            kept.append(a)
        if len(kept) < 4:
            raise SystemExit(f"{sk['id']} keeps only {len(kept)} aliases after de-duplication")
        entry = {"id": sk["id"], "name": sk["name"], "name_en": sk["name_en"], "cluster": sk["cluster"], "kind": "hard",
                 "description": sk["description"], "learn_what": sk["learn_what"], "hours": sk["hours"], "aliases": kept,
                 "esco": [], "description_en": sk["description_en"], "learn_what_en": sk["learn_what_en"],
                 "added_in": "2026.10-v4"}
        tax["skills"].append(entry)
    transfer_aliases(tax)
    _dump("taxonomy.json", tax)
    print(f"merged {len(cand['skills'])} candidate skills; dropped {len(dropped)} aliases already owned elsewhere")
    for d in dropped:
        print("  ", d)


def grounding() -> None:

    from pathsync.db import get_session, init_db
    from pathsync.governance import GROUNDING_MIN_SHARE
    from pathsync.market import active_snapshot

    init_db()
    ids = [s["id"] for s in _candidates()["skills"]]
    best: dict[str, tuple[float, str]] = {}
    with get_session() as s:
        for role in BUSINESS_ROLES:
            snap = active_snapshot(s, role)
            if not snap:
                print(f"{role}: no snapshot")
                continue
            n = snap.data.get("n_postings") or snap.n_postings if hasattr(snap, "n_postings") else None
            print(f"{role}: postings={n}")
            for sid in ids:
                sh = snap.data["skills"].get(sid, {}).get("share", 0.0)
                if sh > best.get(sid, (0.0, ""))[0]:
                    best[sid] = (sh, role)
    for sid in ids:
        sh, role = best.get(sid, (0.0, "-"))
        print(f"{sid:36s} best share {sh:5.1%} in {role:22s} {'KEEP' if sh >= GROUNDING_MIN_SHARE else 'drop'}")


def keep_list() -> list[str]:
    """Candidates whose best posting share over the business roles reaches the grounding threshold."""
    from pathsync.db import get_session, init_db
    from pathsync.governance import GROUNDING_MIN_SHARE
    from pathsync.market import active_snapshot

    init_db()
    ids = [s["id"] for s in _candidates()["skills"]]
    keep = []
    with get_session() as s:
        snaps = [active_snapshot(s, r) for r in BUSINESS_ROLES]
        for sid in ids:
            if max((sn.data["skills"].get(sid, {}).get("share", 0.0) for sn in snaps if sn), default=0.0) >= GROUNDING_MIN_SHARE:
                keep.append(sid)
    return keep


def prune() -> None:
    """Drop the candidates the market does not ground; the kept list is written to data/seed/_a9/kept.json."""
    keep = keep_list()
    tax = _load("taxonomy.json")
    cand = {s["id"] for s in _candidates()["skills"]}
    tax["skills"] = [s for s in tax["skills"] if s["id"] not in cand or s["id"] in keep]
    _dump("taxonomy.json", tax)
    (A9_DIR / "kept.json").write_text(json.dumps(keep, indent=1) + "\n", encoding="utf-8")
    print(f"kept {len(keep)} of {len(cand)} candidates")
    print(", ".join(keep))


FILL_ID = [" dalam praktik sehari-hari", " pada kebanyakan organisasi", " menurut kebiasaan umum", " pada tahap awal",
           " dalam banyak kasus", " di lingkungan kerja", " sebagai langkah rutin", " pada umumnya"]
FILL_EN = [" in day-to-day practice", " in most organisations", " by common habit", " at an early stage",
           " in many cases", " in the workplace", " as a routine step", " in general"]
_CODEISH = re.compile(r"[=<>{}();_/\\]|\d|--|@")


def _padable(options: list[str]) -> bool:
    return all(len(o) >= 22 and not _CODEISH.search(o) for o in options)


def _balance(options: list[str], fillers: list[str], rng: random.Random) -> list[str]:
    """Key is options[0]. Where it is the longest option, lengthen the distractors nearest to it (the choice of which
    option gets a phrase depends on the item id only, never on correctness); where it is the shortest, sometimes lengthen
    the key. Keeps the key's length rank close to uniform, as pipeline.item_authoring.balance_lengths does for the older bank."""
    if not _padable(options):
        return options
    out = list(options)
    lens = [len(o) for o in out]
    if lens[0] == max(lens) and lens.count(lens[0]) == 1:
        if rng.random() < 0.2:
            return out
        k = rng.choice([2, 2, 3])
        for i in sorted(range(1, 4), key=lambda j: -lens[j])[:k]:
            target = lens[0] + rng.randint(0, 4)
            for _ in range(3):
                if len(out[i]) > target:
                    break
                out[i] += rng.choice(fillers)
    elif lens[0] == min(lens) and lens.count(lens[0]) == 1 and rng.random() < 0.5:
        out[0] += rng.choice(fillers)
    return out


def _http_status(url: str) -> int:
    import urllib.request

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:  # noqa: BLE001
        return getattr(e, "code", 0)


def content() -> None:
    """Items (Indonesian base + English overlay), prerequisite edges and verified materials of the kept skills."""
    keep = json.loads((A9_DIR / "kept.json").read_text(encoding="utf-8"))
    items = []
    for f in ("items_fin_tax_audit.json", "items_hr.json", "items_ops.json"):
        items += json.loads((A9_DIR / f).read_text(encoding="utf-8"))
    by_skill: dict[str, list[dict]] = {}
    for it in items:
        by_skill.setdefault(it["skill"], []).append(it)
    missing = [k for k in keep if len(by_skill.get(k, [])) != 5]
    extra = [k for k in by_skill if k not in keep]
    if missing or extra:
        raise SystemExit(f"items missing for {missing}; items for skills that were not kept: {extra}")
    base, en = [], {}
    for sid in keep:
        for n, it in enumerate(sorted(by_skill[sid], key=lambda x: x["d"]), 1):
            iid = f"{sid}-{n}"
            assert len(it["o"]) == len(it["o_en"]) == 4 and len(set(it["o"])) == 4 and len(set(it["o_en"])) == 4, iid
            o_id = _balance(it["o"], FILL_ID, random.Random(iid + "|id"))
            o_en = _balance(it["o_en"], FILL_EN, random.Random(iid + "|en"))
            base.append({"id": iid, "skill_id": sid, "difficulty": it["d"], "stem": it["q"], "options": o_id,
                         "explanation": it["e"], "source": it["src"]})
            en[iid] = {"stem": it["q_en"], "options": o_en, "explanation": it["e_en"]}
    nl = "\n"
    (SEED_DIR / "items" / "x_bisnis.json").write_text(
        "[" + nl + ("," + nl).join(" " + json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in base) + nl + "]" + nl,
        encoding="utf-8")
    (SEED_DIR / "items_en" / "x_bisnis.json").write_text(
        "{" + nl + ("," + nl).join(f"  {json.dumps(k)}: " + json.dumps(v, ensure_ascii=False) for k, v in en.items()) + nl + "}" + nl,
        encoding="utf-8")

    extra_data = json.loads((A9_DIR / "graph_materials.json").read_text(encoding="utf-8"))
    graph = _load("graph.json")
    graph["edges"] = [e for e in graph["edges"] if e.get("added_in") != "a9"]
    ids = {s["id"] for s in _load("taxonomy.json")["skills"]}
    for a, b, rid, ren in extra_data["edges"]:
        if a in ids and b in ids:
            graph["edges"].append({"from": a, "to": b, "source": "tim", "rationale": rid, "rationale_en": ren, "added_in": "a9"})
    _dump("graph.json", graph)

    mats = _load("materials.json")
    mats["materials"] = [m for m in mats["materials"] if not m["id"].startswith("m_a9_")]
    skipped = []
    for n, (sid, title, provider, url, diff, fmt, lang, hours) in enumerate(extra_data["materials"], 1):
        if sid not in keep:
            continue
        status = _http_status(url)
        if status != 200:
            skipped.append((url, status))
            continue
        mats["materials"].append({"id": f"m_a9_{n:03d}", "skill_id": sid, "title": title, "provider": provider, "url": url,
                                  "difficulty": diff, "format": fmt, "language": lang, "hours": hours,
                                  "http_status": status, "verified": True})
    _dump("materials.json", mats)
    print(f"{len(base)} items, {len(graph['edges'])} edges, {len(mats['materials'])} materials; links not verified: {skipped}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "skills"
    {"skills": merge_skills, "grounding": grounding, "prune": prune, "content": content, "fix-aliases": fix_aliases}[cmd]()
