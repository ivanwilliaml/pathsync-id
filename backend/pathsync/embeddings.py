"""Multilingual sentence embeddings (open-source, handles mixed Indonesian/English)."""
from __future__ import annotations

import hashlib
import sqlite3
import threading
from functools import wraps

import numpy as np

from .config import EMBEDDING_MODEL, PROCESSED_DIR

WARM = threading.Event()   # set once the model and indexes are loaded (api.main warmup); see /api/health/ready
_encode_slots = threading.BoundedSemaphore(2)   # at most two concurrent encodes: a slow upload no longer blocks everyone
_CACHE_PATH = PROCESSED_DIR / "embedding_cache.sqlite"
_local = threading.local()


def once(fn):
    """Like lru_cache(maxsize=1) for zero-argument builders, but thread-safe: under concurrent first requests the
    expensive build (model load, embedding an index) runs once and the other threads wait for it, instead of every
    thread building its own copy (that made the first 40 concurrent uploads take two minutes)."""
    lock = threading.Lock()
    box: list = []

    @wraps(fn)
    def get():
        if box:
            return box[0]
        with lock:
            if not box:
                box.append(fn())
        return box[0]

    get.cache_clear = box.clear
    return get


@once
def _load_model():
    from sentence_transformers import SentenceTransformer  # heavy import, load lazily

    return SentenceTransformer(EMBEDDING_MODEL)


def get_model():
    return _load_model()


def _cache_conn():
    """One SQLite connection per thread (opening a new one on every call was a measurable cost)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(_CACHE_PATH, timeout=10, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("CREATE TABLE IF NOT EXISTS emb (k TEXT PRIMARY KEY, v BLOB)")
        _local.conn = conn
    return conn


def encode(texts: list[str], batch_size: int = 64) -> np.ndarray:
    """L2-normalised embeddings with a persistent cache keyed by (model, text)."""
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    keys = [hashlib.sha1(f"{EMBEDDING_MODEL}|{t}".encode()).hexdigest() for t in texts]
    out: list[np.ndarray | None] = [None] * len(texts)
    conn = _cache_conn()
    for i, k in enumerate(keys):
        row = conn.execute("SELECT v FROM emb WHERE k=?", (k,)).fetchone()
        if row:
            out[i] = np.frombuffer(row[0], dtype=np.float32)
    missing = [i for i, v in enumerate(out) if v is None]
    if missing:
        mine, waits = _claim([keys[i] for i in missing])
        try:
            todo = [i for i in missing if keys[i] in mine]
            if todo:
                model = get_model()
                with _encode_slots:
                    vecs = model.encode([texts[i] for i in todo], batch_size=batch_size,
                                        normalize_embeddings=True, show_progress_bar=False)
                for i, v in zip(todo, vecs, strict=False):
                    v = np.asarray(v, dtype=np.float32)
                    out[i] = v
                    conn.execute("INSERT OR REPLACE INTO emb VALUES (?, ?)", (keys[i], v.tobytes()))
                conn.commit()
        finally:
            _release(mine, {keys[i]: out[i] for i in missing if keys[i] in mine and out[i] is not None})
        for i in missing:
            if out[i] is None:                    # another thread was already encoding this text: use its result
                out[i] = _wait_for(keys[i], waits.get(keys[i]))
                if out[i] is None:                # that thread failed: encode it here
                    out[i] = encode([texts[i]], batch_size)[0]
    return np.vstack(out)


# Single flight (plan B4): after a restart, 40 concurrent uploads of the same course name all missed the cache
# and encoded the same text one after another behind _encode_slots (about 20 s for the last one). Now the
# first thread encodes a text and the others wait for its result.
_inflight_lock = threading.Lock()
_inflight: dict[str, threading.Event] = {}
_results: dict[str, np.ndarray] = {}


def _claim(keys: list[str]) -> tuple[set[str], dict[str, threading.Event]]:
    mine, waits = set(), {}
    with _inflight_lock:
        for k in keys:
            if k in _inflight:
                waits[k] = _inflight[k]
            else:
                _inflight[k] = threading.Event()
                mine.add(k)
    return mine, waits


def _release(mine: set[str], done: dict[str, np.ndarray]) -> None:
    with _inflight_lock:
        for k in mine:
            if k in done:
                _results[k] = done[k]
            ev = _inflight.pop(k, None)
            if ev is not None:
                ev.set()
        if len(_results) > 4096:
            _results.clear()


def _wait_for(key: str, ev: threading.Event | None, timeout: float = 60.0) -> np.ndarray | None:
    if ev is not None:
        ev.wait(timeout)
    with _inflight_lock:
        return _results.get(key)


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
