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
PostgreSQL (docker-compose ships a pgvector image).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine,
                        event, select)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .config import DATABASE_URL


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
    mentions: Mapped[list["PostingMention"]] = relationship(back_populates="posting", cascade="all, delete-orphan")


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


# -------------------------------------------------------- graph + expert panel
class GraphEdge(Base):
    __tablename__ = "graph_edges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src: Mapped[str] = mapped_column(String(60))
    dst: Mapped[str] = mapped_column(String(60))
    source: Mapped[str] = mapped_column(String(12), default="tim")
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="draft")   # draft | approved | rejected
    votes: Mapped[list["EdgeVote"]] = relationship(back_populates="edge", cascade="all, delete-orphan")


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
    display_name: Mapped[str] = mapped_column(String(120), default="Mahasiswa")
    program: Mapped[str] = mapped_column(String(120), default="")
    target_role: Mapped[str] = mapped_column(String(40), default="business_analyst")
    consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)    # format, weekly_hours
    self_ratings: Mapped[dict] = mapped_column(JSON, default=dict)   # skill -> 1..5 (never mastery evidence)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))           # academic | certificate | project | assessment | cv
    title: Mapped[str] = mapped_column(String(300), default="")
    scores: Mapped[dict] = mapped_column(JSON, default=dict)     # skill -> e in [0,1] (empty for cv)
    details: Mapped[dict] = mapped_column(JSON, default=dict)    # quotes, rubric, mapping, claims ...
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


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


class Annotation(Base):
    """Gold skill labels for extraction evaluation (paper Table 7, level 1)."""
    __tablename__ = "annotations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    posting_id: Mapped[str] = mapped_column(ForeignKey("postings.id"), index=True)
    annotator: Mapped[str] = mapped_column(String(80))
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ------------------------------------------------------------------ engine
_engine = create_engine(DATABASE_URL, future=True,
                        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):  # pragma: no cover - connection setup
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False, future=True)


def init_db() -> None:
    Base.metadata.create_all(_engine)


def get_session() -> Session:
    return SessionLocal()


def active_snapshot(s: Session, role: str) -> MarketSnapshot | None:
    return s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role, MarketSnapshot.active.is_(True))
                     .order_by(MarketSnapshot.id.desc())).first()
