"""Rebuild data/seed/materials.json: keep verified legacy materials for retained skills and add the new ones.

Every URL is requested (GET, follows redirects). 2xx/3xx = verified. 401/403/429 (bot protection) are kept but marked
unverified. Anything else is dropped and listed. Run: python -m pipeline.seed_build.build_materials_v3
"""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import httpx

from pathsync.config import SEED_DIR

UA = {"User-Agent": "Mozilla/5.0 (PathSync link checker)"}
SOFT_OK = {401, 402, 403, 429}
UNREACHABLE_OK = (".apache.org",)   # these hosts time out from the build network; the links are kept but not marked verified


def check(url: str) -> int:
    for method in ("HEAD", "GET"):
        try:
            r = httpx.request(method, url, headers=UA, timeout=20, follow_redirects=True)
            if r.status_code < 400 or method == "GET":
                return r.status_code
        except httpx.HTTPError:
            if method == "GET":
                return 0
    return 0


def main() -> None:
    tax = json.loads((SEED_DIR / "taxonomy.json").read_text(encoding="utf-8"))
    skills = {s["id"] for s in tax["skills"]}
    old = json.loads((SEED_DIR / "materials.json").read_text(encoding="utf-8"))["materials"]
    kept = [m for m in old if m["skill_id"] in skills and "_v3" not in m["id"]]
    rows = []
    for line in (SEED_DIR / "_src" / "materials_v3.txt").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        sid, title, url, diff, fmt, lang, hours = line.split("|")
        assert sid in skills, sid
        rows.append({"skill_id": sid, "title": title, "provider": urlparse(url).netloc.removeprefix("www."), "url": url,
                     "difficulty": diff, "format": fmt, "language": lang, "hours": int(hours)})
    with ThreadPoolExecutor(12) as ex:
        statuses = list(ex.map(lambda m: check(m["url"]), rows))
    out, dropped = [], []
    for i, (m, st) in enumerate(zip(rows, statuses, strict=True), 1):
        host = urlparse(m["url"]).netloc
        if (st and (st < 400 or st in SOFT_OK)) or (st == 0 and host.endswith(UNREACHABLE_OK)):
            out.append({"id": f"m3{i:03d}_v3", **m, "http_status": st, "verified": 0 < st < 400})
        else:
            dropped.append((m["skill_id"], m["url"], st))
    allm = kept + out
    (SEED_DIR / "materials.json").write_text(json.dumps({"materials": allm}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    have = {m["skill_id"] for m in allm}
    print(f"{len(kept)} legacy + {len(out)} new materials; dropped {len(dropped)}: {dropped}")
    print("skills without materials:", sorted(skills - have))


if __name__ == "__main__":
    main()
