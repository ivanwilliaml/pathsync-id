"""Multilingual sentence embeddings (open-source, handles mixed Indonesian/English)."""
from __future__ import annotations

import hashlib
import os
import sqlite3
import threading
from functools import wraps

import numpy as np

from .config import EMBED_BACKEND, EMBEDDING_MODEL, ONNX_FILE, PROCESSED_DIR

WARM = threading.Event()   # set once the model and indexes are loaded (api.main warmup); see /api/health/ready
_encode_slots = threading.BoundedSemaphore(2)   # at most two concurrent encodes: a slow upload no longer blocks everyone
_CACHE_PATH = PROCESSED_DIR / "embedding_cache.sqlite"
_local = threading.local()
# int8 ONNX vectors differ slightly from the PyTorch ones: keep them apart in the cache
_CACHE_TAG = EMBEDDING_MODEL if EMBED_BACKEND != "onnx" else f"{EMBEDDING_MODEL}#{ONNX_FILE}"


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


class _OnnxModel:
    """Same model through onnxruntime, for hosts with 512 MB RAM (PyTorch needs ~1 GB). Two memory choices, both
    checked against the PyTorch model in docs/ops/DEPLOY_GRATIS.md:
    * only the token-embedding table is int8 and pruned to Latin-script pieces (scripts/quantize_onnx.py); the
      transformer stays float32, because the fully int8 export moved the nearest skill for 18% of the labelled phrases;
    * SentencePiece instead of tokenizer.json (the `tokenizers` vocabulary took ~285 MB), with XLM-R's id offset;
      ids are identical on 2,655 taxonomy, course and posting phrases.
    Mean pooling over tokens, as the sentence-transformers config does."""

    MAX_TOKENS = 128

    def __init__(self):
        import onnxruntime as ort
        import sentencepiece as spm
        from huggingface_hub import hf_hub_download

        path = ONNX_FILE if os.path.exists(ONNX_FILE) else hf_hub_download(EMBEDDING_MODEL, ONNX_FILE)
        local_sp = os.path.join(os.path.dirname(path), "sentencepiece.bpe.model")
        self.sp = spm.SentencePieceProcessor(
            model_file=local_sp if os.path.exists(local_sp) else hf_hub_download(EMBEDDING_MODEL, "sentencepiece.bpe.model"))
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.enable_cpu_mem_arena = False
        self.sess = ort.InferenceSession(path, opts, providers=["CPUExecutionProvider"])
        self.inputs = {i.name for i in self.sess.get_inputs()}
        remap = path + ".ids.npy"                                   # pruned vocabulary (scripts/quantize_onnx.py)
        self.remap = np.load(remap) if os.path.exists(remap) else None

    def _ids(self, text: str) -> list[int]:
        # fairseq offset used by XLM-R: <s>=0, <pad>=1, </s>=2, <unk>=3, SentencePiece id + 1 otherwise
        body = [(i + 1) if i else 3 for i in self.sp.encode(text)][: self.MAX_TOKENS - 2]
        if self.remap is not None:
            body = [int(self.remap[i]) for i in body]
        return [0, *body, 2]

    def encode(self, texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False):
        out = []
        for i in range(0, len(texts), batch_size):
            seqs = [self._ids(t) for t in texts[i:i + batch_size]]
            width = max(map(len, seqs))
            ids = np.ones((len(seqs), width), dtype=np.int64)          # pad id 1
            mask = np.zeros((len(seqs), width), dtype=np.int64)
            for r, sq in enumerate(seqs):
                ids[r, :len(sq)] = sq
                mask[r, :len(sq)] = 1
            feed = {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)}
            hidden = self.sess.run(None, {k: v for k, v in feed.items() if k in self.inputs})[0]
            m = mask[..., None].astype(np.float32)
            v = (hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)
            if normalize_embeddings:
                v = v / np.clip(np.linalg.norm(v, axis=1, keepdims=True), 1e-12, None)
            out.append(v.astype(np.float32))
        return np.vstack(out)


@once
def _load_model():
    if EMBED_BACKEND == "onnx":
        return _OnnxModel()
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
    keys = [hashlib.sha1(f"{_CACHE_TAG}|{t}".encode()).hexdigest() for t in texts]
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
