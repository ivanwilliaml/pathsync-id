"""Load-test regressions: expensive lazy builders run once under concurrent first requests."""
import threading
import time


def test_once_builds_a_single_time_under_concurrency():
    from pathsync.embeddings import once

    calls = []

    @once
    def build():
        calls.append(1)
        time.sleep(0.2)          # a slow build (model load) while other threads arrive
        return object()

    got = []
    threads = [threading.Thread(target=lambda: got.append(build())) for _ in range(16)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1 and len({id(x) for x in got}) == 1
    build.cache_clear()
    build()
    assert len(calls) == 2
