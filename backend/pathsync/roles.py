"""Role catalogue: the hard-skill careers PathSync supports.

Each role carries the title patterns that decide which scraped postings count as that role (paper III.C.1 "sebutan
setara"), the search keywords used on every source, and the ESCO occupations (where fetched) that ground the
taxonomy. Roles are matched in list order, so more specific titles come first (e.g. "data engineer" before
"software engineer", "UI/UX" before "graphic designer").

Only technical, teachable skills are modelled. Soft skills are deliberately out of scope: they cannot be assessed with
multiple-choice questions and there is no course that teaches them in the way a tool or a method is taught.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Role:
    id: str
    name: str
    family: str
    blurb: str
    include: str
    keywords: tuple[str, ...]
    esco: tuple[str, ...] = ()
    exclude: str = ""
    pattern: re.Pattern = field(init=False, repr=False, compare=False)
    anti: re.Pattern | None = field(init=False, repr=False, compare=False)

    def __post_init__(self):
        object.__setattr__(self, "pattern", re.compile(self.include, re.I))
        object.__setattr__(self, "anti", re.compile(self.exclude, re.I) if self.exclude else None)

    def matches(self, title: str) -> bool:
        return bool(self.pattern.search(title)) and not (self.anti and self.anti.search(title))


FAMILIES = {
    "data": "Data & AI",
    "software": "Software Engineering",
    "infra": "Infrastructure & Security",
    "design": "Product & Design",
    "business": "Business & Analysis",
    "marketing": "Marketing",
    "finance": "Finance & Accounting",
}

CATALOG: list[Role] = [
    Role("data_engineer", "Data Engineer", "data",
         "Builds the pipelines and warehouses that analysts and ML models depend on.",
         r"data\s+engineer|big\s+data|etl\s+(?:developer|engineer)|data\s+warehouse|analytics\s+engineer|data\s+platform",
         ("data engineer", "big data", "etl developer", "analytics engineer", "data warehouse")),
    Role("data_scientist", "Data Scientist / ML Engineer", "data",
         "Turns data into predictive models and ships machine-learning features.",
         r"data\s+scien|machine\s+learning|\bml\s+engineer|\bai\s+(?:engineer|developer|specialist)|deep\s+learning|"
         r"computer\s+vision|\bnlp\b|artificial\s+intelligence",
         ("data scientist", "machine learning", "ai engineer", "ml engineer", "artificial intelligence")),
    Role("data_analyst", "Data Analyst", "data",
         "Answers business questions with SQL, statistics and dashboards.",
         r"data\s+analy[sz]|data\s+analis|analis\s+data|\bbi\s+(?:analyst|developer|specialist)|business\s+intelligence|"
         r"reporting\s+analyst|insight[s]?\s+(?:analyst|associate)|customer\s+insight|product\s+analyst|"
         r"analytics\s+(?:analyst|specialist|associate)|digital\s+analyst|\bmis\s+(?:analyst|staff|officer|specialist)|"
         r"data\s*(?:&|and)\s*reporting|data\s+insight",
         ("data analyst", "business intelligence", "product analyst", "reporting analyst", "analis data", "power bi"),
         ("data_analyst",),
         exclude=r"head\s+of|manager\s+of"),
    Role("business_analyst", "Business Analyst", "business",
         "Turns business needs into requirements, process models and system changes.",
         r"business\s+(?:[\w&/-]+\s+){0,3}analy[sz]|businessanalyst|analis\s+bisnis|\bit\s*ba\b|\bba\s*(?:-|–|\(|$)|"
         r"\bbusiness\s+analysis\b|^business\s+process\b|system[s]?\s+analy[sz]|analis\s+sistem|"
         r"functional\s+(?:analyst|consultant)|requirement[s]?\s+analyst|process\s+analyst|solution[s]?\s+analyst",
         ("business analyst", "system analyst", "business process analyst", "functional analyst", "analis bisnis"),
         ("business_analyst", "ict_business_analyst")),
    Role("cybersecurity_analyst", "Cybersecurity Analyst", "infra",
         "Monitors, tests and hardens systems against attacks.",
         r"cyber|security\s+(?:analyst|engineer|specialist|operation)|information\s+security|infosec|\bsoc\b|penetration|"
         r"pentest|\bgrc\b|it\s+security|keamanan\s+(?:siber|informasi)",
         ("cyber security", "security analyst", "information security", "soc analyst", "penetration tester"),
         exclude=r"security\s+(?:guard|officer\s+building)|satpam"),
    Role("devops_engineer", "DevOps / Cloud Engineer", "infra",
         "Automates deployment and runs reliable cloud infrastructure.",
         r"devops|dev\s*ops|\bsre\b|site\s+reliability|cloud\s+(?:engineer|architect|specialist|administrator)|"
         r"platform\s+engineer|infrastructure\s+engineer|devsecops|kubernetes",
         ("devops", "cloud engineer", "site reliability engineer", "infrastructure engineer", "platform engineer")),
    Role("qa_engineer", "QA / Software Tester", "software",
         "Designs test cases and automates tests so releases do not break.",
         r"\bqa\b|quality\s+assurance\s+(?:engineer|analyst|tester|automation|software)|software\s+(?:tester|test)|"
         r"test(?:ing)?\s+(?:engineer|analyst|automation)|\btester\b|\bsdet\b|automation\s+test",
         ("quality assurance engineer", "software tester", "qa engineer", "qa automation", "test engineer"),
         exclude=r"food|pangan|produksi|production|manufactur|pabrik|garment|textile|laborator|\bqc\b|quality\s+control"),
    Role("mobile_developer", "Mobile Developer", "software",
         "Builds Android, iOS or cross-platform apps.",
         r"mobile\s+(?:developer|engineer|programmer|apps?)|android|\bios\s+(?:developer|engineer)|flutter|react\s+native|"
         r"kotlin|swift\s+developer",
         ("mobile developer", "android developer", "ios developer", "flutter", "react native")),
    Role("fullstack_developer", "Full-Stack Developer", "software",
         "Ships features end to end, from database to user interface.",
         r"full[\s-]*stack|fullstack",
         ("full stack developer", "fullstack developer", "full stack engineer")),
    Role("frontend_developer", "Front-End Developer", "software",
         "Builds the web interfaces people use, with HTML, CSS, JavaScript and React.",
         r"front[\s-]*end|frontend|web\s+(?:developer|programmer|engineer)|react(?:\.?js)?\s+developer|"
         r"vue(?:\.?js)?\s+developer|angular\s+developer|ui\s+(?:developer|engineer)|wordpress\s+developer",
         ("frontend developer", "front end developer", "web developer", "react developer", "web programmer")),
    Role("backend_developer", "Back-End / Software Engineer", "software",
         "Writes the server-side code, APIs and databases behind applications.",
         r"back[\s-]*end|backend|software\s+(?:engineer|developer|programmer)|programmer|"
         r"(?:java|golang|go|php|python|node(?:\.?js)?|\.net|laravel|ruby|c#)\s+(?:developer|engineer|programmer)|"
         r"application\s+developer|it\s+developer|pengembang\s+perangkat\s+lunak",
         ("backend developer", "software engineer", "programmer", "java developer", "golang developer", "php developer",
          "software developer"),
         exclude=r"plc|embedded|firmware|cnc|mechanical|electrical\s+engineer"),
    Role("ui_ux_designer", "UI/UX Designer", "design",
         "Researches users and designs usable, good-looking product screens.",
         r"ui\s*/?\s*ux|ux\s*/?\s*ui|\bux\b|user\s+experience|product\s+designer|ui\s+designer|interaction\s+designer|"
         r"user\s+interface\s+designer|ux\s+(?:writer|researcher)",
         ("ui ux designer", "ui/ux", "product designer", "ux researcher", "ui designer")),
    Role("digital_marketing", "Digital Marketing Specialist", "marketing",
         "Grows customers through SEO, ads, email and marketing analytics.",
         r"digital\s+marketing|performance\s+marketing|\bseo\b|\bsem\b|growth\s+(?:marketing|hacker|marketer)|"
         r"marketing\s+(?:digital|online|specialist|executive|analyst|communication)|ads?\s+specialist|"
         r"e-?commerce\s+(?:specialist|marketing|executive)|crm\s+(?:specialist|marketing)|marketplace\s+specialist|"
         r"social\s+media\s+(?:specialist|ads|executive|marketing)",
         ("digital marketing", "performance marketing", "seo specialist", "marketing specialist", "ecommerce specialist",
          "social media specialist"),
         exclude=r"field\s+sales|sales\s+(?:executive|staff)|\bsales\b\s*$"),
    Role("accountant", "Accountant / Finance Staff", "finance",
         "Records transactions, prepares financial statements and handles tax.",
         r"accounting|accountant|akuntan|akuntansi|finance\s+(?:staff|officer|admin|accounting|executive|analyst)|"
         r"financial\s+analyst|tax\s+(?:staff|officer|specialist|accountant)|staff\s+pajak|perpajakan|"
         r"account\s+(?:payable|receivable)|\bap\b\s*/?\s*ar|auditor|staff\s+keuangan|admin\s+keuangan|finance\s*&\s*accounting",
         ("akuntan", "accounting staff", "finance staff", "tax staff", "auditor", "financial analyst"),
         exclude=r"account\s+(?:executive|manager|officer\s+sales)|key\s+account"),
]

ROLE_BY_ID = {r.id: r for r in CATALOG}

# Taxonomy clusters (or single skill ids) a role's market map may contain; "-skill_id" removes one. Without a scope a skill
# like "reporting" or "documentation" would show up for every career just because the word is common in postings.
SCOPE: dict[str, tuple[str, ...]] = {
    "data_engineer": ("data_eng", "data_analytics", "backend", "devops", "-api_integration", "-rest_api_design", "-java_spring", "-php_laravel", "-dotnet_csharp", "-golang_backend", "-nodejs_backend", "-python_backend"),
    "data_scientist": ("data_ml", "data_analytics", "data_eng", "backend", "devops", "-api_integration", "-java_spring", "-php_laravel", "-dotnet_csharp", "-golang_backend", "-nodejs_backend"),
    "data_analyst": ("data_analytics", "bi_tools", "data_eng", "python_programming", "git_version_control"),
    "business_analyst": ("business_analysis", "data_analytics", "bi_tools", "testing_uat", "wireframing", "api_integration", "rest_api_design"),
    "cybersecurity_analyst": ("security", "devops", "python_programming", "-kubernetes", "-infrastructure_as_code", "-web_servers_proxies"),
    "devops_engineer": ("devops", "security", "git_version_control", "python_programming", "-network_security", "-siem_monitoring", "-penetration_testing", "-incident_response_forensics", "-cryptography_basics", "-security_frameworks_compliance"),
    "qa_engineer": ("testing", "data_analytics", "git_version_control", "unit_testing_tdd", "rest_api_design", "python_programming", "java_spring", "javascript", "-data_visualization", "-dashboard_reporting", "-statistics", "-data_cleaning", "-kpi_metrics", "-data_modeling"),
    "mobile_developer": ("mobile", "backend", "testing", "-java_spring", "-php_laravel", "-dotnet_csharp", "-golang_backend", "-nodejs_backend", "-python_backend", "-api_integration", "-test_automation_web", "-performance_testing", "-ci_for_testing", "-test_design_techniques"),
    "fullstack_developer": ("web_frontend", "backend", "devops", "sql", "-api_integration", "-dotnet_csharp", "-golang_backend", "-cms_wordpress"),
    "frontend_developer": ("web_frontend", "git_version_control", "rest_api_design", "accessibility_design", "figma_design_tools", "-nodejs_backend"),
    "backend_developer": ("backend", "devops", "sql", "unit_testing_tdd", "-api_integration", "-monitoring_observability", "-networking_fundamentals", "-web_servers_proxies", "-infrastructure_as_code", "-kubernetes"),
    "ui_ux_designer": ("design", "html_css", "responsive_accessible_web", "web_analytics"),
    "digital_marketing": ("marketing", "figma_design_tools", "visual_design_fundamentals", "excel", "kpi_metrics", "erp_crm", "data_analysis", "data_visualization", "dashboard_reporting", "cms_wordpress", "html_css"),
    "accountant": ("finance", "excel", "data_analysis", "dashboard_reporting", "erp_crm", "power_bi", "sql"),
}


def skill_ids_for_role(role_id: str, skills: dict) -> list[str]:
    """Taxonomy skills that belong in a role's market map."""
    scope = SCOPE.get(role_id)
    if not scope:
        return list(skills)
    add = {e for e in scope if not e.startswith("-")}
    drop = {e[1:] for e in scope if e.startswith("-")}
    return [sid for sid, sk in skills.items() if (sk.cluster in add or sid in add) and sid not in drop]

# Never a target role even when a pattern above matches: leadership titles and non-professional jobs.
GLOBAL_EXCLUDE = re.compile(
    r"\b(?:head|vp|vice\s+president|director|chief|manager\s+of)\b|intern\s+teacher|driver|kurir|courier|security\s+guard|"
    r"satpam|cleaning", re.I)


def classify_role(title: str) -> str | None:
    t = (title or "").strip()
    if not t or GLOBAL_EXCLUDE.search(t):
        return None
    for r in CATALOG:
        if r.matches(t):
            return r.id
    return None


def all_keywords() -> list[str]:
    seen, out = set(), []
    for r in CATALOG:
        for k in r.keywords:
            if k not in seen:
                seen.add(k)
                out.append(k)
    return out
