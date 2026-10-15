"""Plan B4: concurrent cache misses for the same text are encoded once (single flight)."""
from __future__ import annotations

import threading
import time
import uuid

import numpy as np

from pathsync import embeddings


class FakeModel:
    def __init__(self):
        self.calls = 0
        self.lock = threading.Lock()

    def encode(self, texts, **_):
        with self.lock:
            self.calls += 1
        time.sleep(0.2)
        return [np.full(384, float(len(t)), dtype=np.float32) for t in texts]


def test_same_text_is_encoded_once_under_concurrency(monkeypatch):
    fake = FakeModel()
    monkeypatch.setattr(embeddings, "get_model", lambda: fake)
    text = f"Analisis dan Perancangan Sistem {uuid.uuid4().hex}"
    results = []

    def worker():
        results.append(embeddings.encode([text])[0])

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert fake.calls == 1
    assert len(results) == 20 and all(np.array_equal(r, results[0]) for r in results)
    assert embeddings.encode([text])[0].shape == (384,)          # now served from the cache
    assert fake.calls == 1
