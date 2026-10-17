"""Display language per request, and the catalogue of every sentence the engine shows to a student.

The language is a context variable set per HTTP request (api.main reads `?lang=` or `Accept-Language`); scripts and
tests can switch it with `use_lang`. PATHSYNC_LANG is only the default when a request names no language. Logic never
writes user-facing text inline: it calls `t(key, **values)`, so both languages always carry the same information
(tests check that every key exists in both).
"""
from __future__ import annotations

import contextlib
from contextvars import ContextVar

from .config import LANG as DEFAULT_LANG

SUPPORTED = ("en", "id")
_current: ContextVar[str] = ContextVar("pathsync_lang", default=DEFAULT_LANG if DEFAULT_LANG in SUPPORTED else "en")


def get_lang() -> str:
    return _current.get()


def set_lang(lang: str | None):
    return _current.set(lang if lang in SUPPORTED else get_lang())


def reset_lang(token) -> None:
    _current.reset(token)


@contextlib.contextmanager
def use_lang(lang: str):
    token = set_lang(lang)
    try:
        yield
    finally:
        _current.reset(token)


def negotiate(query_lang: str | None, accept_language: str | None) -> str | None:
    """`?lang=` wins; otherwise the first supported tag in Accept-Language ("id-ID,id;q=0.9,en;q=0.8" -> "id")."""
    if query_lang and query_lang.lower()[:2] in SUPPORTED:
        return query_lang.lower()[:2]
    for part in (accept_language or "").split(","):
        tag = part.split(";")[0].strip().lower()[:2]
        if tag in SUPPORTED:
            return tag
    return None


MESSAGES: dict[str, dict[str, str]] = {
    # levels
    "level.awal": {"en": "beginner", "id": "pemula"},
    "level.dasar": {"en": "basic", "id": "dasar"},
    "level.mandiri": {"en": "proficient", "id": "mandiri"},
    "level.mahir": {"en": "advanced", "id": "mahir"},
    # explanation panel (paper III.A.5: what, why, why now, what next)
    "explain.what": {"en": "Focus on {learn}. You are at {now} level ({p:.2f}); the role expects {need} ({r:.2f}).",
                     "id": "Fokus pada {learn}. Levelmu sekarang {now} ({p:.2f}); peran ini membutuhkan {need} ({r:.2f})."},
    "explain.why.postings": {"en": "Asked for in {count} of {n} {role} job postings ({share:.0%}).",
                             "id": "Diminta di {count} dari {n} lowongan {role} ({share:.0%})."},
    "explain.why.trend_up": {"en": "Demand is rising {pct:.0%} over the last 6 months.",
                             "id": "Permintaannya naik {pct:.0%} dalam 6 bulan terakhir."},
    "explain.why.trend_down": {"en": "Demand is falling {pct:.0%} over the last 6 months.",
                               "id": "Permintaannya turun {pct:.0%} dalam 6 bulan terakhir."},
    "explain.why.esco_essential": {"en": "Listed as essential for this occupation in ESCO.",
                                   "id": "Tercantum sebagai skill wajib untuk okupasi ini di ESCO."},
    "explain.why.esco_optional": {"en": "Listed as optional for this occupation in ESCO.",
                                  "id": "Tercantum sebagai skill opsional untuk okupasi ini di ESCO."},
    "explain.why.default": {"en": "Required by your target role.", "id": "Dibutuhkan oleh peran tujuanmu."},
    "explain.now.blocked_one": {"en": "Not ready yet: {names} must reach 0.6 first, so your path covers it before this.",
                                "id": "Belum siap: {names} harus mencapai 0,6 dulu, jadi rutemu membahasnya lebih dulu."},
    "explain.now.blocked_many": {"en": "Not ready yet: {names} must reach 0.6 first, so your path covers them before this.",
                                 "id": "Belum siap: {names} harus mencapai 0,6 dulu, jadi rutemu membahasnya lebih dulu."},
    "explain.now.ready": {"en": "You already have the prerequisites, so you can start now.",
                          "id": "Prasyaratnya sudah kamu punya, jadi bisa mulai sekarang."},
    "explain.now.unlocks_one": {"en": " It unlocks 1 other skill you still need: {names}.",
                                "id": " Skill ini membuka 1 skill lain yang masih kamu butuhkan: {names}."},
    "explain.now.unlocks_many": {"en": " It unlocks {k} other skills you still need: {names}{more}.",
                                 "id": " Skill ini membuka {k} skill lain yang masih kamu butuhkan: {names}{more}."},
    "explain.and_more": {"en": ", and more", "id": ", dan lainnya"},
    "explain.next.after": {"en": "{nxt}, once your {cur} evidence reaches 0.6.",
                           "id": "{nxt}, setelah bukti {cur} kamu mencapai 0,6."},
    "explain.next.builds": {"en": "{nxt}, which builds on this skill.", "id": "{nxt}, yang dibangun di atas skill ini."},
    "explain.next.refresh": {"en": "Add new evidence (a re-check or a project) to refresh your path.",
                             "id": "Tambahkan bukti baru (cek ulang atau proyek) untuk memperbarui rutemu."},
    "path.needed_before": {"en": "Needed before {names}.", "id": "Dibutuhkan sebelum {names}."},
    # confirmation flags (Fig. 5)
    "flag.paparan_akademik_tanpa_bukti_langsung": {"en": "Strong course grades, but no project or assessment evidence yet.",
                                                   "id": "Nilai kuliahnya bagus, tapi belum ada bukti proyek atau asesmen."},
    "flag.klaim_cv_belum_terbukti": {"en": "Mentioned on your CV, but there is no evidence we can check yet.",
                                     "id": "Disebut di CV-mu, tapi belum ada bukti yang bisa kami periksa."},
    "flag.bukti_bertentangan": {"en": "Your course grades are much higher than your assessment result.",
                                "id": "Nilai kuliahmu jauh lebih tinggi daripada hasil asesmenmu."},
    "flag.persepsi_lebih_tinggi_dari_bukti": {"en": "You rated yourself higher than your evidence shows.",
                                              "id": "Penilaian dirimu lebih tinggi daripada yang ditunjukkan buktimu."},
    # path history (adaptive cycle)
    "history.left": {"en": "{name} left your priorities: the gap is closed (mastery {p:.2f}).",
                     "id": "{name} keluar dari prioritasmu: kesenjangannya sudah tertutup (penguasaan {p:.2f})."},
    "history.joined": {"en": "{name} joined your priorities at #{rank}.", "id": "{name} masuk ke prioritasmu di #{rank}."},
    "history.cause.mastery_up": {"en": "your mastery rose {a:.2f} to {b:.2f}", "id": "penguasaanmu naik {a:.2f} ke {b:.2f}"},
    "history.cause.mastery_down": {"en": "your mastery fell {a:.2f} to {b:.2f}", "id": "penguasaanmu turun {a:.2f} ke {b:.2f}"},
    "history.cause.gap_narrowed": {"en": "gap narrowed {a:.2f} to {b:.2f}", "id": "kesenjangan menyempit {a:.2f} ke {b:.2f}"},
    "history.cause.gap_widened": {"en": "gap widened {a:.2f} to {b:.2f}", "id": "kesenjangan melebar {a:.2f} ke {b:.2f}"},
    "history.cause.prereq_met": {"en": "prerequisites now met", "id": "prasyarat sekarang terpenuhi"},
    "history.cause.prereq_not_met": {"en": "prerequisites not met yet", "id": "prasyarat belum terpenuhi"},
    "history.cause.demand_up": {"en": "market demand rose {a:.0%} to {b:.0%}", "id": "permintaan pasar naik {a:.0%} ke {b:.0%}"},
    "history.cause.demand_down": {"en": "market demand fell {a:.0%} to {b:.0%}", "id": "permintaan pasar turun {a:.0%} ke {b:.0%}"},
    "history.cause.trend_up": {"en": "trend strengthened", "id": "tren menguat"},
    "history.cause.trend_down": {"en": "trend weakened", "id": "tren melemah"},
    "history.cause.dependents": {"en": "changes in skills that depend on it", "id": "perubahan pada skill yang bergantung padanya"},
    "history.stayed": {"en": "stayed", "id": "tetap"},
    "history.move_up": {"en": "moved up", "id": "naik"},
    "history.move_down": {"en": "moved down", "id": "turun"},
    "history.moved": {"en": "{name} {move} #{a} to #{b}: {causes}.", "id": "{name} {move} dari #{a} ke #{b}: {causes}."},
    "history.trigger.initial": {"en": "First path created", "id": "Rute pertama dibuat"},
    "history.trigger.evidence": {"en": "New evidence added", "id": "Bukti baru ditambahkan"},
    "history.trigger.market": {"en": "Job market updated", "id": "Pasar kerja diperbarui"},
    "history.trigger.role": {"en": "Target role changed", "id": "Peran tujuan diganti"},
    "history.trigger.manual": {"en": "Manual update", "id": "Pembaruan manual"},
    "history.summary.first": {"en": "{label}: your top priority is {name}.", "id": "{label}: prioritas utamamu adalah {name}."},
    "history.summary.moved": {"en": "{label}: your top priority moved from {a} to {b}.",
                              "id": "{label}: prioritas utamamu berpindah dari {a} ke {b}."},
    "history.summary.same": {"en": "{label}: {name} is still your top priority.", "id": "{label}: {name} masih prioritas utamamu."},
    "history.summary.none": {"en": "{label}: no gaps left for this role.", "id": "{label}: tidak ada kesenjangan tersisa untuk peran ini."},
    # soft skills (experience levels)
    "soft.level.0": {"en": "No experience yet", "id": "Belum ada pengalaman"},
    "soft.level.1": {"en": "Tried it (class, club, event)", "id": "Pernah mencoba (kelas, organisasi, acara)"},
    "soft.level.2": {"en": "Regular (project, internship, job)", "id": "Rutin (proyek, magang, kerja)"},
    "soft.level.3": {"en": "Led or taught others", "id": "Memimpin atau mengajari orang lain"},
    # market
    "market.trend_missing": {
        "en": "Not enough postings to compare: {recent} in the last {w} months and {previous} in the {w} months before (at least "
              "{need} needed in each). Scraping only sees postings that are still open, so the earlier window fills in as "
              "monthly snapshots accumulate.",
        "id": "Lowongan belum cukup untuk dibandingkan: {recent} dalam {w} bulan terakhir dan {previous} dalam {w} bulan "
              "sebelumnya (masing-masing minimal {need}). Scraping hanya melihat lowongan yang masih dibuka, jadi periode "
              "sebelumnya terisi seiring snapshot bulanan bertambah."},
}


def t(key: str, **values) -> str:
    entry = MESSAGES[key]
    return entry.get(get_lang(), entry["en"]).format(**values)
