"""Write data/seed/_rewrite/zz_a6.json from pipeline/a6_options.py (plan A6).

Legacy items (Indonesian seed with an English overlay) get only their English options replaced;
items that came from a rewrite file keep their "new" block and Indonesian text, with the English
options replaced. Run, then `python -m pipeline.apply_item_rewrite` and `python -m pipeline.item_cue_audit`.
"""
from __future__ import annotations

import glob
import json

from pathsync.config import SEED_DIR
from pipeline.a6_options import OPTIONS


def main() -> None:
    earlier: dict[str, dict] = {}
    for f in sorted(glob.glob(str(SEED_DIR / "_rewrite" / "*.json"))):
        if not f.endswith("zz_a6.json"):
            earlier.update(json.load(open(f, encoding="utf-8")))
    out = {}
    for iid, opts in OPTIONS.items():
        assert len(opts) == 4 and len(set(opts)) == 4, iid
        prev = earlier.get(iid)
        if prev and "new" in prev:
            entry = {"new": prev["new"], "en": opts}
            if "id" in prev:
                entry["id"] = prev["id"]
            out[iid] = entry
        else:
            out[iid] = {"en": opts}
    (SEED_DIR / "_rewrite" / "zz_a6.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"zz_a6.json: {len(out)} items ({sum('new' in v for v in out.values())} from rewrite files)")


if __name__ == "__main__":
    main()
