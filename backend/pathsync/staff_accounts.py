"""Staff accounts: password hashing, invites, and the read-only demo accounts for visitors.

Passwords are hashed with scrypt (standard library, memory-hard) and a per-password salt; the stored string carries
its own parameters so they can be raised later. Invites are random tokens stored as sha256, valid for a week.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import ApiToken, Cohort, Evidence, Expert, StaffAccount, Student, utcnow
from .security import hash_token, issue_token, new_token

ROLES = ("admin", "expert", "advisor")
MIN_PASSWORD = 10
INVITE_DAYS = 7
ACCOUNT_TOKEN_DAYS = 3650          # the account's own staff token; sessions from it last STAFF_SESSION_HOURS
DEMO_LABEL = "demo:"               # in a token label: a read-only demo session (security._staff refuses writes)
_N, _R, _P = 2 ** 14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, maxmem=64 * 1024 * 1024, dklen=32)
    b = lambda x: base64.b64encode(x).decode()  # noqa: E731
    return f"scrypt${_N}${_R}${_P}${b(salt)}${b(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    try:
        algo, n, r, p, salt, dk = (stored or "").split("$")
        if algo != "scrypt":
            return False
        want = base64.b64decode(dk)
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                             maxmem=64 * 1024 * 1024, dklen=len(want))
        return hmac.compare_digest(got, want)
    except (ValueError, TypeError):
        return False


def normalise_email(email: str) -> str:
    return email.strip().lower()


def account_token(s: Session, acc: StaffAccount) -> ApiToken:
    """The account's long-lived staff token (created on first use, renewed when it was revoked or ran out)."""
    tok = s.get(ApiToken, acc.token_id) if acc.token_id else None
    if tok is None or tok.revoked_at is not None or (tok.expires_at is not None and tok.expires_at < utcnow()):
        label = (DEMO_LABEL if acc.demo else "account ") + (acc.name or acc.email)
        raw = issue_token(s, acc.role, acc.subject_id, label[:120], utcnow() + timedelta(days=ACCOUNT_TOKEN_DAYS))
        s.flush()
        tok = s.scalars(select(ApiToken).where(ApiToken.token_hash == hash_token(raw))).one()
        acc.token_id = tok.id
    return tok


def new_invite(acc: StaffAccount) -> str:
    raw = new_token()
    acc.invite_hash = hash_token(raw)
    acc.invite_expires_at = utcnow() + timedelta(days=INVITE_DAYS)
    return raw


# ------------------------------------------------------------------ read-only demo accounts
DEMO_CLASS = "Sistem Informasi 2023 Kelas B"
_OLD_CLASS_NAMES = ("Kelas Demo · Sistem Informasi 2023", "Kelas Demo Sistem Informasi 2023")
_NAMES = ["Alya Putri", "Bima Saputra", "Citra Lestari", "Dimas Pratama", "Eka Wulandari", "Fajar Nugroho", "Gita Maharani", "Hafiz Ramadhan"]
DEMO_CLASS_SIZE = 8
# A spread of transcripts, so the class report has real gaps to show (k >= 5 anonymity needs at least five).
_GRADES = ["A", "A", "B", "B", "B", "C", "C", "D"]
_DEMO_COURSES = ["Analisis dan Perancangan Sistem Informasi", "Manajemen Proses Bisnis", "Statistika Bisnis",
                 "Basis Data", "Visualisasi Data", "Rekayasa Perangkat Lunak"]


def _demo_class(s: Session) -> Cohort:
    from .intake import academic_evidence
    from .study import join_code

    c = s.scalars(select(Cohort).where(Cohort.name.in_((DEMO_CLASS, *_OLD_CLASS_NAMES)))).first()
    if c is not None:
        c.name, c.institution = DEMO_CLASS, "PathSync"
    if c is None:
        c = Cohort(name=DEMO_CLASS, institution="PathSync", join_code=join_code())
        s.add(c)
        s.flush()
    have = s.scalar(select(func.count(Student.id)).where(Student.cohort_id == c.id)) or 0
    for i in range(have, DEMO_CLASS_SIZE):
        # demo students are deleted by the retention job like any demo profile; the class is refilled on demand
        st = Student(display_name=_NAMES[i % len(_NAMES)], program="Information Systems", semester=5,
                     target_role="business_analyst", consent_at=utcnow(), consent_version="demo", cohort_id=c.id,
                     preferences={"weekly_hours": 6, "language": "id", "demo": True})
        s.add(st)
        s.flush()
        rot = i % len(_GRADES)
        courses = [{"name": n, "grade": _GRADES[(rot + k) % len(_GRADES)]} for k, n in enumerate(_DEMO_COURSES)]
        item, detail = academic_evidence(courses)
        s.add(Evidence(student_id=st.id, kind="academic", title="Transkrip", scores=item.scores,
                       details={"strength": item.strength, "courses": detail}))
    return c


def demo_account(s: Session, role: str) -> StaffAccount:
    """The read-only demo lecturer (a demo class) or demo expert (an expert that never counts as one)."""
    email = f"demo-{role}@pathsync.local"
    acc = s.scalars(select(StaffAccount).where(StaffAccount.email == email)).first()
    if role == "advisor":
        subject = _demo_class(s).id
        name = "Dr. Sari Wulandari"
    else:
        e = s.scalars(select(Expert).where(Expert.kind == "demo")).first()
        if e is None:
            e = Expert(name="Budi Hartono", affiliation="Business Analyst, PathSync", kind="demo", validates_graph=False)
            s.add(e)
            s.flush()
        subject = e.id
        name = "Budi Hartono"
        e.name, e.affiliation = name, "Business Analyst, PathSync"
    if acc is None:
        acc = StaffAccount(email=email, name=name, role=role, subject_id=subject, demo=True)
        s.add(acc)
        s.flush()
    acc.name = name
    if acc.subject_id != subject:
        acc.subject_id = subject
        if acc.token_id:
            tok = s.get(ApiToken, acc.token_id)
            if tok is not None:
                tok.revoked_at = utcnow()
    return acc
