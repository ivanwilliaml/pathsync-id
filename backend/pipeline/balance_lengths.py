"""Randomise where the key sits in the option-length ranking for newly authored items.

Authors tend to make the key the most detailed option (or, after over-correcting, the second longest). That is a cue a
test-wise student can use. For each new item this assigns a target length rank to the key (balanced over the bank and
independent of the content) and nudges option lengths with a short neutral phrase until the key reaches it: the key is
padded to go up, the distractor just below it is padded to go down. Because the option that receives a phrase is chosen by
the target rank, never by correctness, the phrase itself carries no signal.

Skips options that are code, numbers or very short names. Run after editing the n_*.json rewrite files:
    python -m pipeline.balance_lengths      (then python -m pipeline.apply_item_rewrite)
"""
from __future__ import annotations

import glob
import hashlib
import json
import pathlib
import random
import re

from pathsync.config import SEED_DIR

FILLERS = [" in practice", " in most teams", " in day-to-day work", " for the project", " at that stage", " in a real project",
           " within the team", " from the start", " in the long run", " as the work grows", " in most cases",
           " in many setups", " during the project", " for the business"]
STRIP = re.compile("(" + "|".join(re.escape(f) for f in FILLERS) + ")+$")
CODEISH = re.compile(r"[=<>{}();_/\\]|\d|--|^\w+$|@")
MIN_LEN = 22


def _padable(options: list[str]) -> bool:
    return all(len(o) >= MIN_LEN and not CODEISH.search(o) for o in options)


def _pad(text: str, need: int, rng: random.Random) -> str:
    out = text
    for _ in range(3):
        if len(out) - len(text) >= need:
            break
        out += rng.choice(FILLERS)
    return out


def main() -> None:
    files = sorted(glob.glob(str(SEED_DIR / "_rewrite" / "n_*.json")))
    data = {f: json.loads(pathlib.Path(f).read_text(encoding="utf-8")) for f in files}
    ids = sorted(i for d in data.values() for i in d)
    order = sorted(ids, key=lambda i: hashlib.sha1(i.encode()).hexdigest())
    target = {iid: k % 4 for k, iid in enumerate(order)}          # balanced, independent of content
    changed = 0
    for f, d in data.items():
        for iid, r in d.items():
            opts = [STRIP.sub("", o) for o in r["en"]]
            if not _padable(opts):
                r["en"] = opts
                continue
            rng = random.Random(int(hashlib.sha1(iid.encode()).hexdigest(), 16))
            for _ in range(6):
                lens = [len(o) for o in opts]
                rank = sorted(lens).index(lens[0])
                want = target[iid]
                if rank == want:
                    break
                if rank < want:      # key must become longer: pad the key just enough to pass the next distractor up
                    above = sorted(x for x in lens[1:] if x >= lens[0])
                    gap = (above[0] - lens[0] + 1) if above else 4
                    opts[0] = _pad(opts[0], gap, rng)
                else:                # key must become shorter in rank: pad the distractor just below it
                    below = [i for i in range(1, 4) if lens[i] <= lens[0]]
                    j = max(below, key=lambda i: lens[i])
                    opts[j] = _pad(opts[j], lens[0] - lens[j] + 1, rng)
            if opts != r["en"]:
                changed += 1
            r["en"] = opts
        pathlib.Path(f).write_text(json.dumps(d, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"balanced {changed} items of {len(ids)}")


if __name__ == "__main__":
    main()
