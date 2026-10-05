"""Fetch occupation -> skill relations from the public ESCO API (v1.2).

Paper III.A.1: the initial taxonomy is taken from the essential and optional skills
of the ESCO "business analyst" occupation. We also pull the two adjacent
occupations (ICT business analyst, data analyst) and every skill's own
skill-to-skill relations, which seed the prerequisite graph (III.A.3).
"""
from __future__ import annotations

import json

from .common import RAW_DIR, PoliteClient

API = "https://ec.europa.eu/esco/api"
OCCUPATIONS = {
    "business_analyst": "http://data.europa.eu/esco/occupation/60082a99-d8ef-4e84-9290-78902681b6ed",
    "ict_business_analyst": "http://data.europa.eu/esco/occupation/fe0fa514-b48d-4a53-9757-a283c0baacf0",
    "data_analyst": "http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2",
}


def _label(obj: dict, key: str = "preferredLabel") -> str:
    v = obj.get(key) or {}
    return v.get("en") if isinstance(v, dict) else (v or obj.get("title", ""))


def fetch() -> dict:
    client = PoliteClient(min_interval=0.2)
    result = {"occupations": {}, "skills": {}}
    for key, uri in OCCUPATIONS.items():
        r = client.get(f"{API}/resource/occupation", params={"uri": uri, "language": "en"})
        d = r.json()
        links = d["_links"]
        occ = {
            "uri": uri, "title": d.get("title"), "isco_code": d.get("code"),
            "description": (d.get("description") or {}).get("en", {}).get("literal", "").strip(),
            "alt_labels": (d.get("alternativeLabel") or {}).get("en", []),
            "essential": [s["uri"] for s in links.get("hasEssentialSkill", [])],
            "optional": [s["uri"] for s in links.get("hasOptionalSkill", [])],
        }
        result["occupations"][key] = occ
        print(f"[esco] {key}: {len(occ['essential'])} essential, {len(occ['optional'])} optional")
        for s in links.get("hasEssentialSkill", []) + links.get("hasOptionalSkill", []):
            result["skills"].setdefault(s["uri"], {"uri": s["uri"], "title": s["title"],
                                                   "skill_type": s.get("skillType", "").rsplit("/", 1)[-1]})

    for i, (uri, sk) in enumerate(list(result["skills"].items()), 1):
        r = client.get(f"{API}/resource/skill", params={"uri": uri, "language": "en"})
        if r is None or r.status_code != 200:
            continue
        d = r.json()
        links = d.get("_links", {})
        sk.update({
            "description": (d.get("description") or {}).get("en", {}).get("literal", "").strip(),
            "alt_labels": (d.get("alternativeLabel") or {}).get("en", []),
            "broader": [b["title"] for b in links.get("broaderSkill", []) + links.get("broaderHierarchyConcept", [])],
            "has_essential_skill": [b["title"] for b in links.get("hasEssentialSkill", [])],
            "has_optional_skill": [b["title"] for b in links.get("hasOptionalSkill", [])],
            "is_essential_for_skill": [b["title"] for b in links.get("isEssentialForSkill", [])],
        })
        if i % 20 == 0:
            print(f"[esco] skill details {i}/{len(result['skills'])}")
    client.close()
    return result


def main():
    data = fetch()
    path = RAW_DIR / "esco_occupations.json"
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"[esco] wrote {len(data['skills'])} skills -> {path}")


if __name__ == "__main__":
    main()
