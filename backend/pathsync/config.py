"""Central configuration. Every numeric constant here is quoted from the paper
(section in brackets) so that the implementation can be audited against it."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
SEED_DIR = DATA_DIR / "seed"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = DATA_DIR / "models"
for _d in (RAW_DIR, SEED_DIR, PROCESSED_DIR, MODELS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Display language of everything the API returns (skill names, explanations, assessment items).
# Seed data keeps the Indonesian originals; extraction prompts always use them.
# LANG is the server default; a request can ask for its own ("X-PathSync-Lang: id|en", set by the web app's
# language switch), which display code reads through lang() / tr(). Matching and extraction never depend on it.
LANG = os.getenv("PATHSYNC_LANG", "en")
# posting sources left out of the market map, comma-separated (e.g. "kalibrr" while permission is pending; see
# docs/ops/DATA_SOURCES.md). Raw files stay on disk; only the market build ignores them.
EXCLUDED_SOURCES = frozenset(x.strip() for x in os.getenv("PATHSYNC_EXCLUDED_SOURCES", "").split(",") if x.strip())

DATABASE_URL = os.getenv("PATHSYNC_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'pathsync.db').as_posix()}")
# hosted Postgres (Neon, Supabase) hands out postgres:// or postgresql:// URLs; use the psycopg 3 driver for both
for _p in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_p):
        DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len(_p):]

# ---------------------------------------------------------------- embeddings
# Open-source multilingual sentence embedding model that handles mixed ID/EN terms [III.B]
EMBEDDING_MODEL = os.getenv("PATHSYNC_EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
# "torch" (sentence-transformers) or "onnx" (onnxruntime, int8 file below; for small hosts, see docs/ops/DEPLOY_GRATIS.md)
EMBED_BACKEND = os.getenv("PATHSYNC_EMBED_BACKEND", "torch")
# a local path (built by backend/scripts/quantize_onnx.py) or a file in the model repo
ONNX_FILE = os.getenv("PATHSYNC_ONNX_FILE", "onnx/model.onnx")

# ----------------------------------------------------- extraction / normalisation [III.A.1]
SIM_AUTO = 0.85        # >= 0.85  -> mapped automatically (only when EMBEDDING_AUTO is on)
SIM_REVIEW = 0.70      # 0.70-0.85 -> manual review queue ; < 0.70 -> new-skill candidate
# Free-text phrases mapped by embedding similarity alone. The rule written before the labels existed: the automatic band
# starts at the lowest threshold whose precision on the labelled phrases is >= 0.95. On the 274 verified phrases no
# threshold reaches it (data/models/normalisation_eval.json), so these phrases go to the review queue and never count
# in the market map. Turn back on only when a re-run of pipeline.normalisation eval chooses a threshold.
EMBEDDING_AUTO = os.getenv("PATHSYNC_EMBEDDING_AUTO", "0") == "1"
LLM_MODEL = os.getenv("PATHSYNC_LLM_MODEL", "claude-opus-5-5")

# ------------------------------------------------------------ demand map [III.A.1, eq. 1]
DEMAND_HALF_LIFE_MONTHS = 6.0   # w_j = 0.5 ** (a_j / 6)
DEMAND_WINDOW_MONTHS = 12       # postings from the last 12 months [III.C.1]
TREND_WINDOW_MONTHS = 6         # last 6 months vs the previous 6 months
TREND_CLIP = 0.5                # g_s clipped to [-0.5, 0.5]       [Table 3]
TREND_LAMBDA = 0.5              # T_s = 1 + lambda * g_s, lambda=0.5 [Table 3]
TREND_MIN_POSTINGS = 15         # below this per window the trend is reported as insufficient

# ------------------------------------------------------- evidence model [III.A.2, eq. 2]
EVIDENCE_WEIGHTS = {            # w_k: more direct evidence weighs more
    "academic": 0.20,
    "certificate": 0.25,        # Fig. 5: certificate strength "sedang" (between academic and project)
    "project": 0.30,
    "assessment": 0.50,
}
GRADE_SCORES = {"A": 1.0, "A-": 0.92, "B+": 0.83, "B": 0.75, "B-": 0.67, "C+": 0.58, "C": 0.50, "D": 0.25, "E": 0.0}
RUBRIC_SCORES = {0: 0.0, 1: 0.40, 2: 0.70, 3: 1.0}   # tidak tampak, dasar, mandiri, mahir
RUBRIC_LABELS = {0: "tidak tampak", 1: "dasar", 2: "mandiri", 3: "mahir"}
PRIOR_NO_EVIDENCE = 0.10        # mastery prior when no evidence exists yet
INDIRECT_CAP = 0.60             # p0 ceiling from grades / completion certificates alone (initial policy, audit COMP-01)
P_MIN, P_MAX = 0.01, 0.99       # p never reaches 0 or 1, so every answer can still move it
LOW_CONFIDENCE = 0.40           # K_s below this is flagged "keyakinan rendah" on the dashboard

# Bayesian knowledge tracing [III.A.2, eq. 3] - initial values from the usual literature range
BKT_SLIP = 0.10
BKT_GUESS = 0.25                # 4-option multiple choice
BKT_TRANSIT = 0.10

# --------------------------------------------------- ranking model [III.A.4, Table 3, eq. 4-5]
READINESS_THRESHOLD = 0.60      # R_s = 1 if every prerequisite has p >= 0.6 else 0.5
FEATURE_FLOOR = 0.03            # D_s and K_s floored at 0.03 so log() is defined
REQUIRED_MIN, REQUIRED_MAX = 0.60, 0.85   # r_s range by ESCO status and posting frequency
FEATURES = ["G", "R", "K", "D", "T", "U", "B"]
FORMULA5_WEIGHTS = {"G": 1.0, "R": 1.0, "K": 0.0, "D": 1.0, "T": 1.0, "U": 1.0, "B": 0.0}
RANKER_L2 = 1.0                 # regularisation towards the formula-5 weights

# ------------------------------------------------------------- learning path [III.A.5]
PATH_TOP_K = 3                  # three top-ranked skills + their unmastered prerequisites
MATERIALS_PER_STEP = 3

from .roles import CATALOG as _CATALOG  # noqa: E402

ROLES = {r.id: {"name": r.name, "esco": list(r.esco), "family": r.family, "blurb": r.blurb} for r in _CATALOG}
DEFAULT_ROLE = "business_analyst"
