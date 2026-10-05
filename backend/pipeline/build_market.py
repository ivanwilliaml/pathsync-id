"""Monthly market update (paper III.A.6, trigger 2).

raw scraped JSONL (all snapshots)  ->  clean + dedupe  ->  12-month window
  ->  skill extraction with quote verification + embedding normalisation
  ->  postings & mentions in the DB  ->  new demand snapshot per role (D_s, g_s, T_s, r_s)

Run:  python -m pipeline.build_market [--extractor lexicon|llm] [--ref 2026-10-01]
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import delete, select

from pathsync.config import PROCESSED_DIR, RAW_DIR, ROLES
from pathsync.db import Posting, PostingMention, get_session, init_db
from pathsync.extraction import extract_skills
from pathsync.market import build_snapshot
from pathsync.taxonomy import load_taxonomy

DUP_THRESHOLD = 0.90
EXTRACTION_CACHE = PROCESSED_DIR / "extraction_cache.json"


def load_raw() -> list[dict]:
    rows: dict[str, dict] = {}
    files = sorted(RAW_DIR.glob("karirhub_*.jsonl")) + sorted(RAW_DIR.glob("ats_*.jsonl"))
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            key = f"{r['source']}:{r['source_id']}"
            first_seen = r.get("fetched_at", "")[:10]
            if key in rows:
                rows[key]["first_seen"] = min(rows[key]["first_seen"], first_seen)
                continue
            r["first_seen"] = first_seen
            rows[key] = r
    return list(rows.values())


def dedupe(rows: list[dict]) -> dict[str, str]:
    """Return {posting_key: canonical_key} for near-duplicates (text similarity >= 0.90)."""
    keys = [f"{r['source']}:{r['source_id']}" for r in rows]
    texts = [(r["title"] + " " + r["description_text"])[:4000].lower() for r in rows]
    if len(texts) < 2:
        return {}
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1).fit_transform(texts)
    sim = cosine_similarity(vec)
    order = sorted(range(len(rows)), key=lambda i: (rows[i].get("published_at") or "9999", keys[i]))
    canonical: dict[str, str] = {}
    kept: list[int] = []
    for i in order:
        match = next((j for j in kept if sim[i, j] >= DUP_THRESHOLD), None)
        if match is None:
            kept.append(i)
        else:
            canonical[keys[i]] = keys[match]
    return canonical


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extractor", choices=["lexicon", "llm"], default=None)
    ap.add_argument("--ref", default=date.today().isoformat())
    ap.add_argument("--version", default=None)
    args = ap.parse_args()
    ref = date.fromisoformat(args.ref)
    version = args.version or f"{ref.isoformat()}-{args.extractor or 'auto'}"

    init_db()
    tax_version = load_taxonomy()["version"]
    rows = [r for r in load_raw() if r.get("role") in ROLES and len(r.get("description_text", "")) >= 200]
    dup = dedupe(rows)
    cache = json.loads(EXTRACTION_CACHE.read_text(encoding="utf-8")) if EXTRACTION_CACHE.exists() else {}
    print(f"[market] {len(rows)} postings with text, {len(dup)} near-duplicates")

    stats = {"auto": 0, "review": 0, "new": 0, "rejected": 0}
    with get_session() as s:
        for i, r in enumerate(rows, 1):
            key = f"{r['source']}:{r['source_id']}"
            published = date.fromisoformat(r["published_at"]) if r.get("published_at") else None
            first_seen = date.fromisoformat(r["first_seen"]) if r.get("first_seen") else ref
            in_window = 0 <= (ref - (published or first_seen)).days <= 366
            ck = f"{r['fingerprint']}|{args.extractor or 'auto'}|{tax_version}"
            if ck not in cache:
                res = extract_skills(r["description_text"], prefer=args.extractor)
                cache[ck] = {"extractor": res.extractor,
                             "mentions": [m.to_dict() for m in res.mentions + res.review + res.new_candidates + res.rejected]}
            entry = cache[ck]
            p = s.get(Posting, key) or Posting(id=key)
            p.source, p.url, p.title, p.company = r["source"], r.get("url", ""), r["title"][:300], r.get("company", "")[:300]
            p.location, p.published_at, p.first_seen = r.get("location", "")[:300], published, first_seen
            p.fetched_at = datetime.fromisoformat(r["fetched_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            p.role, p.language, p.description = r["role"], r.get("language", ""), r["description_text"]
            p.fingerprint, p.duplicate_of, p.in_window = r["fingerprint"], dup.get(key), in_window
            p.extractor, p.meta = entry["extractor"], r.get("raw_meta", {})
            s.merge(p)
            s.flush()
            s.execute(delete(PostingMention).where(PostingMention.posting_id == key))
            for m in entry["mentions"]:
                s.add(PostingMention(posting_id=key, skill_id=m["skill_id"], surface=m["surface"][:300], quote=m["quote"],
                                     level=m["level"], similarity=m["similarity"], status=m["status"], method=m["method"]))
                stats[m["status"]] = stats.get(m["status"], 0) + 1
            if i % 20 == 0:
                print(f"[market] extracted {i}/{len(rows)}")
                EXTRACTION_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        EXTRACTION_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        s.commit()

        export = {"version": version, "reference_date": ref.isoformat(), "mention_status": stats, "roles": {}}
        for role in ROLES:
            snap = build_snapshot(s, role, version, ref, note=f"{len(rows)} lowongan mentah, ekstraktor={args.extractor or 'auto'}")
            export["roles"][role] = {"n_postings": snap.data["n_postings"], "trend_status": snap.data["trend_status"],
                                     "sources": snap.sources,
                                     "top": sorted(((k, v["demand"]) for k, v in snap.data["skills"].items()),
                                                   key=lambda x: -x[1])[:12]}
        s.commit()
    (PROCESSED_DIR / "market_latest.json").write_text(json.dumps(export, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(export, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
