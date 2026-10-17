"""Every three-decimal metric quoted in the live documents (README, PLAN, audit, plans) must come from
data/models/metrics.json (plan D2). Regenerate the file with `python -m pipeline.report`."""
from __future__ import annotations

import json
import re

from pathsync.config import BACKEND_DIR, MODELS_DIR

ROOT = BACKEND_DIR.parent
DOCS = [ROOT / "README.md", ROOT / "PLAN.md", ROOT / "docs" / "audit" / "AUDIT_2026-10-16.md",
        ROOT / "docs" / "plan" / "PLAN_BACKEND_DATA_AI.md", ROOT / "docs" / "plan" / "PLAN_FRONTEND_UIUX.md"]
METRIC = re.compile(r"(?<![\d.,])0[.,](\d{3})(?!\d)")


def _values(node, out: set[str]) -> set[str]:
    if isinstance(node, bool):
        return out
    if isinstance(node, (int, float)):
        out.add(f"{node:.3f}")
    elif isinstance(node, dict):
        for v in node.values():
            _values(v, out)
    elif isinstance(node, list):
        for v in node:
            _values(v, out)
    return out


def test_document_metrics_are_in_metrics_json():
    known = _values(json.loads((MODELS_DIR / "metrics.json").read_text(encoding="utf-8")), set())
    stray = []
    for doc in DOCS:
        for n, line in enumerate(doc.read_text(encoding="utf-8").splitlines(), 1):
            for m in METRIC.finditer(line):
                if f"0.{m.group(1)}" not in known:
                    stray.append(f"{doc.name}:{n}: {m.group(0)}")
    assert not stray, "metrics not traceable to metrics.json (run pipeline.report, then fix the text):\n" + "\n".join(stray)
