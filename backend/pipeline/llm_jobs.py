"""Offline LLM runs on a GPU notebook (Kaggle) for when no Anthropic credentials are available.

The prompts, taxonomy block and output schema are exactly the ones used by the Claude path in
pathsync/extraction/llm.py; only the model differs (an open-weight instruction model). Results are
brought back through the same gates as any other extractor (quote verification + embedding
normalisation), so nothing unverified enters the market map.

  python -m pipeline.llm_jobs export-postings [--gold-plus 300]  -> kaggle/jobs/postings.json
  python -m pipeline.llm_jobs export-scenarios           -> kaggle/jobs/scenarios.json
  (run kaggle/pathsync_llm.py on a GPU notebook, download llm_results_*.json)
  python -m pipeline.llm_jobs import-postings <file>     -> extraction cache (key ...|llm|<taxonomy>)
  python -m pipeline.llm_jobs import-scenarios <file>    -> data/models/llm_baseline_orders.json
  python -m pipeline.llm_jobs compare                    -> data/models/extractor_comparison.json

After import-postings, `python -m pipeline.build_market --extractor llm` reads the cache and never
calls the Anthropic API; after import-scenarios, `python -m pipeline.expert_study` adds the
"generic LLM" baseline to the evaluation.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from pathsync.config import BACKEND_DIR, MODELS_DIR, PROCESSED_DIR, ROLES
from pathsync.extraction import skill_index
from pathsync.extraction.base import Mention, apply_gates
from pathsync.extraction.llm import POSTING_SYSTEM, _mention_schema, _taxonomy_block
from pathsync.taxonomy import load_skills, load_taxonomy

JOBS_DIR = BACKEND_DIR.parent / "kaggle" / "jobs"
EXTRACTION_CACHE = PROCESSED_DIR / "extraction_cache.json"
LLM_ORDERS = MODELS_DIR / "llm_baseline_orders.json"
COMPARISON = MODELS_DIR / "extractor_comparison.json"

GENERIC_RANKING_SYSTEM = ("Kamu konselor karier. Urutkan keterampilan kandidat dari yang paling perlu dipelajari lebih dahulu "
                          "oleh mahasiswa ini untuk peran target. Jawab dengan seluruh kandidat dalam urutan.")


def _postings(keys: set[str] | None = None) -> list[dict]:
    """Unique postings by fingerprint. keys: restrict to these "source:source_id" ids; gold postings
    are kept even when shorter than the 200-character floor."""
    from pipeline.build_market import load_raw

    rows = [r for r in load_raw() if r.get("role") in ROLES]
    if keys is not None:
        rows = [r for r in rows if f"{r['source']}:{r['source_id']}" in keys]
    else:
        rows = [r for r in rows if len(r.get("description_text", "")) >= 200]
    seen, out = set(), []
    for r in rows:
        if r["fingerprint"] in seen:
            continue
        seen.add(r["fingerprint"])
        out.append({"fingerprint": r["fingerprint"], "key": f"{r['source']}:{r['source_id']}",
                    "title": r["title"], "text": r["description_text"]})
    return out


def _gold_plus_random(n_random: int, seed: int = 20261014) -> set[str]:
    """Plan A2 step 2: every gold posting (locked split and the earlier sets) plus `n_random`
    other postings, drawn with a fixed seed, for a stability check."""
    import random

    from pathsync.gold import earlier_gold_ids, load_split
    from pipeline.build_market import load_raw

    split = load_split() or {"dev": [], "test": []}
    gold = set(split["dev"]) | set(split["test"]) | earlier_gold_ids()
    rest = sorted(f"{r['source']}:{r['source_id']}" for r in load_raw()
                  if r.get("role") in ROLES and len(r.get("description_text", "")) >= 200)
    rest = [k for k in rest if k not in gold]
    return gold | set(random.Random(seed).sample(rest, min(n_random, len(rest))))


def export_postings(gold_plus: int | None = None):
    skills = load_skills()
    items = _postings(_gold_plus_random(gold_plus) if gold_plus is not None else None)
    jobs = {"kind": "postings", "taxonomy_version": load_taxonomy()["version"],
            "system": POSTING_SYSTEM.format(taxonomy=_taxonomy_block(skills)),
            "user_prefix": "Teks lowongan:\n\n", "schema": _mention_schema(list(skills)), "items": items}
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    p = JOBS_DIR / "postings.json"
    p.write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
    print(f"[llm_jobs] {len(jobs['items'])} lowongan -> {p}")


def export_scenarios():
    from sqlalchemy import select

    from pathsync.db import Scenario, get_session
    from pathsync.engine import load_context
    from pipeline.expert_study import scenario_prompt

    with get_session() as s:
        names = load_context(s, "business_analyst").names
        rows = s.scalars(select(Scenario).order_by(Scenario.id)).all()
        items = [{"id": r.id, "text": scenario_prompt(r.payload, names), "candidates": r.payload["candidates"],
                  "fingerprint": _scenario_fingerprint(r.payload)} for r in rows]
    if not items:
        raise SystemExit("belum ada skenario; jalankan python -m pipeline.expert_study dulu")
    schema = {"type": "object", "properties": {"order": {"type": "array", "items": {"type": "string"}}},
              "required": ["order"], "additionalProperties": False}
    jobs = {"kind": "scenarios", "system": GENERIC_RANKING_SYSTEM, "user_prefix": "", "schema": schema, "items": items}
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    p = JOBS_DIR / "scenarios.json"
    p.write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
    print(f"[llm_jobs] {len(items)} skenario -> {p}")


def _scenario_fingerprint(payload: dict) -> str:
    import hashlib

    return hashlib.sha1(json.dumps({k: payload[k] for k in ("candidates", "student", "market")}, sort_keys=True).encode()).hexdigest()[:16]


def import_postings(path: str):
    res = json.loads(Path(path).read_text(encoding="utf-8"))
    skills = load_skills()
    tax_version = load_taxonomy()["version"]
    texts = {r["fingerprint"]: r["text"] for r in _postings() + _postings(_gold_plus_random(0))}
    cache = json.loads(EXTRACTION_CACHE.read_text(encoding="utf-8")) if EXTRACTION_CACHE.exists() else {}
    stats, n, bad = Counter(), 0, 0
    label = f"llm:{res.get('model', 'open')}"
    for fp, out in res["results"].items():
        if fp not in texts:
            continue
        if out.get("error"):
            bad += 1
            continue
        raw = []
        for it in out.get("skills", []):
            sid = it.get("skill_id")
            sid = sid if sid in skills else None                    # "NEW" or an invented id -> free text
            raw.append(Mention(surface=str(it.get("surface", ""))[:300], quote=str(it.get("quote", "")),
                               level=it.get("level") if it.get("level") in ("dasar", "mandiri", "mahir") else "mandiri",
                               skill_id=sid, similarity=1.0 if sid else 0.0, status="auto" if sid else "pending", method="llm"))
        g = apply_gates(raw, texts[fp], skill_index(), set(skills))
        mentions = g.mentions + g.review + g.new_candidates + g.rejected
        for m in mentions:
            stats[m.status] += 1
        cache[f"{fp}|llm|{tax_version}"] = {"extractor": label, "mentions": [m.to_dict() for m in mentions]}
        n += 1
    EXTRACTION_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"[llm_jobs] {n} lowongan diimpor ({bad} gagal diparse) | status sebutan: {dict(stats)}")
    missing = set(texts) - set(res["results"])
    if missing or bad:
        print(f"[llm_jobs] PERHATIAN: {len(missing)} lowongan belum punya hasil; build_market --extractor llm "
              "akan mencoba Claude API untuk lowongan tersebut")


def import_scenarios(path: str):
    from sqlalchemy import select

    from pathsync.db import Scenario, get_session

    res = json.loads(Path(path).read_text(encoding="utf-8"))
    with get_session() as s:
        rows = {r.id: r.payload for r in s.scalars(select(Scenario)).all()}
    orders, fps, stale, bad = {}, {}, 0, 0
    for sid, out in res["results"].items():
        if sid not in rows:
            continue
        if out.get("fingerprint") and out["fingerprint"] != _scenario_fingerprint(rows[sid]):
            stale += 1                              # scenario regenerated since export: skip
            continue
        cands = rows[sid]["candidates"]
        order = [c for c in out.get("order", []) if c in cands]
        if len(set(order)) < 2:
            bad += 1
            continue
        seen = []
        for c in order + cands:                     # same completion rule as ClaudeExtractor.generic_ranking
            if c not in seen:
                seen.append(c)
        orders[sid] = seen
        fps[sid] = _scenario_fingerprint(rows[sid])
    LLM_ORDERS.write_text(json.dumps({"model": res.get("model"), "generated_at": res.get("generated_at"), "orders": orders,
                                      "fingerprints": fps},
                                     ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[llm_jobs] {len(orders)}/{len(rows)} urutan skenario disimpan ({stale} kedaluwarsa, {bad} tidak valid) -> {LLM_ORDERS}")


def compare():
    """Agreement between the lexicon and LLM extractors on the same postings (no gold labels needed)."""
    from scipy.stats import spearmanr

    tax_version = load_taxonomy()["version"]
    cache = json.loads(EXTRACTION_CACHE.read_text(encoding="utf-8"))
    posts = _postings()

    def auto(entry):
        return {m["skill_id"] for m in entry["mentions"] if m["status"] == "auto" and m["skill_id"]}

    jacc, only_lex, only_llm, both = [], Counter(), Counter(), Counter()
    lex_cnt, llm_cnt = Counter(), Counter()
    n = 0
    for p in posts:
        a = cache.get(f"{p['fingerprint']}|lexicon|{tax_version}")
        b = cache.get(f"{p['fingerprint']}|llm|{tax_version}")
        if not a or not b:
            continue
        n += 1
        A, B = auto(a), auto(b)
        jacc.append(len(A & B) / len(A | B) if A | B else 1.0)
        for s in A - B:
            only_lex[s] += 1
        for s in B - A:
            only_llm[s] += 1
        for s in A & B:
            both[s] += 1
        lex_cnt.update(A)
        llm_cnt.update(B)
    skills = list(load_skills())
    rho = spearmanr([lex_cnt[s] for s in skills], [llm_cnt[s] for s in skills]).statistic if n else None
    names = {k: v.name for k, v in load_skills().items()}
    out = {"n_postings": n, "mean_jaccard": round(sum(jacc) / len(jacc), 4) if jacc else None,
           "spearman_skill_frequency": round(float(rho), 4) if rho is not None else None,
           "mentions_per_posting": {"lexicon": round(sum(lex_cnt.values()) / max(n, 1), 2),
                                    "llm": round(sum(llm_cnt.values()) / max(n, 1), 2)},
           "top_only_lexicon": [(names[s], c) for s, c in only_lex.most_common(10)],
           "top_only_llm": [(names[s], c) for s, c in only_llm.most_common(10)],
           "top_agreed": [(names[s], c) for s, c in both.most_common(10)]}
    COMPARISON.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["export-postings", "export-scenarios", "import-postings", "import-scenarios", "compare"])
    ap.add_argument("path", nargs="?")
    ap.add_argument("--gold-plus", type=int, metavar="N",
                    help="export-postings: only the gold postings plus N random others (plan A2, e.g. 300)")
    a = ap.parse_args()
    if a.cmd.startswith("import") and not a.path:
        ap.error("butuh path berkas hasil")
    {"export-postings": lambda: export_postings(a.gold_plus), "export-scenarios": export_scenarios, "compare": compare,
     "import-postings": lambda: import_postings(a.path), "import-scenarios": lambda: import_scenarios(a.path)}[a.cmd]()


if __name__ == "__main__":
    main()
