"""Persistence layer (SQLAlchemy 2.0).

Paper III.B lists five entity groups; each maps to tables below:
  1. postings + evidence quotes        -> Posting, PostingMention, MarketSnapshot
  2. taxonomy + prerequisite graph     -> GraphEdge, EdgeVote (taxonomy itself is the frozen seed JSON)
  3. student evidence                  -> Student, Evidence, AssessmentResponse
  4. competency state                  -> derived deterministically by replaying 3 (pathsync.evidence)
  5. recommendation history            -> RecommendationHistory (every path change with its reason)
plus the expert panel (Expert, Scenario, ScenarioRanking), ranker versions and
gold annotations for extraction evaluation.

Default engine is SQLite; set PATHSYNC_DATABASE_URL=postgresql+psycopg://... to use
PostgreSQL (docker-compose ships postgres:16). Embeddings stay in memory with a
persistent cache (data/processed/embedding_cache.sqlite); there is no vector query in
the database, so pgvector is not used.
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, event, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .config import DATABASE_URL


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class Base(DeclarativeBase):
    pass


# ----------------------------------------------------------------- market data
class Posting(Base):
    __tablename__ = "postings"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    source: Mapped[str] = mapped_column(String(32), index=True)
    url: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str] = mapped_column(String(300), default="")
    location: Mapped[str] = mapped_column(String(300), default="")
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    first_seen: Mapped[date] = mapped_column(Date, default=date.today)
    role: Mapped[str] = mapped_column(String(40), index=True)
    language: Mapped[str] = mapped_column(String(10), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    duplicate_of: Mapped[str | None] = mapped_column(String(160), nullable=True)
    in_window: Mapped[bool] = mapped_column(Boolean, default=True)
    extractor: Mapped[str] = mapped_column(String(20), default="")
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    mentions: Mapped[list[PostingMention]] = relationship(back_populates="posting", cascade="all, delete-orphan")


class PostingMention(Base):
    __tablename__ = "posting_mentions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    posting_id: Mapped[str] = mapped_column(ForeignKey("postings.id"), index=True)
    skill_id: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    surface: Mapped[str] = mapped_column(String(300))
    quote: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(10), default="mandiri")
    similarity: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(12), default="auto", index=True)  # auto|review|new|rejected
    method: Mapped[str] = mapped_column(String(12), default="lexicon")
    review_decision: Mapped[str | None] = mapped_column(String(60), nullable=True)
    posting: Mapped[Posting] = relationship(back_populates="mentions")


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(40), index=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    reference_date: Mapped[date] = mapped_column(Date)
    data: Mapped[dict] = mapped_column(JSON)            # MarketMap.to_dict()
    required: Mapped[dict] = mapped_column(JSON)        # r_s per skill
    sources: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str] = mapped_column(Text, default="")
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # taxonomy version + hash, extractor cache tags and gold hashes, so old numbers can be reproduced (plan B5)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)


# -------------------------------------------------------- graph + expert panel
class GraphEdge(Base):
    __tablename__ = "graph_edges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src: Mapped[str] = mapped_column(String(60))
    dst: Mapped[str] = mapped_column(String(60))
    source: Mapped[str] = mapped_column(String(12), default="tim")
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="draft")   # draft | approved | rejected
    votes: Mapped[list[EdgeVote]] = relationship(back_populates="edge", cascade="all, delete-orphan")


class Expert(Base):
    __tablename__ = "experts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    affiliation: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[str] = mapped_column(String(20), default="dosen")    # dosen | praktisi | simulasi
    validates_graph: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class EdgeVote(Base):
    __tablename__ = "edge_votes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    edge_id: Mapped[int] = mapped_column(ForeignKey("graph_edges.id"), index=True)
    expert_id: Mapped[str] = mapped_column(ForeignKey("experts.id"), index=True)
    approve: Mapped[bool] = mapped_column(Boolean)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    edge: Mapped[GraphEdge] = relationship(back_populates="votes")


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    base_id: Mapped[str] = mapped_column(String(40), index=True)
    variant: Mapped[str] = mapped_column(String(20))        # base | competency | market
    title: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)             # student state, market state, candidates + features
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ScenarioRanking(Base):
    __tablename__ = "scenario_rankings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_id: Mapped[str] = mapped_column(ForeignKey("scenarios.id"), index=True)
    expert_id: Mapped[str] = mapped_column(ForeignKey("experts.id"), index=True)
    order: Mapped[list] = mapped_column(JSON)               # candidate skill ids, first = learn first
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RankerModel(Base):
    __tablename__ = "ranker_models"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    name: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(20))         # formula5 | simulated | expert
    weights: Mapped[dict] = mapped_column(JSON)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


# ------------------------------------------------------------- student side
class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=new_id)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)   # bearer token (sha256)
    display_name: Mapped[str] = mapped_column(String(120), default="Mahasiswa")
    program: Mapped[str] = mapped_column(String(120), default="")
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_role: Mapped[str] = mapped_column(String(40), default="business_analyst")
    consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    consent_version: Mapped[str] = mapped_column(String(20), default="")
    # separate, optional consent for research use (user studies, weight calibration); never required to use PathSync
    research_consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cohort_id: Mapped[str | None] = mapped_column(ForeignKey("cohorts.id"), nullable=True, index=True)
    study_id: Mapped[str | None] = mapped_column(ForeignKey("studies.id"), nullable=True, index=True)
    study_arm: Mapped[str | None] = mapped_column(String(20), nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)    # format, weekly_hours
    self_ratings: Mapped[dict] = mapped_column(JSON, default=dict)   # skill -> 1..5 (never mastery evidence)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    evidence: Mapped[list[Evidence]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))           # academic | certificate | project | assessment | cv
    title: Mapped[str] = mapped_column(String(300), default="")
    scores: Mapped[dict] = mapped_column(JSON, default=dict)     # skill -> e in [0,1] (empty for cv)
    details: Mapped[dict] = mapped_column(JSON, default=dict)    # quotes, rubric, mapping, claims ...
    # project rubrics: auto (counts fully) | pending (flagged or sampled; counts at reduced weight) |
    # approved | rejected (human reviewer decision, paper III.A.2 20% re-check)
    review_status: Mapped[str] = mapped_column(String(12), default="auto", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    student: Mapped[Student] = relationship(back_populates="evidence")


class AssessmentResponse(Base):
    __tablename__ = "assessment_responses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    item_id: Mapped[str] = mapped_column(String(40))
    skill_id: Mapped[str] = mapped_column(String(60), index=True)
    correct: Mapped[bool] = mapped_column(Boolean)
    phase: Mapped[str] = mapped_column(String(20))          # diagnostic | reassessment
    session_id: Mapped[str] = mapped_column(String(40), default="")
    choice_canon: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 0 = key, 1-3 = distractors (item analysis)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AssessmentSession(Base):
    """Items issued to a student; a submission must match an open session exactly once (anti-replay)."""
    __tablename__ = "assessment_sessions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uuid.uuid4().hex)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    phase: Mapped[str] = mapped_column(String(20))
    skill_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    item_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ApiToken(Base):
    """Bearer tokens for staff roles (admin, expert, advisor). Only the sha256 is stored."""
    __tablename__ = "api_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(20), index=True)          # admin | expert | advisor
    subject_id: Mapped[str] = mapped_column(String(40), default="")    # expert id / cohort id
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)   # staff tokens: 30 days


class AuditLog(Base):
    """Who did what in the staff tools (model activation, market simulation, token changes, reviews)."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(160), default="")       # "admin:Founding admin", "system"
    action: Mapped[str] = mapped_column(String(60), index=True)
    target: Mapped[str] = mapped_column(String(200), default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ProductEvent(Base):
    """First-party product analytics (PM audit §6.6). No third-party tracker; student id only, no content."""
    __tablename__ = "product_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(40), index=True)
    student_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Feedback(Base):
    """'Report a problem' messages and client-side errors, with the request id for tracing."""
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(20), default="feedback")   # feedback | client_error
    message: Mapped[str] = mapped_column(Text, default="")
    page: Mapped[str] = mapped_column(String(300), default="")
    request_id: Mapped[str] = mapped_column(String(64), default="")
    contact: Mapped[str] = mapped_column(String(200), default="")
    student_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Waitlist(Base):
    """Students asking to be told when their role is supported (PM audit §6.2)."""
    __tablename__ = "waitlist"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(200), index=True)
    role: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ------------------------------------------------- classroom & learning experience
class CourseEnrollment(Base):
    """Courses the student is taking this semester - links the learning path to classroom work."""
    __tablename__ = "course_enrollments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    course_name: Mapped[str] = mapped_column(String(200))
    term: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[str] = mapped_column(String(12), default="ongoing")   # ongoing | completed
    mapping: Mapped[dict] = mapped_column(JSON, default=dict)              # skill -> strength
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class WeeklyPlan(Base):
    """Self-regulated learning cycle (Zimmerman): plan goals for the week, then reflect."""
    __tablename__ = "weekly_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    goals: Mapped[list] = mapped_column(JSON, default=list)          # [{skill_id, kind, course?, minutes, done}]
    planned_minutes: Mapped[int] = mapped_column(Integer, default=0)
    reflection: Mapped[dict] = mapped_column(JSON, default=dict)     # {done_minutes, confidence, obstacle, note}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    reflected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Pulse(Base):
    """Short in-product survey answers (e.g. direction clarity, paper H1) for the learning-experience metric."""
    __tablename__ = "pulses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    item: Mapped[str] = mapped_column(String(40))
    value: Mapped[int] = mapped_column(Integer)
    context: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Cohort(Base):
    """A class or advising group. Advisors see only anonymised aggregates (k >= 5)."""
    __tablename__ = "cohorts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    institution: Mapped[str] = mapped_column(String(200), default="")
    join_code: Mapped[str] = mapped_column(String(12), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Study(Base):
    """Controlled user study (paper III.D.3) with randomised arms and feature flags per arm."""
    __tablename__ = "studies"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    join_code: Mapped[str] = mapped_column(String(12), unique=True)
    arms: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StudyPlan(Base):
    """A learning plan written by a participant; rated blind by experts (paper H2/H3)."""
    __tablename__ = "study_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    study_id: Mapped[str] = mapped_column(ForeignKey("studies.id"), index=True)
    plan_text: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    blind_code: Mapped[str] = mapped_column(String(12), unique=True)
    ratings: Mapped[list] = mapped_column(JSON, default=list)        # [{expert_id, score}]


class AppState(Base):
    """Small key/value store; `cache_epoch` invalidates the in-process decision context cache."""
    __tablename__ = "app_state"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


class RecommendationHistory(Base):
    __tablename__ = "recommendation_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    trigger: Mapped[str] = mapped_column(String(20))        # initial | evidence | market | role | manual
    summary: Mapped[str] = mapped_column(Text, default="")
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    ranking: Mapped[list] = mapped_column(JSON, default=list)
    path: Mapped[list] = mapped_column(JSON, default=list)
    coverage: Mapped[float] = mapped_column(Float, default=0.0)
    market_version: Mapped[str] = mapped_column(String(40), default="")
    model_name: Mapped[str] = mapped_column(String(80), default="")
    # readiness for every role at this moment (Career Map), so Path History can show which other careers moved
    careers: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Annotation(Base):
    """Gold skill labels for extraction evaluation (paper Table 7, level 1)."""
    __tablename__ = "annotations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    posting_id: Mapped[str] = mapped_column(ForeignKey("postings.id"), index=True)
    annotator: Mapped[str] = mapped_column(String(80))
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ------------------------------------------------------------------ engine
# Server databases: sync endpoints run in a 40-thread pool per worker, and the default pool (5 + 10 overflow)
# ran out under load (plan B4: 500s with "QueuePool limit ... reached"). 15 + 15 per worker keeps 2 workers
# plus the side services under PostgreSQL's default max_connections of 100; raise both together.
_POOL = {} if DATABASE_URL.startswith("sqlite") else {
    "pool_size": int(os.getenv("PATHSYNC_DB_POOL", "15")), "max_overflow": int(os.getenv("PATHSYNC_DB_OVERFLOW", "15")),
    "pool_timeout": 15, "pool_recycle": 1800}
DB_CONNECTIONS = (_POOL["pool_size"] + _POOL["max_overflow"]) if _POOL else 0    # api.main sizes the thread pool to this
_engine = create_engine(DATABASE_URL, future=True,
                        # sqlite: wait up to 30 s for the single writer instead of failing with "database is locked"
                        connect_args={"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {},
                        pool_pre_ping=not DATABASE_URL.startswith("sqlite"), **_POOL)
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):  # pragma: no cover - connection setup
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")      # safe with WAL; commits no longer wait for a full fsync
        cur.execute("PRAGMA busy_timeout=30000")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False, future=True)


def init_db() -> None:
    """Bring the schema to the latest Alembic revision (stamping databases created before migrations existed)."""
    from .migrate import upgrade

    upgrade(_engine)


def bump_epoch(s: Session) -> None:
    """Invalidate cached decision contexts (market snapshot, model or graph changed)."""
    row = s.get(AppState, "cache_epoch")
    if row is None:
        s.add(AppState(key="cache_epoch", value="1"))
    else:
        row.value = str(int(row.value or 0) + 1)


def cache_epoch(s: Session) -> str:
    row = s.get(AppState, "cache_epoch")
    return row.value if row else "0"


def get_session() -> Session:
    return SessionLocal()


def active_snapshot(s: Session, role: str) -> MarketSnapshot | None:
    return s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role, MarketSnapshot.active.is_(True))
                     .order_by(MarketSnapshot.id.desc())).first()
