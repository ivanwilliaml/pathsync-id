"""Multilingual sentence embeddings (open-source, handles mixed Indonesian/English)."""
from __future__ import annotations

import hashlib
import sqlite3
import threading
from functools import lru_cache

import numpy as np

from .config import EMBEDDING_MODEL, PROCESSED_DIR

_lock = threading.Lock()
_CACHE_PATH = PROCESSED_DIR / "embedding_cache.sqlite"


@lru_cache(maxsize=1)
def get_model():
    from sentence_transformers import SentenceTransformer  # heavy import, load lazily

    return SentenceTransformer(EMBEDDING_MODEL)


def _cache_conn():
    conn = sqlite3.connect(_CACHE_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS emb (k TEXT PRIMARY KEY, v BLOB)")
    return conn


def encode(texts: list[str], batch_size: int = 64) -> np.ndarray:
    """L2-normalised embeddings with a persistent cache keyed by (model, text)."""
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    keys = [hashlib.sha1(f"{EMBEDDING_MODEL}|{t}".encode("utf-8")).hexdigest() for t in texts]
    out: list[np.ndarray | None] = [None] * len(texts)
    with _lock:
        conn = _cache_conn()
        try:
            for i, k in enumerate(keys):
                row = conn.execute("SELECT v FROM emb WHERE k=?", (k,)).fetchone()
                if row:
                    out[i] = np.frombuffer(row[0], dtype=np.float32)
            missing = [i for i, v in enumerate(out) if v is None]
            if missing:
                vecs = get_model().encode([texts[i] for i in missing], batch_size=batch_size,
                                          normalize_embeddings=True, show_progress_bar=False)
                for i, v in zip(missing, vecs):
                    v = np.asarray(v, dtype=np.float32)
                    out[i] = v
                    conn.execute("INSERT OR REPLACE INTO emb VALUES (?, ?)", (keys[i], v.tobytes()))
                conn.commit()
        finally:
            conn.close()
    return np.vstack(out)


class SkillIndex:
    """Embedding index over every surface form of every taxonomy skill.

    `nearest()` returns, for a free-text skill phrase, the closest taxonomy skill and
    the cosine similarity used by the 0.85 / 0.70 normalisation thresholds.
    """

    def __init__(self, skills: dict):
        self.forms: list[str] = []
        self.owner: list[str] = []
        for sid, sk in skills.items():
            for f in {sk.name_id or sk.name, sk.name_en, *sk.aliases}:
                if f and len(f) > 1:
                    self.forms.append(f)
                    self.owner.append(sid)
        self.matrix = encode(self.forms)

    def nearest(self, phrases: list[str]) -> list[tuple[str, float, str]]:
        if not phrases:
            return []
        q = encode(phrases)
        sims = q @ self.matrix.T
        best = sims.argmax(axis=1)
        return [(self.owner[j], float(sims[i, j]), self.forms[j]) for i, j in enumerate(best)]

    def top_k(self, phrase: str, k: int = 5) -> list[tuple[str, float]]:
        sims = (encode([phrase]) @ self.matrix.T)[0]
        best: dict[str, float] = {}
        for j in np.argsort(-sims):
            sid = self.owner[j]
            if sid not in best:
                best[sid] = float(sims[j])
            if len(best) >= k:
                break
        return list(best.items())
