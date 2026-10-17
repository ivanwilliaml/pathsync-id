"""Apply data/seed/_bisnis/distractors.json to the business-role items (x_bisnis), in both languages.

    python -m pipeline.item_authoring.apply_distractors      (then python -m pipeline.item_cue_audit)

First strips the padding phrases that earlier balancers appended (they read unnaturally and became a cue of their
own), then replaces the listed distractors with plausible ones and, where a key was factually wrong, the key.
Idempotent: running it twice gives the same files.
"""
from __future__ import annotations

import json
import re

from pathsync.config import SEED_DIR

PADDING = [" dalam praktik sehari-hari", " pada kebanyakan organisasi", " menurut kebiasaan umum", " pada tahap awal",
           " dalam banyak kasus", " di lingkungan kerja", " sebagai langkah rutin", " pada umumnya",
           " dalam konteks perusahaan", " untuk kebutuhan tim", " dalam proses kerja", " di tingkat operasional",
           " in day-to-day practice", " in most organisations", " by common habit", " at an early stage",
           " in many cases", " in the workplace", " as a routine step", " in general",
           " in a company setting", " for the team's needs", " within the work process", " at the operational level"]
STRIP = re.compile("(" + "|".join(re.escape(p) for p in PADDING) + ")+$")


def main() -> None:
    base_path, en_path = SEED_DIR / "items" / "x_bisnis.json", SEED_DIR / "items_en" / "x_bisnis.json"
    fixes = json.loads((SEED_DIR / "_bisnis" / "distractors.json").read_text(encoding="utf-8"))["items"]
    base = json.loads(base_path.read_text(encoding="utf-8"))
    en = json.loads(en_path.read_text(encoding="utf-8"))
    known = {it["id"] for it in base}
    missing = sorted(set(fixes) - known)
    if missing:
        raise SystemExit(f"distractors.json names unknown items: {missing}")
    for it in base:
        it["options"] = [STRIP.sub("", o) for o in it["options"]]
        e = en[it["id"]]
        e["options"] = [STRIP.sub("", o) for o in e["options"]]
        f = fixes.get(it["id"])
        if not f:
            continue
        assert len(f.get("id", "xxx")) == 3 and len(f.get("en", "xxx")) == 3, it["id"]
        it["options"] = [f.get("key_id", it["options"][0]), *f.get("id", it["options"][1:])]
        e["options"] = [f.get("key_en", e["options"][0]), *f.get("en", e["options"][1:])]
    body = ",\n".join(" " + json.dumps(it, ensure_ascii=False, separators=(",", ":")) for it in base)
    base_path.write_text("[\n" + body + "\n]\n", encoding="utf-8")
    body = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in en.items())
    en_path.write_text("{\n" + body + "\n}\n", encoding="utf-8")
    print(f"x_bisnis: padding stripped from {len(base)} items, {len(fixes)} items rewritten")


if __name__ == "__main__":
    main()
