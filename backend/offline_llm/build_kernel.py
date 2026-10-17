"""Build a ready-to-push Kaggle kernel folder from a PathSync job file.

  python backend/offline_llm/build_kernel.py postings  --user <kaggle-username>
  kaggle kernels push -p backend/offline_llm/build/postings
  kaggle kernels status <user>/pathsync-llm-postings
  kaggle kernels output <user>/pathsync-llm-postings -p backend/offline_llm/results

The job file is embedded in the script (gzip + base64), so no Kaggle dataset is needed. Qwen3 is
attached as a Kaggle Model, so the kernel runs without internet access.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = ["qwen-lm/qwen-3/transformers/8b/1", "qwen-lm/qwen-3/transformers/4b/1"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["postings", "scenarios"])
    ap.add_argument("--user", required=True)
    a = ap.parse_args()
    jobs = (HERE / "jobs" / f"{a.kind}.json").read_bytes()
    b64 = base64.b64encode(gzip.compress(jobs, 9)).decode()
    out = HERE / "build" / a.kind
    out.mkdir(parents=True, exist_ok=True)
    src = (HERE / "pathsync_llm.py").read_text(encoding="utf-8").replace("__JOBS__", b64)
    (out / "pathsync_llm.py").write_text(src, encoding="utf-8")
    meta = {"id": f"{a.user}/pathsync-llm-{a.kind}", "title": f"pathsync-llm-{a.kind}", "code_file": "pathsync_llm.py",
            "language": "python", "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_tpu": False,
            "enable_internet": False, "dataset_sources": [], "competition_sources": [], "kernel_sources": [],
            "model_sources": MODELS, "machine_shape": "NvidiaTeslaT4"}
    (out / "kernel-metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"{out} siap ({len(src) // 1024} KB). Push: kaggle kernels push -p {out}")


if __name__ == "__main__":
    main()
