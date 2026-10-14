"""Copy every row from a SQLite PathSync database into an empty, migrated PostgreSQL one.

    python -m pipeline.sqlite_to_postgres sqlite:///data/pathsync.db postgresql+psycopg://user:pw@host/db

The target is upgraded to the migration head first and must not hold any rows yet. Tables
are copied parent first (foreign-key order), then every integer id sequence is moved past the
largest copied id so new rows do not collide. Row counts are compared at the end.
"""
from __future__ import annotations

import sys

from sqlalchemy import create_engine, func, inspect, select, text

BATCH = 1000


def migrate(src_url: str, dst_url: str) -> dict[str, int]:
    from pathsync.db import Base
    from pathsync.migrate import upgrade

    src = create_engine(src_url)
    dst = create_engine(dst_url)
    if dst.dialect.name != "postgresql":
        raise SystemExit("target must be PostgreSQL")
    upgrade(dst)
    src_tables = set(inspect(src).get_table_names())
    tables = [t for t in Base.metadata.sorted_tables if t.name in src_tables]

    with dst.connect() as d:
        busy = [t.name for t in tables if d.execute(select(func.count()).select_from(t)).scalar()]
    if busy:
        raise SystemExit(f"target already has rows in: {', '.join(busy)}")

    copied: dict[str, int] = {}
    with src.connect() as s, dst.begin() as d:
        for t in tables:
            n = 0
            result = s.execute(select(t))
            while rows := result.mappings().fetchmany(BATCH):
                d.execute(t.insert(), [dict(r) for r in rows])
                n += len(rows)
            copied[t.name] = n
        for t in tables:
            for col in t.primary_key.columns:
                if col.autoincrement is True or (col.autoincrement == "auto" and col.type.python_type is int):
                    seq = d.execute(text("SELECT pg_get_serial_sequence(:t, :c)"),
                                    {"t": t.name, "c": col.name}).scalar()
                    if seq:
                        d.execute(text(f'SELECT setval(:s, COALESCE((SELECT MAX("{col.name}") FROM "{t.name}"), 0) + 1, false)'),
                                  {"s": seq})

    with dst.connect() as d:
        for t in tables:
            got = d.execute(select(func.count()).select_from(t)).scalar()
            if got != copied[t.name]:
                raise SystemExit(f"{t.name}: copied {copied[t.name]} rows but target has {got}")
    return copied


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    counts = migrate(sys.argv[1], sys.argv[2])
    for name, n in counts.items():
        print(f"{name:28s} {n}")
    print(f"done: {sum(counts.values())} rows in {len(counts)} tables")
