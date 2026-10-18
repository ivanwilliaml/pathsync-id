"""Plan A7b: Indonesian texts for the taxonomy and the prerequisite graph.

data/seed/_id_taxonomy/taxonomy_id.json maps skill id -> [name, description, learn_what] and graph_id.json maps
"from>to" -> rationale. The English texts move to name_en / description_en / learn_what_en / rationale_en first, so
nothing is lost. Idempotent: python -m pipeline.seed_build.apply_indonesian_taxonomy
"""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR

SRC = SEED_DIR / "_id_taxonomy"


def main() -> None:
    tx = json.loads((SEED_DIR / "taxonomy.json").read_text(encoding="utf-8"))
    skills_id = json.loads((SRC / "taxonomy_id.json").read_text(encoding="utf-8"))
    n = 0
    for s in tx["skills"]:
        t = skills_id.get(s["id"])
        if not t:
            continue
        s.setdefault("name_en", s["name"])
        s.setdefault("description_en", s["description"])
        s.setdefault("learn_what_en", s["learn_what"])
        s["name"], s["description"], s["learn_what"] = t
        n += 1
    (SEED_DIR / "taxonomy.json").write_text(json.dumps(tx, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    g = json.loads((SEED_DIR / "graph.json").read_text(encoding="utf-8"))
    rat = json.loads((SRC / "graph_id.json").read_text(encoding="utf-8"))
    m = 0
    for e in g["edges"]:
        r = rat.get(f"{e['from']}>{e['to']}")
        if r:
            e.setdefault("rationale_en", e["rationale"])
            e["rationale"] = r
            m += 1
    (SEED_DIR / "graph.json").write_text(json.dumps(g, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{n} skills and {m} edges now carry Indonesian text")


if __name__ == "__main__":
    main()
