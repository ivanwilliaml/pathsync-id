"""List the edits that would balance where the key sits in the option-length ranking (target: uniform over ranks).

Authors write the key first and tend to make it the most detailed option. For every language this prints, for the items
whose key is longer than the quota allows, the distractor that is nearest in length, so it can be lengthened by hand.
Usage: python -m pipeline.length_balance <rewrite-file-stem> [en|id]
"""
from __future__ import annotations

import collections
import json
import sys

from pathsync.config import SEED_DIR


def main(stem: str, lang: str) -> None:
    rw: dict = {}
    for f in sorted((SEED_DIR / "_rewrite").glob("*.json")):
        if stem in ("all", f.stem):
            rw.update(json.load(open(f, encoding="utf-8")))
    ranks = collections.Counter()
    info = {}
    for iid, r in rw.items():
        o = r[lang]
        L = [len(x) for x in o]
        rk = sorted(L).index(L[0])
        ranks[rk] += 1
        info[iid] = (rk, o)
    n = len(info)
    quota = n / 4
    print(f"{lang}: key length-rank counts {dict(sorted(ranks.items()))} (quota {quota:.0f} each)")
    for rank_hi, target in ((3, "lengthen a distractor"), (0, "lengthen the key")):
        surplus = int(ranks[rank_hi] - quota + 0.5)
        if surplus <= 0:
            continue
        cands = []
        for iid, (rk, o) in info.items():
            if rk != rank_hi:
                continue
            L = [len(x) for x in o]
            if rank_hi == 3:
                nxt = max(range(1, 4), key=lambda i: L[i])
                cands.append((L[0] - L[nxt], iid, nxt))
            else:
                nxt = min(range(1, 4), key=lambda i: L[i])
                cands.append((L[nxt] - L[0], iid, nxt))
        cands.sort()
        print(f"-- {surplus} items: {target}")
        for margin, iid, j in cands[:surplus]:
            o = info[iid][1]
            print(f"{iid} | margin {margin} | key[{len(o[0])}]: {o[0]} | opt{j}[{len(o[j])}]: {o[j]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "en")
