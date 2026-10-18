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
    "management": "Management & Operations",
}

CATALOG: list[Role] = [
    Role("data_engineer", "Data Engineer", "data",
         "Builds the pipelines and warehouses that analysts and ML models depend on.",
         r"data\s+engineer|big\s+data|etl\s+(?:developer|engineer)|data\s+warehouse|analytics\s+engineer|data\s+platform",
         ("data engineer", "big data", "etl developer", "analytics engineer", "data warehouse", "etl", "data pipeline", "big data engineer")),
    Role("data_scientist", "Data Scientist / ML Engineer", "data",
         "Turns data into predictive models and ships machine-learning features.",
         r"data\s+scien|machine\s+learning|\bml\s+engineer|\bai\s+(?:engineer|developer|specialist)|deep\s+learning|"
         r"computer\s+vision|\bnlp\b|artificial\s+intelligence",
         ("data scientist", "machine learning", "ai engineer", "ml engineer", "artificial intelligence", "data science", "machine learning engineer", "nlp engineer", "computer vision")),
    Role("data_analyst", "Data Analyst", "data",
         "Answers business questions with SQL, statistics and dashboards.",
         r"data\s+analy[sz]|data\s+analis|analis\s+data|\bbi\s+(?:analyst|developer|specialist)|business\s+intelligence|"
         r"reporting\s+analyst|insight[s]?\s+(?:analyst|associate)|customer\s+insight|product\s+analyst|"
         r"analytics\s+(?:analyst|specialist|associate)|digital\s+analyst|\bmis\s+(?:analyst|staff|officer|specialist)|"
         r"data\s*(?:&|and)\s*reporting|data\s+insight",
         ("data analyst", "business intelligence", "product analyst", "reporting analyst", "analis data", "power bi", "data analytics", "bi developer", "tableau", "dashboard analyst"),
         ("data_analyst",),
         exclude=r"head\s+of|manager\s+of"),
    Role("business_analyst", "Business Analyst", "business",
         "Turns business needs into requirements, process models and system changes.",
         r"business\s+(?:[\w&/-]+\s+){0,3}analy[sz]|businessanalyst|analis\s+bisnis|\bit\s*ba\b|\bba\s*(?:-|–|\(|$)|"
         r"\bbusiness\s+analysis\b|^business\s+process\b|system[s]?\s+analy[sz]|analis\s+sistem|"
         r"functional\s+(?:analyst|consultant)|requirement[s]?\s+analyst|process\s+analyst|solution[s]?\s+analyst",
         ("business analyst", "system analyst", "business process analyst", "functional analyst", "analis bisnis", "analis sistem", "it business analyst", "functional consultant", "requirements analyst"),
         ("business_analyst", "ict_business_analyst")),
    Role("cybersecurity_analyst", "Cybersecurity Analyst", "infra",
         "Monitors, tests and hardens systems against attacks.",
         r"cyber|security\s+(?:analyst|engineer|specialist|operation)|information\s+security|infosec|\bsoc\b|penetration|"
         r"pentest|\bgrc\b|it\s+security|keamanan\s+(?:siber|informasi)",
         ("cyber security", "security analyst", "information security", "soc analyst", "penetration tester", "cybersecurity", "keamanan siber", "vulnerability", "grc"),
         exclude=r"security\s+(?:guard|officer\s+building)|satpam"),
    Role("devops_engineer", "DevOps / Cloud Engineer", "infra",
         "Automates deployment and runs reliable cloud infrastructure.",
         r"devops|dev\s*ops|\bsre\b|site\s+reliability|cloud\s+(?:engineer|architect|specialist|administrator)|"
         r"platform\s+engineer|infrastructure\s+engineer|devsecops|kubernetes",
         ("devops", "cloud engineer", "site reliability engineer", "infrastructure engineer", "platform engineer", "devsecops", "kubernetes", "cloud administrator")),
    Role("qa_engineer", "QA / Software Tester", "software",
         "Designs test cases and automates tests so releases do not break.",
         r"\bqa\b|quality\s+assurance\s+(?:engineer|analyst|tester|automation|software)|software\s+(?:tester|test)|"
         r"test(?:ing)?\s+(?:engineer|analyst|automation)|\btester\b|\bsdet\b|automation\s+test",
         ("quality assurance engineer", "software tester", "qa engineer", "qa automation", "test engineer", "qa", "tester", "sdet", "automation tester"),
         exclude=r"food|pangan|produksi|production|manufactur|pabrik|garment|textile|laborator|\bqc\b|quality\s+control"),
    Role("mobile_developer", "Mobile Developer", "software",
         "Builds Android, iOS or cross-platform apps.",
         r"mobile\s+(?:developer|engineer|programmer|apps?)|android|\bios\s+(?:developer|engineer)|flutter|react\s+native|"
         r"kotlin|swift\s+developer",
         ("mobile developer", "android developer", "ios developer", "flutter", "react native", "android", "ios", "kotlin", "mobile engineer")),
    Role("fullstack_developer", "Full-Stack Developer", "software",
         "Ships features end to end, from database to user interface.",
         r"full[\s-]*stack|fullstack",
         ("full stack developer", "fullstack developer", "full stack engineer", "fullstack", "full stack web developer", "mern")),
    Role("frontend_developer", "Front-End Developer", "software",
         "Builds the web interfaces people use, with HTML, CSS, JavaScript and React.",
         r"front[\s-]*end|frontend|web\s+(?:developer|programmer|engineer)|react(?:\.?js)?\s+developer|"
         r"vue(?:\.?js)?\s+developer|angular\s+developer|ui\s+(?:developer|engineer)|wordpress\s+developer",
         ("frontend developer", "front end developer", "web developer", "react developer", "web programmer", "frontend engineer", "javascript developer", "vue developer", "angular developer")),
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
         r"user\s+interface\s+designer|ux\s+(?:writer|researcher)|desainer\s+(?:ui|ux|produk)|designer\s+ui",
         ("ui ux designer", "ui/ux", "product designer", "ux researcher", "ui designer", "desainer ui ux", "ux designer", "web designer", "user experience")),
    Role("digital_marketing", "Digital Marketing Specialist", "marketing",
         "Grows customers through SEO, ads, email and marketing analytics.",
         r"digital\s+marketing|performance\s+marketing|\bseo\b|\bsem\b|growth\s+(?:marketing|hacker|marketer)|"
         r"marketing\s+(?:digital|online|specialist|executive|analyst|communication)|ads?\s+specialist|"
         r"e-?commerce\s+(?:specialist|marketing|executive)|crm\s+(?:specialist|marketing)|marketplace\s+specialist|"
         r"social\s+media\s+(?:specialist|ads|executive|marketing)",
         ("digital marketing", "performance marketing", "seo specialist", "marketing specialist", "ecommerce specialist",
          "social media specialist"),
         exclude=r"field\s+sales|sales\s+(?:executive|staff)|\bsales\b\s*$"),
    Role("financial_analyst", "Financial Analyst", "finance",
         "Models company finances, forecasts results and supports investment and budgeting decisions.",
         r"financial\s+analy[sz]|finance\s+analy[sz]|fp\s*&\s*a|\bfpa\b|analis\s+keuangan|investment\s+analy[sz]|credit\s+analy[sz]|"
         r"treasury\s+(?:analyst|staff|officer)|corporate\s+finance|business\s+finance|financial\s+planning|financial\s+model",
         ("financial analyst", "finance analyst", "fp&a", "analis keuangan", "investment analyst", "credit analyst", "corporate finance"),
         exclude=r"account\s+executive|sales"),
    Role("tax_specialist", "Tax Specialist", "finance",
         "Calculates, withholds and reports Indonesian taxes (PPh, PPN) and keeps the company compliant.",
         r"\btax\b|taxation|staff\s+pajak|staf\s+pajak|perpajakan|\bpajak\b|pph\s*21|\bppn\b",
         ("tax staff", "tax specialist", "tax accountant", "tax analyst", "staff pajak", "perpajakan", "tax officer"),
         exclude=r"tax\s+collector"),
    Role("internal_auditor", "Internal Auditor & Risk", "finance",
         "Tests controls, audits processes and assesses risk so management can trust the numbers.",
         r"auditor|internal\s+audit|audit\s+(?:staff|officer|associate|senior|junior|assistant)|risk\s+(?:analy[sz]t|officer|management|staff|assurance)|"
         r"compliance\s+(?:officer|analy[sz]t|staff)|manajemen\s+risiko|audit\s+internal",
         ("internal auditor", "auditor", "audit staff", "risk analyst", "risk management", "compliance officer", "internal audit"),
         exclude=r"\bk3\b|\bhse\b|quality\s+auditor|iso\s*\d+|food\s+safety|halal|smk3|mutu"),
    Role("hr_specialist", "HR Specialist", "management",
         "Runs recruitment, payroll, BPJS, employee records and people reporting.",
         r"\bhr\b|\bhrd\b|\bhris\b|human\s+(?:resource|capital)|recruit(?:er|ment)|talent\s+(?:acquisition|management)|payroll|"
         r"compensation\s*(?:&|and)\s*benefit|\bc\s*&\s*b\b|people\s+(?:operations|partner|analytics)|learning\s*(?:&|and)\s*development|"
         r"sumber\s+daya\s+manusia|personalia|kepegawaian|hubungan\s+industrial|industrial\s+relation",
         ("hr staff", "hr generalist", "recruiter", "payroll", "talent acquisition", "human resources", "hrd", "hr officer",
          "compensation and benefits", "learning and development", "hris"),
         exclude=r"hr[\s-]*tech\s+sales|sales"),
    Role("supply_chain_analyst", "Supply Chain & Operations Analyst", "management",
         "Plans demand, inventory and purchasing, and keeps operations flowing with ERP data.",
         r"supply\s+chain|procurement|purchasing|inventory|demand\s+plan|logistic[s]?\s+(?:analyst|staff|officer|coordinator|admin|planner)|"
         r"warehouse\s+(?:staff|admin|analyst|coordinator|planner)|operations?\s+(?:analyst|staff|coordinator|specialist|planner)|"
         r"production\s+planning|\bppic\b|\bsourcing\b|vendor\s+management|admin\s+gudang|pengadaan|material\s+planner",
         ("supply chain", "procurement", "purchasing staff", "inventory control", "logistics analyst", "demand planner", "ppic",
          "operations analyst", "warehouse admin", "sourcing specialist"),
         exclude=r"driver|courier|kurir|picker|packer|operator|mechanic|teknisi|loader|helper|sales"),
    Role("project_coordinator", "Product / Project Coordinator", "management",
         "Plans scope, schedules and backlogs, tracks delivery and reports progress to stakeholders.",
         r"project\s+(?:coordinator|administrator|admin|officer|assistant|analy[sz]t|controller|manager)|\bpmo\b|"
         r"product\s+(?:coordinator|owner|operations|assistant|manager)|program\s+(?:coordinator|officer)|scrum\s+master|"
         r"delivery\s+(?:coordinator|lead)|koordinator\s+proyek",
         ("project coordinator", "project administrator", "project manager", "product owner", "product manager", "pmo",
          "scrum master", "program coordinator"),
         exclude=r"construction|konstruksi|civil|sipil|mep|site\s+engineer|interior|marketing\s+project"),
    Role("accountant", "Accountant / Finance Staff", "finance",
         "Records transactions, prepares financial statements and handles tax.",
         r"accounting|accountant|akuntan|akuntansi|finance\s+(?:staff|officer|admin|accounting|executive)|"
         r"account\s+(?:payable|receivable)|\bap\b\s*/?\s*ar|staff\s+keuangan|admin\s+keuangan|finance\s*&\s*accounting",
         ("akuntan", "accounting staff", "finance staff"),
         exclude=r"account\s+(?:executive|manager|officer\s+sales)|key\s+account"),
]

FAMILIES_ID = {
    "data": "Data & AI",
    "software": "Rekayasa Perangkat Lunak",
    "infra": "Infrastruktur & Keamanan",
    "design": "Produk & Desain",
    "business": "Bisnis & Analisis",
    "marketing": "Pemasaran",
    "finance": "Keuangan & Akuntansi",
    "management": "Manajemen & Operasi",
}

BLURB_ID = {
    "data_engineer": "Membangun pipeline dan gudang data yang dibutuhkan analis dan model ML.",
    "data_scientist": "Mengubah data menjadi model prediktif dan merilis fitur machine learning.",
    "data_analyst": "Menjawab pertanyaan bisnis dengan SQL, statistik, dan dasbor.",
    "business_analyst": "Menerjemahkan kebutuhan bisnis menjadi requirement, model proses, dan perubahan sistem.",
    "cybersecurity_analyst": "Memantau, menguji, dan memperkuat sistem terhadap serangan.",
    "devops_engineer": "Mengotomatiskan deployment dan menjalankan infrastruktur cloud yang andal.",
    "qa_engineer": "Merancang kasus uji dan mengotomatiskan tes supaya rilis tidak rusak.",
    "mobile_developer": "Membangun aplikasi Android, iOS, atau lintas platform.",
    "fullstack_developer": "Menyelesaikan fitur dari ujung ke ujung, dari database sampai antarmuka pengguna.",
    "frontend_developer": "Membangun antarmuka web yang dipakai orang, dengan HTML, CSS, JavaScript, dan React.",
    "backend_developer": "Menulis kode sisi server, API, dan database di balik aplikasi.",
    "ui_ux_designer": "Meneliti pengguna dan merancang layar produk yang mudah dipakai dan enak dilihat.",
    "digital_marketing": "Menumbuhkan pelanggan lewat SEO, iklan, email, dan analitik pemasaran.",
    "financial_analyst": "Memodelkan keuangan perusahaan, memproyeksikan hasil, dan mendukung keputusan investasi dan anggaran.",
    "tax_specialist": "Menghitung, memotong, dan melaporkan pajak Indonesia (PPh, PPN) agar perusahaan patuh.",
    "internal_auditor": "Menguji kontrol, mengaudit proses, dan menilai risiko supaya manajemen bisa memercayai angka.",
    "hr_specialist": "Menjalankan rekrutmen, payroll, BPJS, data karyawan, dan pelaporan SDM.",
    "supply_chain_analyst": "Merencanakan permintaan, persediaan, dan pembelian, serta menjaga operasi tetap lancar dengan data ERP.",
    "project_coordinator": "Merencanakan ruang lingkup, jadwal, dan backlog, memantau pengiriman, dan melaporkan progres ke pemangku kepentingan.",
    "accountant": "Mencatat transaksi, menyusun laporan keuangan, dan menangani pajak.",
}

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
    "financial_analyst": ("corp_finance", "financial_analysis", "budgeting_forecasting", "financial_statements", "accounting_fundamentals", "excel", "power_bi", "sql", "data_visualization", "kpi_metrics"),
    "tax_specialist": ("tax", "tax_compliance_id", "accounting_fundamentals", "financial_statements", "accounting_software", "excel", "erp_crm"),
    "internal_auditor": ("audit_risk", "audit_internal_control", "financial_statements", "accounting_fundamentals", "excel", "sql", "data_analysis", "erp_crm"),
    "hr_specialist": ("hr", "excel", "power_bi", "data_analysis", "dashboard_reporting", "kpi_metrics"),
    "supply_chain_analyst": ("supply_chain", "excel", "erp_crm", "sql", "power_bi", "data_analysis", "dashboard_reporting", "kpi_metrics", "cost_accounting"),
    "project_coordinator": ("product_project", "jira_confluence", "kpi_metrics", "excel", "data_analysis", "requirements_elicitation", "diagramming_tools", "web_analytics"),
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
