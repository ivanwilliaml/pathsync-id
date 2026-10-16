"""Market snapshots record what produced them (plan B5), and the extraction cache key follows the
taxonomy and lexicon content, not only the taxonomy version string."""
from __future__ import annotations

from sqlalchemy import select

from pathsync.db import MarketSnapshot, SessionLocal
from pathsync.extraction import cache_tag
from pathsync.taxonomy import load_taxonomy


def test_cache_tag_carries_version_and_content_hash():
    lex, llm = cache_tag("lexicon"), cache_tag("llm")
    version = load_taxonomy()["version"]
    assert lex.startswith(f"lexicon|{version}|") and llm.startswith(f"llm|{version}|")
    assert lex.split("|")[2] != llm.split("|")[2]          # the lexicon tag also hashes the lexicon code


def test_active_snapshots_have_provenance():
    with SessionLocal() as s:
        snaps = s.scalars(select(MarketSnapshot).where(MarketSnapshot.active.is_(True))).all()
    assert snaps
    for snap in snaps:
        p = snap.provenance or {}
        assert p.get("taxonomy_version") == load_taxonomy()["version"], snap.role
        assert p.get("taxonomy_sha") and p.get("cache_tags"), snap.role
