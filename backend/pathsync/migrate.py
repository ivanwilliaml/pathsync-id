"""Schema migrations (Alembic). Called from init_db() on startup and by the Docker entrypoint."""
from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
BASELINE = "0001"


def _config(connection) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", MIGRATIONS.as_posix())
    cfg.attributes["connection"] = connection
    return cfg


def upgrade(engine) -> None:
    with engine.connect() as conn:
        sqlite = conn.dialect.name == "sqlite"
        if sqlite:
            # batch mode rebuilds tables; foreign keys must be off outside the transaction (SQLite rule)
            conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            conn.commit()
        with conn.begin():
            tables = set(inspect(conn).get_table_names())
            cfg = _config(conn)
            if "alembic_version" not in tables and "students" in tables:
                command.stamp(cfg, BASELINE)      # database created by create_all before migrations existed
            command.upgrade(cfg, "head")
        if sqlite:
            conn.exec_driver_sql("PRAGMA foreign_keys=ON")
            bad = conn.execute(text("PRAGMA foreign_key_check")).fetchall()
            conn.commit()
            if bad:
                raise RuntimeError(f"foreign key violations after migration: {bad[:5]}")


def check(engine) -> None:
    """Fail when the models and the migration head differ (same as `alembic check`)."""
    with engine.connect() as conn:
        command.check(_config(conn))


if __name__ == "__main__":
    import sys

    from .db import _engine

    if sys.argv[1:] == ["check"]:
        check(_engine)
        print("models and migrations match")
    else:
        upgrade(_engine)
        print("upgraded to head")
