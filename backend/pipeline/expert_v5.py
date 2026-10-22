"""V5: second expert questionnaire (diagnosis validity, ranking agreement, learning content, learning-loop rules).

    python -m pipeline.expert_v5 build                 # writes docs/validasi/V5_VALIDASI_PAKAR.md + the hidden key
    python -m pipeline.expert_v5 score a.md b.md c.md  # filled copies -> data/models/expert_v5_results.json

The key (PathSync's own answers) is written to data/seed/_validasi/V5_kunci.json and is never shown to experts.
Diagnosis profiles go through pathsync.evidence.diagnose; ranking scenarios come from pathsync.scenarios with the
expert-approved graph, so the comparison is against what the app would really output.
"""
import json
import random
import re
import sys
from datetime import date
from pathlib import Path

from pathsync.config import EVIDENCE_WEIGHTS, GRADE_SCORES, MODELS_DIR, RUBRIC_SCORES, SEED_DIR
from pathsync.evidence import EvidenceItem, Response, diagnose
from pathsync.ranker import aggregate_orders, kendalls_w, ndcg_at_k
from pathsync.taxonomy import load_skills

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / "docs" / "validasi" / "V5_VALIDASI_PAKAR.md"
KEY = SEED_DIR / "_validasi" / "V5_kunci.json"
DIAG_SKILLS = ["requirements_elicitation", "requirements_documentation", "business_process_modeling", "sql",
               "testing_uat", "system_modeling_uml"]
N_PROFILES, N_BASE = 8, 8
CERT_LEVEL = 0.6          # "kursus" level in data/seed/certificates.json
LEVELS = ["1 belum bisa", "2 dasar", "3 cukup", "4 mandiri", "5 mahir"]
RUBRIC_WORD = {1: "dasar", 2: "mandiri", 3: "mahir"}
TIER = {"basic": "dasar", "applied": "terapan", "transfer": "transfer"}


# ------------------------------------------------------------------ build
def make_profiles(rng: random.Random) -> list[dict]:
    """Each profile: 4 skills, each with a random mix of evidence (sometimes conflicting) -> PathSync p."""
    grades = ["A", "A-", "B+", "B", "B-", "C"]
    out = []
    for i in range(N_PROFILES):
        skills = rng.sample(DIAG_SKILLS, 4)
        rows = []
        for s in skills:
            ev: dict = {}
            if rng.random() < 0.8:
                ev["grade"] = rng.choice(grades)
                ev["strength"] = rng.choice([0.5, 0.75, 1.0])
            if rng.random() < 0.35:
                ev["certificate"] = True
            if rng.random() < 0.45:
                ev["project"] = rng.choice([1, 2, 2, 3])
            if rng.random() < 0.6:
                n = rng.choice([3, 4, 5])
                ev["qc"] = (rng.randint(0, n), n)
            if not ev:
                ev["grade"], ev["strength"] = "B", 0.75
            rows.append({"skill_id": s, "evidence": ev})
        evidence, responses = [], []
        for r in rows:
            s, ev = r["skill_id"], r["evidence"]
            if "grade" in ev:
                evidence.append(EvidenceItem("academic", "Transkrip", {s: GRADE_SCORES[ev["grade"]] * ev["strength"]},
                                             {s: ev["strength"]}))
            if ev.get("certificate"):
                evidence.append(EvidenceItem("certificate", "Sertifikat", {s: CERT_LEVEL}, {s: 1.0}))
            if "project" in ev:
                evidence.append(EvidenceItem("project", "Proyek", {s: RUBRIC_SCORES[ev["project"]]}, {s: 1.0}))
            if "qc" in ev:
                k, n = ev["qc"]
                responses += [Response(s, j < k, "diagnostic") for j in range(n)]
        states = diagnose([r["skill_id"] for r in rows], evidence, responses, weights=EVIDENCE_WEIGHTS)
        for r in rows:
            r["p"] = round(states[r["skill_id"]].p, 4)
        out.append({"id": f"P{i + 1}", "rows": rows})
    return out


def evidence_text(ev: dict, names: dict) -> str:
    parts = []
    if "grade" in ev:
        cover = {0.5: "sebagian kecil", 0.75: "sebagian besar", 1.0: "seluruhnya"}[ev["strength"]]
        parts.append(f"nilai mata kuliah terkait **{ev['grade']}** (mata kuliah mencakup {cover} skill ini)")
    if ev.get("certificate"):
        parts.append("sertifikat kursus daring selesai")
    if "project" in ev:
        parts.append(f"proyek dengan rubrik **{RUBRIC_WORD[ev['project']]}** (berkutipan dari karya)")
    if "qc" in ev:
        parts.append(f"Quick Check **{ev['qc'][0]} dari {ev['qc'][1]}** benar")
    return "; ".join(parts)


def build_scenarios_now() -> list[dict]:
    from pathsync.db import get_session, init_db
    from pathsync.engine import load_context
    from pathsync.scenarios import build_scenarios

    init_db()
    with get_session() as s:
        ctx = load_context(s, "business_analyst")
        scn = build_scenarios(ctx.graph, ctx.market, ctx.req, n_base=15, seed=7, role="business_analyst")
    keep = [x for x in scn if x["variant"] in ("base", "competency")]
    bases = sorted({x["base_id"] for x in keep})[:N_BASE]
    return [x for x in keep if x["base_id"] in bases]


def orders(sc: dict) -> dict[str, list[str]]:
    f = sc["features"]
    by = lambda key: sorted(sc["candidates"], key=lambda c: -key(f[c]))
    return {"pathsync_formula5": by(lambda x: x["G"] * x["D"] * x["T"] * x["U"] * x["R"]),
            "biggest_gap": by(lambda x: x["G"]),
            "gap_x_demand": by(lambda x: x["G"] * x["D"])}


def build() -> None:
    rng = random.Random(5)
    names = {k: v.name_id or v.name for k, v in load_skills("id").items()}
    profiles = make_profiles(rng)
    scenarios = build_scenarios_now()
    key = {"generated": date.today().isoformat(),
           "note": "PathSync answers for V5. Do not share with experts before they finish.",
           "diagnosis": {f"{p['id']}-{j + 1}": {"skill_id": r["skill_id"], "p": r["p"]}
                         for p in profiles for j, r in enumerate(p["rows"])},
           "ranking": {sc["id"]: {"candidates": sc["candidates"], **orders(sc)} for sc in scenarios}}
    KEY.write_text(json.dumps(key, indent=1, ensure_ascii=False), encoding="utf-8")

    L = []
    w = L.append
    w("# Kuesioner Validasi Pakar Lanjutan PathSync (V5)\n")
    w("Terima kasih atas kesediaan Bapak/Ibu. Kuesioner ini melanjutkan validasi sebelumnya (prasyarat dan relevansi "
      "skill). Kali ini kami meminta penilaian Bapak/Ibu atas **keputusan yang dibuat PathSync**, tanpa melihat jawaban "
      "PathSync, agar kami bisa mengukur seberapa sesuai sistem dengan penilaian ahli.\n")
    w("**Waktu:** sekitar 60 sampai 75 menit, boleh dicicil. **Cara mengisi:** tulis jawaban pada kolom bertanda "
      "`[ ]` atau kolom *Jawaban*. Jangan mengubah kode di kolom pertama (misalnya `P3-2` atau `S04-base`). "
      "Kerjakan sendiri tanpa berdiskusi dengan pakar lain.\n")
    w("| Bagian | Isi | Perkiraan waktu | Siapa yang mengisi |\n|---|---|---|---|")
    w("| A | Menilai kemampuan 8 mahasiswa contoh dari buktinya | 20 menit | Pakar BA |")
    w("| B | Mengurutkan skill yang sebaiknya dipelajari lebih dahulu pada 16 skenario | 30 menit | Pakar BA |")
    w("| C | Menilai mutu 12 soal latihan dan Quick Check | 15 menit | Pakar BA, idealnya juga dosen pendidikan/asesmen |")
    w("| D | Menilai aturan *learning loop* | 5 menit | Pakar BA atau dosen pendidikan |")
    w("| E | Identitas dan persetujuan | 2 menit | Semua |\n")
    w("Konteks singkat: PathSync menyusun rute belajar mahasiswa untuk peran *Business Analyst* (BA) dari lowongan "
      "kerja Indonesia dan bukti kemampuan mahasiswa (nilai kuliah, sertifikat, proyek, dan Quick Check, yaitu kuis "
      "singkat 3 sampai 5 soal per skill).\n\n---\n")

    w("## Bagian A. Menilai kemampuan dari bukti\n")
    w("Untuk setiap baris, bayangkan Bapak/Ibu melihat bukti tersebut pada seorang lulusan baru. Seberapa mampu ia "
      "pada skill itu? Pilih satu angka: **1 belum bisa, 2 dasar, 3 cukup, 4 mandiri, 5 mahir.** Penilaian diri dan "
      "klaim CV sengaja tidak ditampilkan.\n")
    for p in profiles:
        w(f"### Mahasiswa {p['id']}\n")
        w("| Kode | Skill | Bukti yang tersedia | Jawaban (1-5) |\n|---|---|---|---|")
        for j, r in enumerate(p["rows"]):
            w(f"| {p['id']}-{j + 1} | {names[r['skill_id']]} | {evidence_text(r['evidence'], names)} | [ ] |")
        w("")
    w("---\n")

    w("## Bagian B. Urutan belajar\n")
    w("Setiap skenario berisi satu mahasiswa contoh dan 8 skill kandidat untuk peran BA. Tuliskan **5 skill yang "
      "sebaiknya dipelajari lebih dahulu, berurutan (1 = paling dahulu)**, memakai nomor kandidat. Pertimbangkan "
      "kesenjangan, permintaan lowongan, dan prasyarat. Skenario berlabel *setelah belajar* adalah mahasiswa yang "
      "sama setelah menguasai satu skill; silakan bandingkan dengan skenario dasarnya.\n")
    w("Keterangan kolom: *Penguasaan* = perkiraan kemampuan sekarang (0-100%); *Dibutuhkan* = level yang diminta "
      "peran; *Diminta lowongan* = persentase lowongan BA yang meminta skill ini; *Prasyarat belum dikuasai* dan "
      "*Membuka* diambil dari graf prasyarat yang sudah divalidasi pakar.\n")
    labels = {"Management student, semester 5": "Mahasiswa Manajemen, semester 5",
              "Information Systems student, semester 7": "Mahasiswa Sistem Informasi, semester 7",
              "Accounting student, semester 6": "Mahasiswa Akuntansi, semester 6",
              "Computer Science student, semester 7": "Mahasiswa Ilmu Komputer, semester 7",
              "Data analytics bootcamp graduate": "Lulusan bootcamp analitik data"}
    for sc in scenarios:
        title = next((v for k, v in labels.items() if sc["title"].startswith(k.split(",")[0])), sc["title"].split(",")[0])
        if sc["variant"] == "competency":
            ch = sc["changed"]
            title += (f" (setelah belajar {names[ch['skill_id']]}: {round(100 * ch['p_from'])}% menjadi "
                      f"{round(100 * ch['p_to'])}%)")
        w(f"### {sc['id']}: {title}\n")
        w("| No | Skill | Penguasaan | Dibutuhkan | Diminta lowongan | Prasyarat belum dikuasai | Membuka |\n"
          "|---|---|---|---|---|---|---|")
        for n, c in enumerate(sc["candidates"], 1):
            stt = sc["student"][c]
            pre = [names[x] for x in sc["blocked_by"].get(c, [])]
            unl = [names[x] for x in sc["unlocks"].get(c, [])][:3]
            w(f"| {n} | {names[c]} | {round(100 * stt['p'])}% | {round(100 * stt['r'])}% | "
              f"{round(100 * sc['market'][c]['D'])}% | {', '.join(pre) or '-'} | {', '.join(unl) or '-'} |")
        w(f"\n**{sc['id']} jawaban (5 nomor berurutan):** [ ]  \n**Alasan singkat (opsional):**\n")
    w("---\n")

    w("## Bagian C. Mutu soal\n")
    w("Kunci jawaban ditandai **(kunci)**. Untuk setiap soal, isi: *Kunci benar?* (Ya/Tidak), *Jelas?* (1-5), "
      "*Level* (terlalu mudah / pas untuk lulusan baru / terlalu sulit), dan catatan bila ada.\n")
    practice = json.loads((SEED_DIR / "practice" / "business_analyst.json").read_text(encoding="utf-8"))["skills"]
    qn = 0
    for sid in ["requirements_elicitation", "requirements_documentation", "business_process_modeling"]:
        tasks = [t for t in practice[sid]["tasks"] if t["type"] == "choice"][:2]
        for t in tasks:
            qn += 1
            ctxt = t.get("context", {}).get("id", "")
            w(f"**C{qn}. Latihan ({names[sid]}, tingkat {TIER[t['tier']]})** {ctxt} {t['stem']['id']}\n")
            for o in t["options"]:
                w(f"- {o['text']['id']}{' **(kunci)**' if o['correct'] else ''}")
            w("")
    bank = []
    for f in ["business_process.json", "data_analytics.json"]:
        bank += json.loads((SEED_DIR / "items" / f).read_text(encoding="utf-8"))
    picks = [it for it in bank if it["skill_id"] in ("requirements_documentation", "testing_uat", "sql", "sdlc",
                                                      "system_modeling_uml", "requirements_elicitation")]
    random.Random(9).shuffle(picks)
    for it in picks[:6]:
        qn += 1
        w(f"**C{qn}. Quick Check ({names[it['skill_id']]})** {it['stem']}\n")
        for k, o in enumerate(it["options"]):
            w(f"- {o}{' **(kunci)**' if k == 0 else ''}")
        w("")
    w("| Soal | Kunci benar? | Jelas? (1-5) | Level | Catatan |\n|---|---|---|---|---|")
    for k in range(1, qn + 1):
        w(f"| C{k} | [ ] | [ ] | [ ] | |")
    w("\n---\n")

    w("## Bagian D. Aturan learning loop\n")
    w("Setiap skill di rute punya tiga tahap: **Pelajari** (materi), **Latihan** (soal bertingkat dengan umpan balik "
      "di setiap pilihan; tidak mengubah skor), dan **Buktikan** (Quick Check; satu-satunya yang mengubah skor). "
      "Nyatakan Setuju / Tidak setuju / Ragu untuk setiap aturan.\n")
    w("| Kode | Aturan | Jawaban | Alasan bila tidak setuju |\n|---|---|---|---|")
    rules = ["Latihan tidak boleh menaikkan skor penguasaan; hanya Quick Check yang boleh.",
             "Nilai kuliah setinggi apa pun tidak membuat skill berstatus terbukti tanpa Quick Check.",
             "Satu tingkat latihan dianggap lulus bila minimal 2 dari 3 soal benar.",
             "Bila Quick Check gagal, mahasiswa harus berlatih lagi sebelum boleh mencoba Quick Check berikutnya.",
             "Bila ada prasyarat yang belum dikuasai, mahasiswa diarahkan ke prasyarat itu lebih dahulu.",
             "Setelah terbukti, mahasiswa masih mengerjakan soal transfer (kasus dari konteks lain) sebelum dinyatakan dikuasai.",
             "Bobot bukti: Quick Check 0,50 > proyek 0,30 > sertifikat 0,25 > nilai kuliah 0,20."]
    for k, r in enumerate(rules, 1):
        w(f"| D{k} | {r} | [ ] | |")
    w("\n**D8.** Menurut Bapak/Ibu, bukti apa yang paling meyakinkan bahwa lulusan baru benar-benar menguasai suatu skill BA? [ ]\n")
    w("---\n")
    w("## Bagian E. Identitas dan persetujuan\n")
    w("| Pertanyaan | Jawaban |\n|---|---|\n| Nama (boleh dirahasiakan di karya ilmiah) | [ ] |\n"
      "| Instansi dan jabatan | [ ] |\n| Pengalaman di bidang BA atau pengajaran (tahun) | [ ] |\n"
      "| Jenis (dosen / praktisi) | [ ] |\n| Bersedia disebut sebagai validator? (Ya, dengan nama / Ya, anonim / Tidak) | [ ] |\n")
    w("Terima kasih. Mohon kirim kembali berkas ini dengan nama `V5_<nama>.md`.")
    MD.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {MD} ({len(profiles)} profiles, {len(scenarios)} scenarios, {qn} items) and {KEY}")


# ------------------------------------------------------------------ score
def parse(path: str, key: dict) -> dict:
    t = Path(path).read_text(encoding="utf-8")
    diag = {}
    for code in key["diagnosis"]:
        m = re.search(rf"^\|\s*{re.escape(code)}\s*\|.*\|\s*\[?\s*([1-5])\s*\]?\s*\|\s*$", t, re.M)
        if m:
            diag[code] = int(m.group(1))
    rank = {}
    for sid, k in key["ranking"].items():
        m = re.search(rf"\*\*{re.escape(sid)} jawaban[^*]*\*\*\s*\[?([0-9 ,;.-]+)\]?", t)
        if m:
            nums = [int(x) for x in re.findall(r"\d+", m.group(1))]
            rank[sid] = [k["candidates"][n - 1] for n in nums if 1 <= n <= len(k["candidates"])]
    return {"diagnosis": diag, "ranking": rank}


def spearman(a: list[float], b: list[float]) -> float:
    from scipy.stats import spearmanr

    return float(spearmanr(a, b).statistic)


def score(paths: list[str]) -> dict:
    key = json.loads(KEY.read_text(encoding="utf-8"))
    experts = {Path(p).stem: parse(p, key) for p in paths}
    out = {"n_experts": len(experts), "diagnosis": {}, "ranking": {}}
    for name, e in experts.items():
        codes = [c for c in e["diagnosis"] if c in key["diagnosis"]]
        if len(codes) >= 5:
            out["diagnosis"][name] = {"n": len(codes), "spearman": round(spearman(
                [e["diagnosis"][c] for c in codes], [key["diagnosis"][c]["p"] for c in codes]), 3)}
    common = [s for s in key["ranking"] if all(s in e["ranking"] and e["ranking"][s] for e in experts.values())]
    methods = ["pathsync_formula5", "biggest_gap", "gap_x_demand"]
    res = {m: [] for m in methods}
    ws = []
    for s in common:
        cands = key["ranking"][s]["candidates"]
        # experts name their top 5; the unnamed candidates follow in listed order so every order is complete
        orders_ = [list(dict.fromkeys(e["ranking"][s] + cands)) for e in experts.values()]
        consensus = aggregate_orders(orders_) if len(orders_) > 1 else orders_[0]
        if len(orders_) > 1:
            ws.append(kendalls_w(orders_))
        for m in methods:
            res[m].append(ndcg_at_k(key["ranking"][s][m], consensus, k=5))
    out["ranking"] = {"n_scenarios": len(common),
                      "ndcg5": {m: round(sum(v) / len(v), 4) if v else None for m, v in res.items()},
                      "kendalls_w_mean": round(sum(ws) / len(ws), 3) if ws else None}
    (MODELS_DIR / "expert_v5_results.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


def rescore(paths: list[str]) -> dict:
    """Diagnosis agreement for the current engine: the same 8 profiles (same seed) and the same expert answers, with p
    recomputed by today's pathsync.evidence.diagnose. Keeps the frozen key's result next to it (audit COMP-01)."""
    key = json.loads(KEY.read_text(encoding="utf-8"))
    profiles = make_profiles(random.Random(5))
    now = {f"{pr['id']}-{j + 1}": r for pr in profiles for j, r in enumerate(pr["rows"])}
    assert all(now[c]["skill_id"] == v["skill_id"] for c, v in key["diagnosis"].items()), "profiles changed"
    out = json.loads((MODELS_DIR / "expert_v5_results.json").read_text(encoding="utf-8"))
    out["diagnosis_current_engine"] = {}
    for p in paths:
        e = parse(p, key)
        codes = [c for c in e["diagnosis"] if c in key["diagnosis"]]
        changed = sum(abs(now[c]["p"] - key["diagnosis"][c]["p"]) > 1e-4 for c in codes)
        out["diagnosis_current_engine"][Path(p).stem] = {
            "n": len(codes), "spearman": round(spearman([e["diagnosis"][c] for c in codes], [now[c]["p"] for c in codes]), 3),
            "n_ratings_with_new_p": changed, "generated": date.today().isoformat()}
        # NDCG@5 difference to the nearest baseline, with a bootstrap over the 8 base profiles (the two scenarios
        # built from one profile are not independent; audit EVAL-02)
        per = []
        for s, k in key["ranking"].items():
            if e["ranking"].get(s):
                ref = list(dict.fromkeys(e["ranking"][s] + k["candidates"]))
                per.append((s.split("-")[0], ndcg_at_k(k["pathsync_formula5"], ref, k=5), ndcg_at_k(k["gap_x_demand"], ref, k=5)))
        bases = sorted({b for b, _, _ in per})
        rng = random.Random(0)
        diffs = []
        for _ in range(5000):
            pick = [rng.choice(bases) for _ in bases]
            rows = [r for b in pick for r in per if r[0] == b]
            diffs.append(sum(a - g for _, a, g in rows) / len(rows))
        diffs.sort()
        out["ranking_uncertainty"] = {
            "n_scenarios": len(per), "n_base_profiles": len(bases),
            "mean_diff_formula5_minus_gap_x_demand": round(sum(a - g for _, a, g in per) / len(per), 4),
            "ci95_cluster_bootstrap": [round(diffs[124], 4), round(diffs[4874], 4)],
            "scenarios_formula5_better": sum(a > g + 1e-9 for _, a, g in per),
            "scenarios_tied": sum(abs(a - g) <= 1e-9 for _, a, g in per)}
    (MODELS_DIR / "expert_v5_results.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    if sys.argv[1:2] == ["build"]:
        build()
    elif sys.argv[1:2] == ["rescore"]:
        print(json.dumps(rescore(sys.argv[2:]), indent=1))
    elif sys.argv[1:2] == ["score"]:
        print(json.dumps(score(sys.argv[2:]), indent=1))
    else:
        print(__doc__)
