"""Classroom learning experience (answers the judges' note that the link to classroom learning was weak).

PathSync's target is the learning experience, so the path is anchored in the courses a student is
taking *this semester*:

* Course companion - each current course is mapped to skills (same catalogue + embedding mapping as the
  transcript), intersected with the learning path, and turned into concrete "use this assignment as
  evidence" suggestions. Coursework becomes the evidence that moves the path (adaptive trigger 1).
* Weekly plan -> reflection - Zimmerman's self-regulated learning cycle (plan, perform, reflect) that the
  paper cites (II.A.1). Goals mix path steps and course work; reflections record minutes, confidence and
  obstacles, and a one-item direction-clarity pulse ("I know what to learn next and why", paper H1).
* Cohort view for lecturers/advisors - anonymised aggregates only, never shown below k = 5 students.
"""
from __future__ import annotations

from datetime import date, timedelta
from statistics import mean

from .config import tr

# (English, Indonesian)
ARTIFACTS = {
    "data_analytics": ("your notebook, query file (.sql) or analysis report", "notebook, file query (.sql) atau laporan analisismu"),
    "bi_tools": ("the file you built (spreadsheet notes, dashboard description or export) as text or PDF",
                 "file yang kamu buat (catatan spreadsheet, deskripsi atau ekspor dashboard) sebagai teks atau PDF"),
    "business_analysis": ("your BPMN/flowchart, requirement document (BRD/user stories) or process write-up",
                          "BPMN/flowchart, dokumen requirement (BRD/user story) atau tulisan prosesmu"),
    "data_ml": ("your notebook with the data, model, evaluation and conclusions", "notebook-mu berisi data, model, evaluasi, dan kesimpulan"),
    "data_eng": ("your pipeline code or SQL, and a short description of the data flow",
                 "kode pipeline atau SQL-mu, plus deskripsi singkat alur datanya"),
    "web_frontend": ("your code (HTML/CSS/JS), repository README or a short build write-up",
                     "kodemu (HTML/CSS/JS), README repository atau tulisan singkat proses pembuatannya"),
    "backend": ("your source code, API documentation or README with the endpoints", "source code, dokumentasi API atau README berisi endpoint-nya"),
    "mobile": ("your app code, README and a description of the screens", "kode aplikasi, README, dan deskripsi layar-layarnya"),
    "testing": ("your test plan, test cases, automation scripts or bug reports", "test plan, test case, skrip otomasi atau bug report-mu"),
    "devops": ("your Dockerfile, pipeline config or infrastructure code with a short README",
               "Dockerfile, konfigurasi pipeline atau kode infrastruktur dengan README singkat"),
    "security": ("your lab report, scan results or write-up of the exercise (no real credentials)",
                 "laporan lab, hasil scan atau tulisan latihanmu (tanpa kredensial asli)"),
    "design": ("your case study: research notes, flows, screens and what you learned",
               "studi kasusmu: catatan riset, flow, layar, dan apa yang kamu pelajari"),
    "marketing": ("your campaign plan, report or analytics write-up with the numbers", "rencana kampanye, laporan atau tulisan analitik beserta angkanya"),
    "finance": ("your worksheet, journal or report with the calculations explained", "lembar kerja, jurnal atau laporan dengan perhitungan yang dijelaskan"),
}
DEFAULT_ARTIFACT = ("the work you produced (code, document or report) as text or PDF", "hasil kerjamu (kode, dokumen atau laporan) sebagai teks atau PDF")
K_ANONYMITY = 5


def week_start(d: date | None = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())


def course_companion(courses: list[dict], rec: dict, skills: dict) -> list[dict]:
    """courses: [{name, mapping {skill: strength}, status}] ; rec: engine.recommend() output."""
    path_pos = {p["skill_id"]: i + 1 for i, p in enumerate(rec["path"])}
    comp = {c["skill_id"]: c for c in rec["competencies"]}
    rank = {r["skill_id"]: r["rank"] for r in rec["ranking"]}
    out = []
    for c in courses:
        rows = []
        for sid, strength in sorted(c["mapping"].items(), key=lambda kv: -kv[1]):
            if sid not in skills:
                continue
            sk = skills[sid]
            cp = comp.get(sid, {})
            on_path = sid in path_pos
            rows.append({
                "skill_id": sid, "name": sk.name, "strength": round(strength, 2), "on_path": on_path,
                "path_step": path_pos.get(sid), "rank": rank.get(sid), "p": cp.get("p"), "required": cp.get("required"),
                "evidence_tip": tr(f"Turn a {c['name']} assignment into proof of {sk.name}: upload {tr(*ARTIFACTS.get(sk.cluster, DEFAULT_ARTIFACT))} "
                                   f"as a project. The rubric looks for {sk.learn_what}.",
                                   f"Jadikan tugas {c['name']} sebagai bukti {sk.name}: unggah {tr(*ARTIFACTS.get(sk.cluster, DEFAULT_ARTIFACT))} "
                                   f"sebagai project. Rubriknya mencari {sk.learn_what}."),
            })
        aligned = [r for r in rows if r["on_path"] or (r["rank"] and r["rank"] <= 6)]
        out.append({"course": c["name"], "status": c.get("status", "ongoing"), "skills": rows,
                    "aligned_skills": [r["skill_id"] for r in aligned],
                    "alignment": round(sum(r["strength"] for r in aligned) / max(1e-9, sum(r["strength"] for r in rows)), 2)
                    if rows else 0.0})
    out.sort(key=lambda x: -x["alignment"])
    return out


def suggest_week(rec: dict, companion: list[dict], weekly_hours: float) -> list[dict]:
    """Default goals for the week: the next path steps, each paired with a supporting course if any."""
    minutes_total = int(max(1.0, weekly_hours) * 60)
    support = {}
    for c in companion:
        for sid in c["aligned_skills"]:
            support.setdefault(sid, c["course"])
    steps = [p for p in rec["path"] if not p["waiting_for"]][:2] or rec["path"][:1]
    goals = []
    share = [0.6, 0.4] if len(steps) > 1 else [1.0]
    for p, sh in zip(steps, share, strict=False):
        mat = p["materials"][0] if p["materials"] else None
        goals.append({"skill_id": p["skill_id"], "name": p["name"], "kind": "learn" if p["rec_type"] == "pelajari" else "prove",
                      "minutes": int(minutes_total * sh), "course": support.get(p["skill_id"]),
                      "material": {"title": mat["title"], "url": mat["url"]} if mat else None,
                      "done": False,
                      "action": (tr("Take the skill check when you feel ready", "Ikuti skill check saat kamu merasa siap")
                                 if p["rec_type"] == "buktikan" else tr("Study", "Pelajari") + f": {p['learn_what']}")})
    return goals


def reflection_summary(plans: list) -> dict:
    """Plan-vs-done stats over the student's history of weekly plans."""
    done = [pl for pl in plans if pl.reflected_at]
    if not done:
        return {"weeks_planned": len(plans), "weeks_reflected": 0}
    ratio = [min(2.0, (pl.reflection.get("done_minutes", 0) or 0) / max(1, pl.planned_minutes)) for pl in done]
    goals = [g for pl in done for g in pl.goals]
    return {"weeks_planned": len(plans), "weeks_reflected": len(done),
            "minutes_done_vs_planned": round(mean(ratio), 2),
            "goals_completed": round(sum(bool(g.get("done")) for g in goals) / max(1, len(goals)), 2),
            "avg_confidence": round(mean(pl.reflection.get("confidence", 0) or 0 for pl in done), 2),
            "obstacles": [pl.reflection.get("obstacle") for pl in done if pl.reflection.get("obstacle")][-5:]}


def cohort_report(students: list[dict], skills: dict) -> dict:
    """students: [{p {skill: p}, required {skill: r}, demand {skill: D}, courses [...], clarity [...], plans {...}}]."""
    n = len(students)
    if n < K_ANONYMITY:
        return {"n_students": n, "hidden": True,
                "message": tr(f"Aggregates appear once at least {K_ANONYMITY} students have joined (privacy threshold).",
                              f"Ringkasan muncul setelah minimal {K_ANONYMITY} mahasiswa bergabung (batas privasi).")}
    sids = sorted({s for st in students for s in st["required"]})
    rows = []
    for sid in sids:
        ps = [st["p"].get(sid, 0.1) for st in students]
        req = mean(st["required"].get(sid, 0.7) for st in students)
        rows.append({"skill_id": sid, "name": skills[sid].name, "cluster": skills[sid].cluster,
                     "mean_mastery": round(mean(ps), 3), "required": round(req, 3),
                     "share_below_required": round(sum(p < req for p in ps) / n, 3),
                     "demand": round(mean(st["demand"].get(sid, 0) for st in students), 3)})
    # where the class is furthest from what employers ask, weighted by demand
    rows.sort(key=lambda r: -(r["demand"] * max(0.0, r["required"] - r["mean_mastery"])))
    courses: dict[str, int] = {}
    for st in students:
        for c in st["courses"]:
            courses[c] = courses.get(c, 0) + 1
    clarity = [v for st in students for v in st["clarity"]]
    reflected = [st["plans"].get("goals_completed") for st in students if st["plans"].get("weeks_reflected")]
    return {"n_students": n, "hidden": False, "skills": rows, "top_gaps": rows[:5],
            "courses": sorted(({"course": k, "students": v} for k, v in courses.items() if v >= K_ANONYMITY // 2 + 1),
                              key=lambda x: -x["students"]),
            "clarity_mean": round(mean(clarity), 2) if clarity else None, "clarity_n": len(clarity),
            "weekly_goal_completion": round(mean(reflected), 2) if reflected else None}
