"""Patch single options of the rewrite files: python -m pipeline.item_authoring.rewrite_patch <stem|all> <patch.json>

patch.json: {"item-id": {"en": {"1": "text"}, "id": {"3": "text"}}}
"""
from __future__ import annotations

import json
import sys

from pathsync.config import SEED_DIR


def main(stem: str, patch_path: str) -> None:
    patch = json.load(open(patch_path, encoding="utf-8"))
    done = set()
    for p in sorted((SEED_DIR / "_rewrite").glob("*.json")):
        if stem not in ("all", p.stem):
            continue
        rw = json.load(open(p, encoding="utf-8"))
        hit = False
        for iid, langs in patch.items():
            if iid not in rw:
                continue
            for lang, edits in langs.items():
                for idx, text in edits.items():
                    rw[iid][lang][int(idx)] = text
            done.add(iid)
            hit = True
        if hit:
            body = ",\n".join(f"{json.dumps(k)}: " + json.dumps(v, ensure_ascii=False) for k, v in rw.items())
            with open(p, "w", encoding="utf-8") as h:
                h.write("{\n" + body + "\n}\n")
    print(f"patched {len(done)} items; not found: {sorted(set(patch) - done)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
