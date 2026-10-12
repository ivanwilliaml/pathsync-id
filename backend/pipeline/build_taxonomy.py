"""Build data/seed/taxonomy.json (v3, hard skills only) from the retained skills plus data/seed/_src/skills_*.py.

Soft and managerial skills are dropped on purpose (communication, critical thinking, stakeholder and change management,
agile/scrum, project and risk management, strategy, writing, presenting). They cannot be assessed with multiple-choice
questions and no course teaches them the way a tool or a method is taught.

Run: python -m pipeline.build_taxonomy      (writes taxonomy.json, prints alias conflicts)
"""
from __future__ import annotations

import importlib.util
import json
from datetime import date

from pathsync.config import SEED_DIR

DROP = {
    "research_methods", "process_improvement", "agile_scrum", "stakeholder_management", "project_management",
    "business_case", "change_management", "strategic_analysis", "risk_management", "presentation_storytelling",
    "business_writing", "verbal_communication", "facilitation_negotiation", "english_proficiency", "critical_thinking",
    "collaboration",
}
RECLUSTER = {
    "sql": "data_analytics", "statistics": "data_analytics", "data_analysis": "data_analytics",
    "data_visualization": "data_analytics", "dashboard_reporting": "data_analytics", "data_cleaning": "data_analytics",
    "data_modeling": "data_analytics", "python_analytics": "data_analytics", "kpi_metrics": "data_analytics",
    "financial_analysis": "finance",
    "requirements_elicitation": "business_analysis", "requirements_documentation": "business_analysis",
    "business_process_modeling": "business_analysis", "system_modeling_uml": "business_analysis", "sdlc": "business_analysis",
    "diagramming_tools": "business_analysis", "jira_confluence": "business_analysis", "erp_crm": "business_analysis",
    "testing_uat": "testing", "wireframing": "design",
    "excel": "bi_tools", "power_bi": "bi_tools", "tableau": "bi_tools", "bi_tools_other": "bi_tools",
    "cloud_data_platform": "data_eng", "api_integration": "backend",
}
CLUSTERS = {
    "data_analytics": "Data & Analytics", "bi_tools": "Spreadsheets & BI tools", "business_analysis": "Business analysis",
    "data_ml": "Machine learning", "data_eng": "Data engineering", "web_frontend": "Web front end", "backend": "Back end",
    "mobile": "Mobile development", "testing": "Testing & QA", "devops": "Cloud & DevOps", "security": "Cybersecurity",
    "design": "UI/UX & design", "marketing": "Digital marketing", "finance": "Accounting & finance",
}
# aliases too ambiguous in running text; they stay out of the lexicon
AMBIGUOUS = {"later", "buffer", "ia", "ppa", "pixel", "state management", "vault", "ids", "ips"}
ALIAS_REMOVE_FROM = {
    "python_analytics": {"python"},
    # generic words that matched in every kind of posting; the specific multi-word forms stay
    "dashboard_reporting": {"laporan", "pelaporan", "reporting", "reports", "report analysis", "monitoring report", "create report",
                            "membuat laporan", "regulatory reporting"},
    "requirements_documentation": {"documentation", "dokumentasi", "technical document", "dokumen teknis"},
    "cloud_data_platform": {"cloud"},
    "data_analysis": {"analytics", "insight", "insights", "data-driven", "data driven"},
    "testing_uat": {"testing", "pengujian", "menguji", "bug", "bugs", "defect", "quality assurance"},
    "sdlc": {"software development", "application development", "system development", "pengembangan sistem",
             "pengembangan aplikasi", "it project", "proyek it"},
    # measured on the pilot gold set (pipeline.eval_extractor): these surfaces fired in unrelated postings
    "monitoring_observability": {"monitoring", "logging", "alerting", "tracing"},
    "data_modeling": {"database", "basis data", "normalization", "relational database", "relational databases"},
    "data_cleaning": {"data processing", "data integrity", "integritas data", "data accuracy", "akurasi data"},
    "erp_crm": {"oracle"},
    "api_integration": {"api", "apis"},
    "system_modeling_uml": {"use case", "use cases", "system analysis"},
    "networking_fundamentals": {"http", "https", "ssl", "tls", "firewall", "nat", "dhcp"},
    "math_for_ml": {"optimization", "matematika", "matrix", "bayesian"},
    "system_design_architecture": {"scalability", "high availability"},
    "accounting_software": {"jurnal"},
    "test_design_techniques": {"defect"},
    "budgeting_forecasting": {"forecast", "forecasting"},
    "php_laravel": {"composer"},
}
EXTRA_ALIASES = {
    "test_design_techniques": ["quality assurance", "qa", "penjaminan mutu"],
    "rest_api_design": ["api", "apis"],
    "network_security": ["firewall", "waf"],
    "networking_fundamentals": ["networking", "jaringan"],
}
LEGACY_KEEPS = {"sap", "azure devops", "management report", "laporan manajemen"}


def _load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.SKILLS


def main() -> None:
    old = json.loads((SEED_DIR / "_src" / "taxonomy_v2_backup.json").read_text(encoding="utf-8"))  # legacy skills (v2)
    skills: list[dict] = []
    for s in old["skills"]:
        if s["id"] in DROP:
            continue
        s = dict(s)
        s["cluster"] = RECLUSTER.get(s["id"], s["cluster"])
        s["aliases"] = [a for a in s["aliases"] if a not in ALIAS_REMOVE_FROM.get(s["id"], set())]
        skills.append(s)
    for f in sorted((SEED_DIR / "_src").glob("skills_*.py")):
        for n in _load(f):
            skills.append({
                "id": n["id"], "name": n["name"], "name_en": n["name"], "cluster": n["cluster"], "kind": n["kind"],
                "description": n["desc"], "learn_what": n["learn"], "hours": n["hours"],
                "aliases": [a for a in dict.fromkeys(n["aliases"] + EXTRA_ALIASES.get(n["id"], [])) if a not in AMBIGUOUS],
                "esco": [], "description_en": n["desc"], "learn_what_en": n["learn"],
            })
    for s in skills:
        s["aliases"] = [a for a in s["aliases"] if a not in ALIAS_REMOVE_FROM.get(s["id"], set())]
        for a in EXTRA_ALIASES.get(s["id"], []):
            if a not in s["aliases"] and a not in AMBIGUOUS:
                s["aliases"].append(a)
    ids = [s["id"] for s in skills]
    assert len(ids) == len(set(ids)), "duplicate skill ids"
    n_new = sum(len(_load(f)) for f in (SEED_DIR / "_src").glob("skills_*.py"))
    legacy_ids = {s["id"] for s in skills[: len(skills) - n_new]}
    # a contested alias goes to the more specific new skill ("etl", "snowflake", "figma"), except where the legacy skill is
    # the better home (SAP as a business system, Azure DevOps boards, management reports)
    owner: dict[str, str] = {}
    conflicts = []
    ordered = [s for s in skills if s["id"] not in legacy_ids] + [s for s in skills if s["id"] in legacy_ids]
    for s in ordered:
        keep = []
        for a in s["aliases"]:
            if a in owner and owner[a] != s["id"]:
                if a in LEGACY_KEEPS and s["id"] in legacy_ids:
                    prev = next(x for x in skills if x["id"] == owner[a])
                    prev["aliases"] = [x for x in prev["aliases"] if x != a]
                else:
                    conflicts.append((a, owner[a], s["id"]))
                    continue
            owner[a] = s["id"]
            keep.append(a)
        s["aliases"] = keep
    tax = {
        "version": "2026.10-v3", "frozen_at": date.today().isoformat(),
        "note": "Hard-skill taxonomy for fourteen technical careers. Soft and managerial skills are out of scope because they "
                "cannot be assessed with multiple-choice questions and no course teaches them like a tool or a method.",
        "clusters": CLUSTERS, "clusters_en": CLUSTERS, "skills": skills,
    }
    (SEED_DIR / "taxonomy.json").write_text(json.dumps(tax, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(skills)} skills in {len(CLUSTERS)} clusters; alias conflicts dropped: {conflicts}")


if __name__ == "__main__":
    main()
