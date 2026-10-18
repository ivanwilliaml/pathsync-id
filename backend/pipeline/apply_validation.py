"""Re-apply the verified validation sheets to a freshly built database (V1, V2, V4).

    python -m pipeline.apply_validation

The sheets are frozen copies in data/seed/_validasi/ (sha256 printed). Provenance, as stated by the team on 17 Oct 2026:
  V1 and V4: two LLM passes, checked and corrected by one team member (Ivan). Not independent human annotators.
  V2: internal team review (kind "tim"); never counts as expert validation.
  V2 experts (18 Oct): three independent BA experts (1 lecturer in Information Systems, 1 process BA practitioner, 1 systems
      BA practitioner), anonymous at their request. A team member (Ivan) collected and summarised their answers into the
      sheets; the original answers and identities are kept by the team, not in the repository.
  V3: pilot responses collected by the team in Google Sheets and entered into the template (raw export not in the repo);
      analysed by pipeline.pilot_analysis.
"""
from __future__ import annotations

import hashlib
import subprocess
import sys

from pathsync.config import SEED_DIR

DIR = SEED_DIR / "_validasi"
STEPS = [
    ["pipeline.gold", "import-sheet", "llm1_verifikasi_ivan", str(DIR / "V1_llm1_verifikasi_ivan.xlsx")],
    ["pipeline.gold", "import-sheet", "llm2_verifikasi_ivan", str(DIR / "V1_llm2_verifikasi_ivan.xlsx")],
    ["pipeline.normalisation", "import", str(DIR / "normalisation_sheet_llm1_verifikasi_ivan.xlsx"),
     str(DIR / "normalisation_sheet_llm2_verifikasi_ivan.xlsx")],
    ["pipeline.normalisation", "eval"],
    ["pipeline.pilot_analysis"],
    ["pipeline.expert_sheet", "import", str(DIR / "V2_tinjauan_internal_ivan.xlsx"), "--name", "Ivan (tinjauan internal tim)",
     "--affiliation", "Tim PathSync", "--kind", "tim"],
    # Three independent BA experts (18 Oct 2026), anonymous at their request; answers collected and summarised by the team.
    ["pipeline.expert_sheet", "import", str(DIR / "V2_pakar1_dosen_si.xlsx"), "--name", "Pakar 1 (anonim)",
     "--affiliation", "Dosen Sistem Informasi (dirahasiakan)", "--kind", "dosen"],
    ["pipeline.expert_sheet", "import", str(DIR / "V2_pakar2_ba_proses.xlsx"), "--name", "Pakar 2 (anonim)",
     "--affiliation", "Praktisi BA proses (dirahasiakan)", "--kind", "praktisi"],
    ["pipeline.expert_sheet", "import", str(DIR / "V2_pakar3_ba_sistem.xlsx"), "--name", "Pakar 3 (anonim)",
     "--affiliation", "Praktisi BA sistem (dirahasiakan)", "--kind", "praktisi"],
    ["pipeline.expert_sheet", "finalize"],
]


def main() -> None:
    for f in sorted(DIR.glob("*.xlsx")):
        print(hashlib.sha256(f.read_bytes()).hexdigest()[:16], f.name)
    for step in STEPS:
        subprocess.run([sys.executable, "-m", *step], check=True)
    # the consensus file keeps its provenance block; only the annotations in the database are rebuilt here
    print("validation applied; run python -m pipeline.report")


if __name__ == "__main__":
    main()
