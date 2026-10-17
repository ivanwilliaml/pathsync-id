"""Market snapshot management: ESCO status, building and loading the demand map."""
from __future__ import annotations

import hashlib
import json
from datetime import date
from functools import lru_cache

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .config import RAW_DIR, ROLES, SEED_DIR
from .db import MarketSnapshot, Posting, active_snapshot, bump_epoch
from .demand import MarketMap, PostingSkills, compute_market, required_levels
from .roles import skill_ids_for_role
from .taxonomy import load_skills


@lru_cache(maxsize=1)
def esco_status() -> dict[str, dict[str, str]]:
    """role -> skill -> essential|optional|'' from the ESCO occupation profiles."""
    path = RAW_DIR / "esco_occupations.json"
    skills = load_skills()
    if not path.exists():
        return {r: {} for r in ROLES}
    data = json.loads(path.read_text(encoding="utf-8"))
    title = {u: s["title"] for u, s in data["skills"].items()}
    out: dict[str, dict[str, str]] = {}
    for role, cfg in ROLES.items():
        ess, opt = set(), set()
        for occ in cfg["esco"]:
            o = data["occupations"].get(occ, {})
            ess |= {title[u] for u in o.get("essential", []) if u in title}
            opt |= {title[u] for u in o.get("optional", []) if u in title}
        st = {}
        for sid, sk in skills.items():
            names = set(sk.esco)
            st[sid] = "essential" if names & ess else ("optional" if names & opt else "")
        out[role] = st
    return out


def _sha(path) -> str | None:
    """Short content hash; line endings are normalised so a Windows checkout gives the same value as CI."""
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:16] if path.exists() else None


def provenance(extractors: dict[str, int], overrides: dict[str, float] | None = None, postings: int | None = None) -> dict:
    """What a snapshot was computed from (plan B5): taxonomy version and seed hashes, extractor mix and the cache
    tag of each extractor (the tag changes when aliases change), gold hashes, and whether levels were overridden."""
    from .extraction import cache_tag
    from .taxonomy import load_taxonomy

    kinds = sorted({e.split(":")[0] for e in extractors})
    return {"taxonomy_version": load_taxonomy()["version"], "taxonomy_sha": _sha(SEED_DIR / "taxonomy.json"),
            "graph_sha": _sha(SEED_DIR / "graph.json"), "esco_sha": _sha(RAW_DIR / "esco_occupations.json"),
            "postings": postings if postings is not None else sum(extractors.values()), "extractors": extractors,
            "cache_tags": {k: cache_tag(k) for k in kinds if k in ("lexicon", "llm")},
            "gold_sha": {n: _sha(SEED_DIR / n) for n in ("gold_blind.json", "gold_split.json", "gold_consensus.json")
                         if (SEED_DIR / n).exists()},
            "overrides": bool(overrides)}


def build_snapshot(s: Session, role: str, version: str, ref: date, note: str = "",
                   overrides: dict[str, float] | None = None) -> MarketSnapshot:
    skills = load_skills()
    rows = s.scalars(select(Posting).where(Posting.role == role, Posting.duplicate_of.is_(None))).all()
    ps = []
    sources: dict[str, int] = {}
    for p in rows:
        published = p.published_at or p.first_seen
        ids = {m.skill_id for m in p.mentions if m.skill_id and m.status == "auto"}
        ps.append(PostingSkills(p.id, published, ids))
    market = compute_market(ps, skill_ids_for_role(role, skills), role, ref)
    for p in rows:
        published = p.published_at or p.first_seen
        if 0 <= (ref - published).days <= 366:
            sources[p.source] = sources.get(p.source, 0) + 1
    req = required_levels(market, esco_status().get(role, {}), overrides)
    s.execute(update(MarketSnapshot).where(MarketSnapshot.role == role).values(active=False))
    used: dict[str, int] = {}
    for p in rows:
        used[p.extractor or "?"] = used.get(p.extractor or "?", 0) + 1
    snap = MarketSnapshot(version=version, role=role, reference_date=ref, data=market.to_dict(), required=req,
                          sources=sources, note=note, active=True, provenance=provenance(used, overrides, len(rows)))
    s.add(snap)
    bump_epoch(s)
    s.flush()
    return snap


def load_market(s: Session, role: str) -> tuple[MarketMap, dict[str, float], str]:
    snap = active_snapshot(s, role)
    if snap is None:
        raise LookupError(f"no market snapshot for role {role}; run `python -m pipeline.build_market` first")
    return MarketMap.from_dict(snap.data), dict(snap.required), snap.version
