"""Apply reviewed item work (data/seed/_rewrite/*.json) to the item bank files.

Each rewrite file maps item id -> {"en": [key, d1, d2, d3], "id": [...]}; an entry may replace the options of an existing
item (either language) or add a new item with {"new": {"skill_id", "difficulty", "stem_en", "expl_en"[, "stem_id", "expl_id"]}}.
New items without Indonesian text reuse the English text in the Indonesian file.

The key is always written first in the seed files; the engine shuffles options per session
(pathsync.assessment.session_order). Items of skills that are no longer in the taxonomy (soft skills) are dropped.
Later files override earlier ones (files are applied in name order).

Run: python -m pipeline.apply_item_rewrite
"""
from __future__ import annotations

import glob
import json
import os

from pathsync.config import SEED_DIR


def _write_items(path, items: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as h:
        h.write("[\n" + ",\n".join(" " + json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in items) + "\n]\n")


def _write_en(path, en: dict) -> None:
    with open(path, "w", encoding="utf-8") as h:
        h.write("{\n" + ",\n".join(f"  {json.dumps(k)}: " + json.dumps(v, ensure_ascii=False) for k, v in en.items()) + "\n}\n")


def main() -> None:
    tax = json.loads((SEED_DIR / "taxonomy.json").read_text(encoding="utf-8"))
    cluster_of = {s["id"]: s["cluster"] for s in tax["skills"]}
    rewrites: dict[str, dict] = {}
    for f in sorted(glob.glob(str(SEED_DIR / "_rewrite" / "*.json"))):
        rewrites.update(json.load(open(f, encoding="utf-8")))

    seen: set[str] = set()
    legacy_files = [f for f in sorted(glob.glob(str(SEED_DIR / "items" / "*.json"))) if not os.path.basename(f).startswith("x_")]
    for f in legacy_files:
        name = os.path.basename(f)
        ep = SEED_DIR / "items_en" / name
        items = json.load(open(f, encoding="utf-8"))
        en = json.load(open(ep, encoding="utf-8"))
        kept = [it for it in items if it["skill_id"] in cluster_of]
        for it in kept:
            r = rewrites.get(it["id"])
            if r and ("en" in r or "id" in r) and "new" not in r:
                if "id" in r:
                    it["options"] = r["id"]
                if "en" in r:
                    en[it["id"]]["options"] = r["en"]
                seen.add(it["id"])
        en = {k: v for k, v in en.items() if k in {it["id"] for it in kept}}
        _write_items(f, kept)
        _write_en(ep, en)

    # new items go to one file per cluster (x_<cluster>.json), rebuilt from the rewrite files on every run
    by_cluster: dict[str, list[tuple[dict, dict]]] = {}
    for iid, r in rewrites.items():
        n = r.get("new")
        if not n:
            continue
        if n["skill_id"] not in cluster_of:
            continue
        stem_en, expl_en = n["stem_en"], n["expl_en"]
        item = {"id": iid, "skill_id": n["skill_id"], "difficulty": n["difficulty"], "stem": n.get("stem_id", stem_en),
                "options": r.get("id", r["en"]), "explanation": n.get("expl_id", expl_en)}
        by_cluster.setdefault(cluster_of[n["skill_id"]], []).append(
            (item, {"stem": stem_en, "options": r["en"], "explanation": expl_en}))
        seen.add(iid)
    for old in glob.glob(str(SEED_DIR / "items" / "x_*.json")) + glob.glob(str(SEED_DIR / "items_en" / "x_*.json")):
        os.remove(old)
    for cluster, pairs in by_cluster.items():
        pairs.sort(key=lambda p: (p[0]["skill_id"], p[0]["difficulty"], p[0]["id"]))
        _write_items(SEED_DIR / "items" / f"x_{cluster}.json", [p[0] for p in pairs])
        _write_en(SEED_DIR / "items_en" / f"x_{cluster}.json", {p[0]["id"]: p[1] for p in pairs})
    print(f"applied {len(seen)} items; clusters with new items: {sorted(by_cluster)}; unmatched: {sorted(set(rewrites) - seen)[:10]}")


if __name__ == "__main__":
    main()
