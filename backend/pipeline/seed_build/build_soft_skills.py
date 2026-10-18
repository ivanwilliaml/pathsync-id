"""Build data/seed/soft_skills.json from the retained legacy soft-skill entries.

Soft skills are experience-based: no quiz and no course path. They are mined from postings so a student can see which
ones a role asks for, and the student records their own experience (see pathsync/soft.py). Run: python -m pipeline.seed_build.build_soft_skills
"""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR

KEEP = ["verbal_communication", "presentation_storytelling", "business_writing", "collaboration", "critical_thinking",
        "stakeholder_management", "project_management", "agile_scrum", "english_proficiency"]
# generic words that matched everywhere (team names, boilerplate); the specific phrases stay
DROP_ALIASES = {"timeline", "milestone", "milestones", "pmo", "pitch", "memo", "liaise", "liaising", "berkoordinasi",
                "koordinasi dengan user", "english", "bilingual", "sprint", "sprints", "backlog", "product backlog"}
EXTRA = {"english_proficiency": ["good english", "active english", "english speaking", "komunikasi bahasa inggris"]}
TIPS = {
    "verbal_communication": "Practise by explaining a technical topic to a non-technical friend, or by presenting in a class or club meeting.",
    "presentation_storytelling": "Present a project result with one clear message and three slides, then ask for feedback.",
    "business_writing": "Write a one-page README or report for a project and ask someone to say what they understood.",
    "collaboration": "Join a group project or committee, keep a shared task board and record what you delivered.",
    "critical_thinking": "Write down a problem you solved: the options you compared, why you chose one and what you checked.",
    "stakeholder_management": "Run a small project with a real requester (a lecturer, a club, a customer) and keep notes of what they asked for.",
    "project_management": "Plan a project with milestones and owners, track it weekly and write a short retrospective.",
    "agile_scrum": "Run a two-week sprint on a team project with planning, a daily check-in and a review.",
    "english_proficiency": "Read documentation and write commit messages or reports in English; a TOEFL/IELTS score is a strong proof.",
}

TIPS_ID = {
    "verbal_communication": "Latih dengan menjelaskan topik teknis kepada teman non-teknis, atau presentasi di kelas atau rapat organisasi.",
    "presentation_storytelling": "Presentasikan hasil proyek dengan satu pesan utama dan tiga slide, lalu minta masukan.",
    "business_writing": "Tulis README atau laporan satu halaman untuk sebuah proyek, lalu minta orang lain menjelaskan apa yang mereka tangkap.",
    "collaboration": "Ikut proyek kelompok atau kepanitiaan, pakai papan tugas bersama, dan catat apa yang kamu selesaikan.",
    "critical_thinking": "Tulis satu masalah yang pernah kamu selesaikan: pilihan yang kamu bandingkan, alasan memilih, dan apa yang kamu cek.",
    "stakeholder_management": "Jalankan proyek kecil dengan peminta nyata (dosen, organisasi, pelanggan) dan catat apa yang mereka minta.",
    "project_management": "Rencanakan proyek dengan milestone dan penanggung jawab, pantau setiap minggu, lalu tulis retrospektif singkat.",
    "agile_scrum": "Jalankan sprint dua minggu di proyek tim: perencanaan, cek harian singkat, dan review.",
    "english_proficiency": "Baca dokumentasi dan tulis pesan commit atau laporan dalam bahasa Inggris; skor TOEFL/IELTS adalah bukti yang kuat.",
}


def main() -> None:
    old = json.loads((SEED_DIR / "_src" / "taxonomy_v2_backup.json").read_text(encoding="utf-8"))
    by = {s["id"]: s for s in old["skills"]}
    out = []
    for sid in KEEP:
        s = by[sid]
        aliases = [a for a in dict.fromkeys(s["aliases"] + EXTRA.get(sid, [])) if a not in DROP_ALIASES]
        out.append({"id": sid, "name": s["name"], "name_en": s.get("name_en", s["name"]), "aliases": aliases,
                    "how_to_build": TIPS[sid], "how_to_build_id": TIPS_ID[sid]})
    (SEED_DIR / "soft_skills.json").write_text(json.dumps({"version": "2026.10-soft1", "skills": out}, ensure_ascii=False, indent=1) + "\n",
                                               encoding="utf-8")
    print(len(out), "soft skills")


if __name__ == "__main__":
    main()
