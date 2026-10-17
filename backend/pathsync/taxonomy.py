"""Skill taxonomy and prerequisite graph (paper III.A.1 and III.A.3)."""
from __future__ import annotations

import json
from collections import defaultdict, deque
from dataclasses import dataclass, field
from functools import lru_cache

from .config import SEED_DIR
from .i18n import get_lang


@dataclass(frozen=True)
class Skill:
    id: str
    name: str
    name_en: str
    cluster: str
    kind: str
    description: str
    learn_what: str
    hours: int
    aliases: tuple[str, ...]
    esco: tuple[str, ...]
    # Indonesian originals: used for matching and extraction prompts whatever the display language
    name_id: str = ""
    description_id: str = ""


@dataclass
class Edge:
    src: str
    dst: str
    source: str = "tim"
    rationale: str = ""
    status: str = "draft"        # draft | approved | rejected (after expert validation)


class CycleError(ValueError):
    pass


@dataclass
class SkillGraph:
    """Directed acyclic graph, edge = prerequisite -> dependent skill."""

    skills: dict[str, Skill]
    edges: list[Edge] = field(default_factory=list)

    def __post_init__(self):
        self._rebuild()

    def _rebuild(self):
        self.prereqs: dict[str, list[str]] = defaultdict(list)
        self.dependents: dict[str, list[str]] = defaultdict(list)
        for e in self.active_edges():
            if e.src not in self.skills or e.dst not in self.skills:
                raise KeyError(f"edge references unknown skill: {e.src}->{e.dst}")
            self.prereqs[e.dst].append(e.src)
            self.dependents[e.src].append(e.dst)
        self.check_acyclic()
        self._desc_cache: dict[str, frozenset[str]] = {}

    def active_edges(self) -> list[Edge]:
        """Edges the engine uses: approved ones once validation exists, otherwise all drafts."""
        if any(e.status == "approved" for e in self.edges):
            return [e for e in self.edges if e.status == "approved"]
        return [e for e in self.edges if e.status != "rejected"]

    def with_edges(self, edges: list[Edge]) -> SkillGraph:
        return SkillGraph(self.skills, edges)

    # ------------------------------------------------------------- structure
    def check_acyclic(self) -> None:
        order = self.topological_order()
        if len(order) != len(self.skills):
            raise CycleError("prerequisite graph contains a cycle; learning order is undefined")

    def topological_order(self, priority: dict[str, float] | None = None) -> list[str]:
        """Kahn's algorithm. Ties are broken by `priority` (higher first), then by id."""
        indeg = {s: 0 for s in self.skills}
        for dst, srcs in self.prereqs.items():
            indeg[dst] = len(srcs)
        prio = priority or {}
        ready = sorted([s for s, d in indeg.items() if d == 0], key=lambda s: (-prio.get(s, 0.0), s))
        out: list[str] = []
        while ready:
            s = ready.pop(0)
            out.append(s)
            for t in self.dependents.get(s, []):
                indeg[t] -= 1
                if indeg[t] == 0:
                    ready.append(t)
            ready.sort(key=lambda x: (-prio.get(x, 0.0), x))
        return out

    def descendants(self, skill: str) -> frozenset[str]:
        if skill not in self._desc_cache:
            seen, q = set(), deque(self.dependents.get(skill, []))
            while q:
                t = q.popleft()
                if t in seen:
                    continue
                seen.add(t)
                q.extend(self.dependents.get(t, []))
            self._desc_cache[skill] = frozenset(seen)
        return self._desc_cache[skill]

    def ancestors(self, skill: str) -> set[str]:
        seen, q = set(), deque(self.prereqs.get(skill, []))
        while q:
            t = q.popleft()
            if t in seen:
                continue
            seen.add(t)
            q.extend(self.prereqs.get(t, []))
        return seen

    def depth(self) -> dict[str, int]:
        d: dict[str, int] = {}
        for s in self.topological_order():
            d[s] = 1 + max((d[p] for p in self.prereqs.get(s, [])), default=-1)
        return d


def _load_json(name: str) -> dict:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_taxonomy() -> dict:
    return _load_json("taxonomy.json")


def load_skills(lang: str | None = None) -> dict[str, Skill]:
    """Frozen taxonomy as Skill objects in the request's display language (cached per language; read-only)."""
    return _load_skills(lang or get_lang())


@lru_cache(maxsize=4)
def _load_skills(lang: str) -> dict[str, Skill]:
    tax = load_taxonomy()
    out = {}
    for s in tax["skills"]:
        en = lang == "en"
        out[s["id"]] = Skill(
            id=s["id"], name=s["name_en"] if en else s["name"], name_en=s["name_en"], cluster=s["cluster"], kind=s["kind"],
            description=s.get("description_en", s["description"]) if en else s["description"],
            learn_what=s.get("learn_what_en", s["learn_what"]) if en else s["learn_what"], hours=int(s.get("hours", 10)),
            aliases=tuple(a.lower() for a in s.get("aliases", [])), esco=tuple(s.get("esco", [])),
            name_id=s["name"], description_id=s["description"],
        )
    return out


def display_skills() -> dict[str, Skill]:
    """Taxonomy for display: names and texts in the current request's language (the same as load_skills())."""
    return load_skills()


def load_draft_edges() -> list[Edge]:
    g = _load_json("graph.json")
    key = "rationale_en" if get_lang() == "en" else "rationale"
    return [Edge(e["from"], e["to"], e.get("source", "tim"), e.get(key) or e.get("rationale", "")) for e in g["edges"]]


@lru_cache(maxsize=1)
def rationale_variants() -> dict[tuple[str, str], dict[str, str]]:
    """(src, dst) -> {"id": ..., "en": ...} for seed edges, so a stored rationale can be shown in either language."""
    return {(e["from"], e["to"]): {"id": e.get("rationale", ""), "en": e.get("rationale_en") or e.get("rationale", "")}
            for e in _load_json("graph.json")["edges"]}


def display_rationale(src: str, dst: str, stored: str) -> str:
    """A seed rationale in the request's language; text an expert wrote stays as written."""
    v = rationale_variants().get((src, dst))
    return v[get_lang()] if v and stored in v.values() else stored


def seed_rationales() -> dict[tuple[str, str], tuple[str, str]]:
    """(src, dst) -> (Indonesian rationale, display rationale) for edges that came from the seed graph."""
    key = "rationale_en" if get_lang() == "en" else "rationale"
    return {(e["from"], e["to"]): (e.get("rationale", ""), e.get(key) or e.get("rationale", ""))
            for e in _load_json("graph.json")["edges"]}


def load_graph(edges: list[Edge] | None = None) -> SkillGraph:
    return SkillGraph(load_skills(), edges if edges is not None else load_draft_edges())


def cluster_names() -> dict[str, str]:
    """Area labels in the current request's language."""
    tax = load_taxonomy()
    return tax.get("clusters_en", tax["clusters"]) if get_lang() == "en" else tax["clusters"]
