"""Offline Excel sheet for one expert (plan AI-07 / M6): validate the prerequisite links of a role and rate how
relevant the role's most-demanded skills are. Same data the Experts page shows, for experts who prefer a file.

    python -m pipeline.expert_sheet sheet <name> [--role business_analyst]   # -> data/processed/pakar_<name>.xlsx
    python -m pipeline.expert_sheet import <xlsx> --name "<nama>" --affiliation "<instansi>" --kind dosen|praktisi

Sheet "Prasyarat": one row per link (matched on the two skill ids, not on database ids) "A must come before B" that leads into a skill of the role. The expert picks
Setuju / Tidak setuju / Ragu. Setuju and Tidak setuju become votes exactly like the Experts page (2 of 3 experts
approve a link). Ragu is not counted. Sheet "Usulan prasyarat" collects missing links (added as draft links if they
create no loop). Sheet "Relevansi skill" asks how important each of the role's top skills is for a junior hire
(Wajib / Penting / Pelengkap / Tidak relevan); results go to data/models/expert_skill_relevance.json and give the
precision of the market map's top skills as judged by an expert (proposal III.D, level 3).
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime

from sqlalchemy import select

from pathsync.config import MODELS_DIR, PROCESSED_DIR, ROLES, SEED_DIR
from pathsync.db import EdgeVote, Expert, GraphEdge, SessionLocal, bump_epoch, init_db
from pathsync.market import load_market
from pathsync.roles import skill_ids_for_role
from pathsync.taxonomy import CycleError, Edge, SkillGraph, load_skills

DECISIONS = {"Setuju": True, "Tidak setuju": False, "Ragu": None}
RELEVANCE = ("Wajib", "Penting", "Pelengkap", "Tidak relevan")
TOP_SKILLS = 20
RELEVANCE_FILE = MODELS_DIR / "expert_skill_relevance.json"
GUIDE = [
    "Terima kasih sudah membantu. Ada tiga lembar, total sekitar 60-90 menit. Isi hanya kolom kuning.",
    "1) Prasyarat: setiap baris berbunyi 'skill A sebaiknya dikuasai sebelum skill B'. Pilih Setuju, Tidak setuju, atau Ragu.",
    "   Setuju bila mahasiswa akan kesulitan mempelajari B tanpa A. Tidak setuju bila urutan itu tidak perlu atau terbalik.",
    "   Kolom 'alasan sistem' adalah alasan yang ditulis tim; boleh diabaikan bila tidak setuju. Komentar singkat sangat membantu.",
    "2) Usulan prasyarat: tulis pasangan prasyarat yang menurut Anda penting tetapi belum ada (pakai id dari lembar Daftar skill).",
    "3) Relevansi skill: untuk lulusan baru di peran ini, seberapa penting skill tersebut? Wajib, Penting, Pelengkap, atau Tidak relevan.",
    "Kerjakan sendiri tanpa melihat jawaban pakar lain. Kirim berkas kembali tanpa mengubah kolom id.",
]


def _role_edges(s, role: str) -> list[GraphEdge]:
    from pathsync.engine import ensure_seed

    ensure_seed(s)                      # links are seeded on first app start; a fresh database may not have them yet
    scope = set(skill_ids_for_role(role, load_skills()))
    return [e for e in s.scalars(select(GraphEdge).order_by(GraphEdge.id)).all()
            if e.dst in scope and e.status != "rejected"]


def cmd_sheet(name: str, role: str) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation

    skills = load_skills()
    head_font, head_fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1F3A5F")
    todo = PatternFill("solid", fgColor="FFF5CC")
    with SessionLocal() as s:
        edges = _role_edges(s, role)
        market, _req, version = load_market(s, role)
    wb = Workbook()
    guide = wb.active
    guide.title = "Petunjuk"
    for line in [f"Validasi pakar untuk peran {ROLES[role]['name']}, pakar: {name}", *GUIDE]:
        guide.append([line])
    guide["A1"].font = Font(bold=True, size=13)
    guide.column_dimensions["A"].width = 150

    ws = wb.create_sheet("Prasyarat")
    if not edges:
        raise SystemExit(f"no prerequisite links lead into {role}")
    # links are matched on (skill A id, skill B id) at import, so the sheet works against any copy of the database
    ws.append(["no", "skill A (dikuasai dulu)", "skill B (sesudahnya)", "alasan sistem", "keputusan", "komentar",
               "id A", "id B"])
    seed_why = {(x["from"], x["to"]): x.get("rationale") for x in json.loads((SEED_DIR / "graph.json").read_text(encoding="utf-8"))["edges"]}
    for i, e in enumerate(edges, 1):
        why = seed_why.get((e.src, e.dst)) or e.rationale     # Indonesian original for Indonesian experts
        ws.append([i, skills[e.src].name, skills[e.dst].name, why, "", "", e.src, e.dst])
    dv = DataValidation(type="list", formula1='"' + ",".join(DECISIONS) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"E2:E{len(edges) + 1}")
    for col, w in zip("ABCDEFGH", (5, 34, 34, 70, 16, 40, 24, 24), strict=True):
        ws.column_dimensions[col].width = w

    prop = wb.create_sheet("Usulan prasyarat")
    prop.append(["id skill A (dikuasai dulu)", "id skill B (sesudahnya)", "alasan"])
    for _ in range(15):
        prop.append(["", "", ""])
    for col, w in zip("ABC", (34, 34, 70), strict=True):
        prop.column_dimensions[col].width = w

    rel = wb.create_sheet("Relevansi skill")
    rel.append(["no", "id", "skill", "diminta di lowongan", "relevansi untuk lulusan baru", "komentar"])
    top = sorted(skill_ids_for_role(role, skills), key=lambda k: -market.D(k))[:TOP_SKILLS]
    for i, sid in enumerate(top, 1):
        rel.append([i, sid, skills[sid].name, f"{market.D(sid):.0%}", "", ""])
    dv2 = DataValidation(type="list", formula1='"' + ",".join(RELEVANCE) + '"', allow_blank=True)
    rel.add_data_validation(dv2)
    dv2.add(f"E2:E{len(top) + 1}")
    for col, w in zip("ABCDEF", (5, 28, 36, 18, 26, 40), strict=True):
        rel.column_dimensions[col].width = w

    sk = wb.create_sheet("Daftar skill")
    sk.append(["id", "nama", "klaster"])
    for sid, skill in sorted(skills.items(), key=lambda kv: (kv[1].cluster, kv[0])):
        sk.append([sid, skill.name, skill.cluster])
    for col, w in zip("ABC", (30, 40, 18), strict=True):
        sk.column_dimensions[col].width = w

    for sheet, yellow in ((ws, (4, 5)), (prop, (0, 1, 2)), (rel, (4, 5))):
        for c in sheet[1]:
            c.font, c.fill = head_font, head_fill
        for row in sheet.iter_rows(min_row=2):
            for j, c in enumerate(row):
                c.alignment = Alignment(wrap_text=True, vertical="top")
                if j in yellow:
                    c.fill = todo
        sheet.freeze_panes = "B2"
    out = PROCESSED_DIR / f"pakar_{name}.xlsx"
    wb.save(out)
    print(f"{len(edges)} links, {len(top)} skills (market {version}) -> {out}")


def cmd_import(path: str, name: str, affiliation: str, kind: str, role: str) -> None:
    from openpyxl import load_workbook

    if kind not in ("dosen", "praktisi", "tim"):
        raise SystemExit("--kind must be dosen, praktisi or tim (internal team review; never counts as expert validation)")
    skills = load_skills()
    wb = load_workbook(path, read_only=True)
    votes, bad = {}, []
    for row in wb["Prasyarat"].iter_rows(min_row=2, values_only=True):
        decision, comment, src, dst = (row[4] or "").strip(), (row[5] or "").strip(), row[6], row[7]
        if not src or not decision:
            continue
        if decision not in DECISIONS:
            bad.append(f"Prasyarat {src} -> {dst}: '{decision}'")
            continue
        if DECISIONS[decision] is not None:
            votes[(src, dst)] = (DECISIONS[decision], comment[:500])
    proposals = []
    for a, b, why in wb["Usulan prasyarat"].iter_rows(min_row=2, values_only=True):
        a, b = (a or "").strip(), (b or "").strip()
        if not a and not b:
            continue
        if a not in skills or b not in skills or a == b:
            bad.append(f"Usulan '{a}' -> '{b}': id tidak dikenal")
            continue
        proposals.append((a, b, (why or "").strip()[:500]))
    relevance = {}
    for row in wb["Relevansi skill"].iter_rows(min_row=2, values_only=True):
        sid, level, comment = row[1], (row[4] or "").strip(), (row[5] or "").strip()
        if sid and level:
            if level not in RELEVANCE:
                bad.append(f"Relevansi {sid}: '{level}'")
                continue
            relevance[sid] = {"level": level, "comment": comment[:500]}
    if bad:
        raise SystemExit("fix the sheet, nothing was imported:\n" + "\n".join(bad[:15]))

    with SessionLocal() as s:
        expert = s.scalars(select(Expert).where(Expert.name == name, Expert.kind == kind)).first()
        if expert is None:
            expert = Expert(name=name, affiliation=affiliation, kind=kind, validates_graph=True)
            s.add(expert)
            s.flush()
        from pathsync.engine import ensure_seed

        ensure_seed(s)
        by_pair = {(e.src, e.dst): e.id for e in s.scalars(select(GraphEdge)).all()}
        missing = [f"{a} -> {b}" for a, b in votes if (a, b) not in by_pair]
        if missing:
            raise SystemExit("links not in this database (nothing imported): " + ", ".join(missing[:10]))
        for pair, (approve, comment) in votes.items():
            eid = by_pair[pair]
            old = s.scalars(select(EdgeVote).where(EdgeVote.edge_id == eid, EdgeVote.expert_id == expert.id)).first()
            if old:
                old.approve, old.comment = approve, comment
            else:
                s.add(EdgeVote(edge_id=eid, expert_id=expert.id, approve=approve, comment=comment))
        added, loops = 0, []
        for a, b, why in proposals:
            current = [Edge(r.src, r.dst) for r in s.scalars(select(GraphEdge)).all()]
            if any(e.src == a and e.dst == b for e in current):
                continue
            try:
                SkillGraph(skills, current + [Edge(a, b)])
            except CycleError:
                loops.append(f"{a} -> {b}")
                continue
            s.add(GraphEdge(src=a, dst=b, source="pakar", rationale=why, status="draft"))
            s.flush()
            added += 1
        if added:
            bump_epoch(s)
        s.commit()
        expert_id = expert.id

    doc = json.loads(RELEVANCE_FILE.read_text(encoding="utf-8")) if RELEVANCE_FILE.exists() else {"experts": {}}
    doc["experts"][expert_id] = {"name": name, "kind": kind, "affiliation": affiliation, "role": role,
                                 "imported_at": datetime.now().isoformat(timespec="seconds"), "skills": relevance}
    top_ok = [v["level"] in ("Wajib", "Penting") for v in relevance.values()]
    doc["experts"][expert_id]["precision_top_skills"] = round(sum(top_ok) / len(top_ok), 3) if top_ok else None
    RELEVANCE_FILE.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name} ({kind}): {len(votes)} votes, {added} new links, {len(loops)} rejected for loops {loops}, "
          f"{len(relevance)} relevance ratings -> {RELEVANCE_FILE.name}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["sheet", "import"])
    ap.add_argument("arg", help="expert name (sheet) or path to the filled .xlsx (import)")
    ap.add_argument("--role", default="business_analyst", choices=sorted(ROLES))
    ap.add_argument("--name")
    ap.add_argument("--affiliation", default="")
    ap.add_argument("--kind", default="dosen")
    a = ap.parse_args()
    init_db()
    if a.cmd == "sheet":
        cmd_sheet(a.arg, a.role)
    else:
        if not a.name:
            raise SystemExit("--name is required for import")
        cmd_import(a.arg, a.name, a.affiliation, a.kind, a.role)


if __name__ == "__main__":
    main()
