"""Apply the data retention periods (plan B3). `python -m pipeline.retention [--dry-run]`."""
from __future__ import annotations

import argparse
import json

from pathsync.db import get_session, init_db
from pathsync.retention import purge
from pathsync.security import audit


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="only count what would be removed")
    args = ap.parse_args()
    init_db()
    with get_session() as s:
        counts = purge(s, dry_run=args.dry_run)
        if not args.dry_run:
            audit(s, "system", "retention purge", "ok", counts)
            s.commit()
    print(json.dumps({"dry_run": args.dry_run, **counts}, indent=1))


if __name__ == "__main__":
    main()
