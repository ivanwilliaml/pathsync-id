"""Indonesian quiz items (plan A7).

    python -m pipeline.id_items status          # per bank file: items without Indonesian text yet
    python -m pipeline.id_items show x_testing  # the English source of one bank file, compact, to translate
    python -m pipeline.id_items check           # translations in data/seed/_id: ids, option counts, key order

Translations live in data/seed/_id/<name>.json as {"item-id": {"stem", "options" (key first, like the seed), "explanation"}}
and are merged by `python -m pipeline.apply_item_rewrite`. Tool and product names stay in English.
"""
from __future__ import annotations

import glob
import json
import os
import sys

from pathsync.config import SEED_DIR


def _bank() -> dict[str, list[dict]]:
    out = {}
    for f in sorted(glob.glob(str(SEED_DIR / "items" / "*.json"))):
        out[os.path.basename(f).removesuffix(".json")] = json.load(open(f, encoding="utf-8"))
    return out


def _overlay() -> dict[str, dict]:
    o: dict[str, dict] = {}
    for f in sorted(glob.glob(str(SEED_DIR / "_id" / "*.json"))):
        o.update(json.load(open(f, encoding="utf-8")))
    return o


def _english(name: str) -> dict:
    p = SEED_DIR / "items_en" / f"{name}.json"
    return json.load(open(p, encoding="utf-8")) if p.exists() else {}


def pending(name: str, items: list[dict], overlay: dict) -> list[dict]:
    """Items whose Indonesian side is still the English text (or missing from the overlay)."""
    en = _english(name)
    return [it for it in items if it["id"] not in overlay and en.get(it["id"], {}).get("stem") == it["stem"]]


def status() -> None:
    overlay = _overlay()
    total = 0
    for name, items in _bank().items():
        left = pending(name, items, overlay)
        total += len(left)
        print(f"{name:22s} {len(items):3d} items, {len(left):3d} without Indonesian")
    print(f"total without Indonesian: {total}")


def show(name: str) -> None:
    items = _bank()[name]
    overlay = _overlay()
    for it in pending(name, items, overlay):
        o = it["options"]
        print(f"{it['id']} [d{it['difficulty']}] {it['stem']}\n  K: {o[0]}\n  1: {o[1]}\n  2: {o[2]}\n  3: {o[3]}\n  E: {it['explanation']}")


def check() -> int:
    bank = {it["id"]: it for items in _bank().values() for it in items}
    problems = []
    for f in sorted(glob.glob(str(SEED_DIR / "_id" / "*.json"))):
        for iid, t in json.load(open(f, encoding="utf-8")).items():
            if iid not in bank:
                problems.append(f"{os.path.basename(f)}: unknown item {iid}")
            elif len(t["options"]) != len(bank[iid]["options"]) or len(set(t["options"])) != len(t["options"]):
                problems.append(f"{iid}: option count or duplicate options")
            elif not t["stem"].strip() or not t["explanation"].strip():
                problems.append(f"{iid}: empty stem or explanation")
    print("\n".join(problems) or "translations are consistent")
    return 1 if problems else 0


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["status"]
    if cmd == "show" and rest:
        show(rest[0])
    elif cmd == "check":
        sys.exit(check())
    else:
        status()
