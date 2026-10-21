"""Pages that look at every role must not run a query per role (audit 21 Oct: /api/meta ran 44, /careers/graph 22,
/students/{sid}/careers 25). On a remote database each query is a network round trip."""
import pytest
from sqlalchemy import event
from test_api import new_student


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


class _Counter:
    def __enter__(self):
        from pathsync.db import _engine

        self.n = 0
        self._engine = _engine
        event.listen(_engine, "before_cursor_execute", self._hit)
        return self

    def _hit(self, *args, **kwargs):
        self.n += 1

    def __exit__(self, *exc):
        event.remove(self._engine, "before_cursor_execute", self._hit)


def test_active_snapshot_summaries_match_the_full_lookup():
    from pathsync.config import ROLES
    from pathsync.db import SessionLocal, active_snapshot, active_snapshot_summaries

    with SessionLocal() as s:
        summaries = active_snapshot_summaries(s)
        for role in ROLES:
            snap = active_snapshot(s, role)
            if snap is None:
                assert role not in summaries
            else:
                assert summaries[role] == {"id": snap.id, "version": snap.version, "n_postings": snap.data.get("n_postings", 0)}


@pytest.mark.parametrize("path,budget", [("/api/meta", 12), ("/api/careers/graph", 8)])
def test_public_pages_over_all_roles_stay_inside_a_query_budget(client, path, budget):
    client.get(path)                                    # warm the shared caches
    with _Counter() as q:
        assert client.get(path).status_code == 200
    assert q.n <= budget, f"{path} ran {q.n} queries (budget {budget})"


def test_career_readiness_for_all_roles_stays_inside_a_query_budget(client):
    sid, h = new_student(client)
    client.get(f"/api/students/{sid}/careers", headers=h)
    with _Counter() as q:
        assert client.get(f"/api/students/{sid}/careers", headers=h).status_code == 200
    assert q.n <= 14, f"/careers ran {q.n} queries"
