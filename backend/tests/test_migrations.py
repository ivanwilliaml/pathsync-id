"""Plan B1: the migrated schema matches the SQLAlchemy models (the equivalent of `alembic check`), on whichever
database the suite runs against (SQLite locally, PostgreSQL in the CI job)."""
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext


def test_migrations_match_models():
    from pathsync.db import Base, get_session, init_db

    init_db()
    with get_session() as s:
        ctx = MigrationContext.configure(s.connection(), opts={"compare_type": False})
        diff = [d for d in compare_metadata(ctx, Base.metadata)
                if not (isinstance(d, tuple) and d[0] == "remove_table" and d[1].name == "alembic_version")]
    assert diff == [], f"models and migrations differ; add a migration: {diff[:5]}"
