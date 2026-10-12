"""Monthly market refresh for the compose `market-refresh` service (PM audit BE-8).

Scrapes the public sources, rebuilds the market map and records the outcome in the audit log, so a failed run is
visible in Admin -> Activity instead of silently leaving the market map stale.
"""
from __future__ import annotations

import subprocess
import sys
from datetime import date

from pathsync.db import get_session, init_db
from pathsync.security import audit


def _run(*args: str) -> None:
    subprocess.run([sys.executable, "-m", *args], check=True, timeout=3 * 3600)


def main() -> None:
    init_db()
    try:
        for scraper in ("scrapers.karirhub", "scrapers.ats"):
            _run(scraper)
        _run("pipeline.build_market", "--ref", date.today().isoformat())
        outcome, ok = "ok", True
    except Exception as e:  # noqa: BLE001 - recorded, then re-raised so the container log shows it too
        outcome, ok = f"failed: {e}"[:300], False
    with get_session() as s:
        audit(s, "system", "market refresh", outcome, {"date": date.today().isoformat(), "ok": ok})
        s.commit()
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
