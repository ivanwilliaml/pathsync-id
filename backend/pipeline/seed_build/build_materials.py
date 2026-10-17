"""Build the open learning-material catalogue (paper III.A.5).

Each step of a learning path links to 2-3 existing open materials labelled with skill
and difficulty - PathSync points to content, it does not create it. Every URL below is
checked with an HTTP request; unreachable links are dropped from the catalogue.

Run: python -m pipeline.seed_build.build_materials
"""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

import httpx

from pathsync.config import SEED_DIR

# (skill, title, provider, url, difficulty dasar|menengah|lanjut, format video|teks|kursus|latihan, lang, hours)
CANDIDATES = [
    ("sql", "SQLBolt - pelajaran SQL interaktif", "SQLBolt", "https://sqlbolt.com/", "dasar", "latihan", "en", 4),
    ("sql", "Intro to SQL", "Kaggle Learn", "https://www.kaggle.com/learn/intro-to-sql", "dasar", "kursus", "en", 3),
    ("sql", "Intro to SQL: Querying and managing data", "Khan Academy", "https://www.khanacademy.org/computing/computer-programming/sql", "dasar", "video", "en", 5),
    ("sql", "SQL Tutorial for Data Analysis", "Mode", "https://mode.com/sql-tutorial/", "menengah", "teks", "en", 6),
    ("sql", "Advanced SQL", "Kaggle Learn", "https://www.kaggle.com/learn/advanced-sql", "lanjut", "kursus", "en", 4),
    ("sql", "Select Star SQL", "Select Star SQL", "https://selectstarsql.com/", "menengah", "latihan", "en", 4),
    ("statistics", "Statistics and probability", "Khan Academy", "https://www.khanacademy.org/math/statistics-probability", "dasar", "video", "en", 20),
    ("statistics", "Seeing Theory - statistika visual", "Brown University", "https://seeing-theory.brown.edu/", "dasar", "teks", "en", 3),
    ("statistics", "Introductory Statistics 2e (buku terbuka)", "OpenStax", "https://openstax.org/details/books/introductory-statistics-2e", "menengah", "teks", "en", 30),
    ("data_analysis", "Data Analysis with Python", "freeCodeCamp", "https://www.freecodecamp.org/learn/data-analysis-with-python/", "menengah", "kursus", "en", 20),
    ("data_analysis", "Google Data Analytics Professional Certificate (audit)", "Coursera", "https://www.coursera.org/professional-certificates/google-data-analytics", "dasar", "kursus", "en", 40),
    ("data_analysis", "Pandas", "Kaggle Learn", "https://www.kaggle.com/learn/pandas", "menengah", "kursus", "en", 4),
    ("data_visualization", "From Data to Viz - memilih jenis grafik", "data-to-viz.com", "https://www.data-to-viz.com/", "dasar", "teks", "en", 2),
    ("data_visualization", "Fundamentals of Data Visualization (buku terbuka)", "Claus O. Wilke", "https://clauswilke.com/dataviz/", "menengah", "teks", "en", 10),
    ("data_visualization", "Data Visualization", "Kaggle Learn", "https://www.kaggle.com/learn/data-visualization", "menengah", "kursus", "en", 4),
    ("data_visualization", "The Data Visualisation Catalogue", "datavizcatalogue.com", "https://datavizcatalogue.com/", "dasar", "teks", "en", 2),
    ("dashboard_reporting", "Best practices for effective dashboards", "Tableau Help", "https://help.tableau.com/current/pro/desktop/en-us/dashboards_best_practices.htm", "menengah", "teks", "en", 1),
    ("dashboard_reporting", "Get started with Power BI Desktop", "Microsoft Learn", "https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-getting-started", "dasar", "teks", "en", 3),
    ("dashboard_reporting", "Storytelling with Data - blog", "storytelling with data", "https://www.storytellingwithdata.com/blog", "menengah", "teks", "en", 3),
    ("data_cleaning", "Data Cleaning", "Kaggle Learn", "https://www.kaggle.com/learn/data-cleaning", "menengah", "kursus", "en", 4),
    ("data_cleaning", "Top ten ways to clean your data (Excel)", "Microsoft Support", "https://support.microsoft.com/en-us/office/top-ten-ways-to-clean-your-data-2844b620-677c-47a7-ac3e-c2e157d1db19", "dasar", "teks", "en", 2),
    ("data_cleaning", "OpenRefine documentation", "OpenRefine", "https://openrefine.org/docs", "menengah", "teks", "en", 3),
    ("data_modeling", "Understand star schema", "Microsoft Learn", "https://learn.microsoft.com/en-us/power-bi/guidance/star-schema", "menengah", "teks", "en", 2),
    ("data_modeling", "What is an Entity Relationship Diagram (ERD)?", "Lucidchart", "https://www.lucidchart.com/pages/er-diagrams", "dasar", "teks", "en", 1),
    ("data_modeling", "Database Design Course for beginners", "freeCodeCamp (YouTube)", "https://www.youtube.com/watch?v=ztHopE5Wnpc", "dasar", "video", "en", 8),
    ("python_analytics", "Python", "Kaggle Learn", "https://www.kaggle.com/learn/python", "dasar", "kursus", "en", 5),
    ("python_analytics", "Python for Everybody", "py4e.com", "https://www.py4e.com/", "dasar", "kursus", "en", 30),
    ("python_analytics", "Pandas", "Kaggle Learn", "https://www.kaggle.com/learn/pandas", "menengah", "kursus", "en", 4),
    ("kpi_metrics", "What is an OKR? Definition and examples", "What Matters", "https://www.whatmatters.com/faqs/okr-meaning-definition-example", "dasar", "teks", "en", 1),
    ("kpi_metrics", "The North Star Playbook", "Amplitude", "https://amplitude.com/books/north-star", "menengah", "teks", "en", 3),
    ("kpi_metrics", "Key Performance Indicators (KPIs)", "Investopedia", "https://www.investopedia.com/terms/k/kpi.asp", "dasar", "teks", "en", 1),
    ("financial_analysis", "Core finance", "Khan Academy", "https://www.khanacademy.org/economics-finance-domain/core-finance", "dasar", "video", "en", 10),
    ("financial_analysis", "Principles of Accounting, Vol. 1 (buku terbuka)", "OpenStax", "https://openstax.org/details/books/principles-financial-accounting", "menengah", "teks", "en", 30),
    ("financial_analysis", "Financial statements: definition and types", "Investopedia", "https://www.investopedia.com/terms/f/financial-statements.asp", "dasar", "teks", "en", 1),
    ("research_methods", "User interviews 101", "Nielsen Norman Group", "https://www.nngroup.com/articles/user-interviews/", "dasar", "teks", "en", 1),
    ("research_methods", "Survey guidelines", "SurveyMonkey", "https://www.surveymonkey.com/mp/survey-guidelines/", "dasar", "teks", "en", 1),
    ("research_methods", "Research Methods in Psychology (buku terbuka)", "BCcampus Open Textbooks", "https://opentextbc.ca/researchmethods/", "menengah", "teks", "en", 15),
    ("requirements_elicitation", "Stakeholder interviews 101", "Nielsen Norman Group", "https://www.nngroup.com/articles/stakeholder-interviews/", "dasar", "teks", "en", 1),
    ("requirements_elicitation", "Requirements Elicitation: Artifact and Stakeholder Analysis", "Coursera (University of Colorado)", "https://www.coursera.org/learn/requirements-elicitation", "menengah", "kursus", "en", 12),
    ("requirements_elicitation", "What is business analysis?", "IIBA", "https://www.iiba.org/business-analysis/", "dasar", "teks", "en", 1),
    ("requirements_documentation", "User stories with examples and a template", "Atlassian", "https://www.atlassian.com/agile/project-management/user-stories", "dasar", "teks", "en", 1),
    ("requirements_documentation", "Product requirements documents", "Atlassian", "https://www.atlassian.com/agile/product-management/requirements", "menengah", "teks", "en", 1),
    ("requirements_documentation", "User stories and user story examples", "Mountain Goat Software", "https://www.mountaingoatsoftware.com/agile/user-stories", "menengah", "teks", "en", 1),
    ("business_process_modeling", "BPMN tutorial", "Camunda", "https://camunda.com/bpmn/", "menengah", "teks", "en", 3),
    ("business_process_modeling", "What is a flowchart?", "Lucidchart", "https://www.lucidchart.com/pages/what-is-a-flowchart-tutorial", "dasar", "teks", "en", 1),
    ("business_process_modeling", "BPMN specification and resources", "Object Management Group", "https://www.bpmn.org/", "lanjut", "teks", "en", 2),
    ("process_improvement", "What is lean?", "Lean Enterprise Institute", "https://www.lean.org/explore-lean/what-is-lean/", "dasar", "teks", "en", 1),
    ("process_improvement", "Six Sigma definition and resources", "ASQ", "https://asq.org/quality-resources/six-sigma", "menengah", "teks", "en", 2),
    ("process_improvement", "Root cause analysis", "ASQ", "https://asq.org/quality-resources/root-cause-analysis", "dasar", "teks", "en", 1),
    ("system_modeling_uml", "UML use case diagram tutorial", "Lucidchart", "https://www.lucidchart.com/pages/uml-use-case-diagram", "dasar", "teks", "en", 1),
    ("system_modeling_uml", "UML diagrams reference", "uml-diagrams.org", "https://www.uml-diagrams.org/", "menengah", "teks", "en", 4),
    ("system_modeling_uml", "What is a use case diagram?", "Visual Paradigm", "https://www.visual-paradigm.com/guide/uml-unified-modeling-language/what-is-use-case-diagram/", "dasar", "teks", "en", 1),
    ("sdlc", "What is SDLC?", "AWS", "https://aws.amazon.com/what-is/sdlc/", "dasar", "teks", "en", 1),
    ("sdlc", "Software Development Life Cycle (SDLC)", "GeeksforGeeks", "https://www.geeksforgeeks.org/software-development-life-cycle-sdlc/", "dasar", "teks", "en", 1),
    ("agile_scrum", "The Scrum Guide", "Scrum.org", "https://scrumguides.org/scrum-guide.html", "dasar", "teks", "en", 1),
    ("agile_scrum", "Agile Coach", "Atlassian", "https://www.atlassian.com/agile", "dasar", "teks", "en", 3),
    ("agile_scrum", "Manifesto for Agile Software Development", "agilemanifesto.org", "https://agilemanifesto.org/", "dasar", "teks", "en", 1),
    ("testing_uat", "The different types of software testing", "Atlassian", "https://www.atlassian.com/continuous-delivery/software-testing/types-of-software-testing", "dasar", "teks", "en", 1),
    ("testing_uat", "What is user acceptance testing (UAT)?", "TechTarget", "https://www.techtarget.com/searchsoftwarequality/definition/user-acceptance-testing-UAT", "dasar", "teks", "en", 1),
    ("testing_uat", "How to write test cases", "Guru99", "https://www.guru99.com/test-case.html", "menengah", "teks", "en", 1),
    ("stakeholder_management", "What is stakeholder management?", "APM", "https://www.apm.org.uk/resources/what-is-project-management/what-is-stakeholder-management/", "dasar", "teks", "en", 1),
    ("stakeholder_management", "Stakeholder analysis guide", "Asana", "https://asana.com/resources/project-stakeholder", "dasar", "teks", "en", 1),
    ("project_management", "Google Project Management Certificate (audit)", "Coursera", "https://www.coursera.org/professional-certificates/google-project-management", "dasar", "kursus", "en", 40),
    ("project_management", "What is project management?", "PMI", "https://www.pmi.org/about/what-is-project-management", "dasar", "teks", "en", 1),
    ("project_management", "Project management guide", "Atlassian", "https://www.atlassian.com/work-management/project-management", "dasar", "teks", "en", 2),
    ("business_case", "Cost-benefit analysis", "Investopedia", "https://www.investopedia.com/terms/c/cost-benefitanalysis.asp", "dasar", "teks", "en", 1),
    ("business_case", "Return on investment (ROI)", "Investopedia", "https://www.investopedia.com/terms/r/returnoninvestment.asp", "dasar", "teks", "en", 1),
    ("change_management", "The Prosci ADKAR model", "Prosci", "https://www.prosci.com/methodology/adkar", "dasar", "teks", "en", 1),
    ("change_management", "The 8-step process for leading change", "Kotter", "https://www.kotterinc.com/methodology/8-steps/", "menengah", "teks", "en", 1),
    ("strategic_analysis", "SWOT analysis", "Investopedia", "https://www.investopedia.com/terms/s/swot.asp", "dasar", "teks", "en", 1),
    ("strategic_analysis", "Porter's five forces", "Harvard Business School Online", "https://online.hbs.edu/blog/post/what-is-porters-five-forces", "menengah", "teks", "en", 1),
    ("risk_management", "ISO 31000 risk management", "ISO", "https://www.iso.org/iso-31000-risk-management.html", "menengah", "teks", "en", 1),
    ("risk_management", "Risk management: definition and types", "Investopedia", "https://www.investopedia.com/terms/r/riskmanagement.asp", "dasar", "teks", "en", 1),
    ("excel", "Excel video training", "Microsoft Support", "https://support.microsoft.com/en-us/office/excel-video-training-9bc05390-e94c-46af-a5b3-d7c22f6990bb", "dasar", "video", "en", 6),
    ("excel", "Excel tutorials", "GCFGlobal", "https://edu.gcfglobal.org/en/excel/", "dasar", "kursus", "en", 8),
    ("excel", "Exceljet - rumus dan fungsi", "Exceljet", "https://exceljet.net/", "menengah", "teks", "en", 6),
    ("power_bi", "Power BI training", "Microsoft Learn", "https://learn.microsoft.com/en-us/training/powerplatform/power-bi", "dasar", "kursus", "en", 12),
    ("power_bi", "DAX Guide", "SQLBI", "https://dax.guide/", "lanjut", "teks", "en", 4),
    ("power_bi", "Get started with Power BI Desktop", "Microsoft Learn", "https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-getting-started", "dasar", "teks", "en", 3),
    ("tableau", "Free training videos", "Tableau", "https://www.tableau.com/learn/training", "dasar", "video", "en", 6),
    ("tableau", "Get started with Tableau Desktop", "Tableau Help", "https://help.tableau.com/current/guides/get-started-tutorial/en-us/get-started-tutorial-home.htm", "dasar", "teks", "en", 3),
    ("bi_tools_other", "Metabase Learn", "Metabase", "https://www.metabase.com/learn/", "dasar", "teks", "en", 4),
    ("bi_tools_other", "Looker Studio Help", "Google", "https://support.google.com/looker-studio/", "dasar", "teks", "en", 3),
    ("bi_tools_other", "Apache Superset documentation", "Apache", "https://superset.apache.org/docs/intro", "menengah", "teks", "en", 3),
    ("jira_confluence", "Jira guides", "Atlassian", "https://www.atlassian.com/software/jira/guides", "dasar", "teks", "en", 2),
    ("jira_confluence", "Confluence guides", "Atlassian", "https://www.atlassian.com/software/confluence/guides", "dasar", "teks", "en", 2),
    ("diagramming_tools", "draw.io documentation", "draw.io", "https://www.drawio.com/doc/", "dasar", "teks", "en", 2),
    ("diagramming_tools", "What is a flowchart?", "Lucidchart", "https://www.lucidchart.com/pages/what-is-a-flowchart-tutorial", "dasar", "teks", "en", 1),
    ("wireframing", "Wireframing guide", "Balsamiq", "https://balsamiq.com/learn/", "dasar", "teks", "en", 2),
    ("wireframing", "What is wireframing?", "Figma", "https://www.figma.com/resource-library/what-is-wireframing/", "dasar", "teks", "en", 1),
    ("erp_crm", "SAP Learning", "SAP", "https://learning.sap.com/", "menengah", "kursus", "en", 10),
    ("erp_crm", "Odoo eLearning", "Odoo", "https://www.odoo.com/slides", "dasar", "video", "en", 6),
    ("erp_crm", "Trailhead", "Salesforce", "https://trailhead.salesforce.com/", "dasar", "kursus", "en", 6),
    ("cloud_data_platform", "Query a public dataset with the Google Cloud console", "Google Cloud", "https://cloud.google.com/bigquery/docs/quickstarts/query-public-dataset-console", "dasar", "teks", "en", 1),
    ("cloud_data_platform", "Getting started with Snowflake", "Snowflake Docs", "https://docs.snowflake.com/en/user-guide-getting-started", "menengah", "teks", "en", 2),
    ("api_integration", "An overview of HTTP", "MDN Web Docs", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview", "dasar", "teks", "en", 1),
    ("api_integration", "What is an API?", "Postman", "https://www.postman.com/what-is-an-api/", "dasar", "teks", "en", 1),
    ("api_integration", "OpenAPI Specification", "Swagger", "https://swagger.io/specification/", "lanjut", "teks", "en", 2),
    ("presentation_storytelling", "How to speak so that people want to listen", "TED", "https://www.ted.com/talks/julian_treasure_how_to_speak_so_that_people_want_to_listen", "dasar", "video", "en", 1),
    ("presentation_storytelling", "Storytelling with Data - blog", "storytelling with data", "https://www.storytellingwithdata.com/blog", "menengah", "teks", "en", 3),
    ("business_writing", "Technical writing courses", "Google for Developers", "https://developers.google.com/tech-writing", "menengah", "kursus", "en", 6),
    ("business_writing", "Professional and technical writing", "Purdue OWL", "https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/index.html", "dasar", "teks", "en", 3),
    ("business_writing", "Federal plain language guidelines", "PlainLanguage.gov", "https://www.plainlanguage.gov/guidelines/", "dasar", "teks", "en", 2),
    ("verbal_communication", "Improving Communication Skills", "Coursera (Wharton)", "https://www.coursera.org/learn/wharton-communication-skills", "dasar", "kursus", "en", 8),
    ("verbal_communication", "How to speak so that people want to listen", "TED", "https://www.ted.com/talks/julian_treasure_how_to_speak_so_that_people_want_to_listen", "dasar", "video", "en", 1),
    ("facilitation_negotiation", "Negotiation skills articles", "Harvard Program on Negotiation", "https://www.pon.harvard.edu/daily/negotiation-skills-daily/", "menengah", "teks", "en", 2),
    ("facilitation_negotiation", "Team Playbook (workshop plays)", "Atlassian", "https://www.atlassian.com/team-playbook", "dasar", "teks", "en", 2),
    ("facilitation_negotiation", "Facilitation method library", "SessionLab", "https://www.sessionlab.com/library", "menengah", "teks", "en", 2),
    ("english_proficiency", "BBC Learning English", "BBC", "https://www.bbc.co.uk/learningenglish/", "dasar", "video", "en", 20),
    ("english_proficiency", "LearnEnglish", "British Council", "https://learnenglish.britishcouncil.org/", "dasar", "kursus", "en", 20),
    ("critical_thinking", "Root cause analysis", "ASQ", "https://asq.org/quality-resources/root-cause-analysis", "dasar", "teks", "en", 1),
    ("critical_thinking", "Critical thinking (OpenLearn)", "The Open University", "https://www.open.edu/openlearn/education-development/learning/critical-thinking/content-section-0", "dasar", "kursus", "en", 6),
    ("collaboration", "Team Playbook", "Atlassian", "https://www.atlassian.com/team-playbook", "dasar", "teks", "en", 2),
    ("collaboration", "Project Aristotle: what makes a team effective", "Google re:Work", "https://rework.withgoogle.com/intl/en/guides/understanding-team-effectiveness", "dasar", "teks", "en", 1),
    # Indonesian-language classes (Dicoding academies)
    ("sql", "Belajar Dasar Structured Query Language (SQL)", "Dicoding", "https://www.dicoding.com/academies/600-belajar-dasar-structured-query-language-sql", "dasar", "kursus", "id", 20),
    ("data_visualization", "Belajar Dasar Visualisasi Data", "Dicoding", "https://www.dicoding.com/academies/177-belajar-dasar-visualisasi-data", "dasar", "kursus", "id", 15),
    ("data_analysis", "Belajar Fundamental Analisis Data", "Dicoding", "https://www.dicoding.com/academies/555-belajar-fundamental-analisis-data", "menengah", "kursus", "id", 40),
    ("data_analysis", "Belajar Dasar Data Science", "Dicoding", "https://www.dicoding.com/academies/615-belajar-dasar-data-science", "dasar", "kursus", "id", 15),
    ("statistics", "Belajar Matematika untuk Data Science", "Dicoding", "https://www.dicoding.com/academies/831-belajar-matematika-untuk-data-science", "menengah", "kursus", "id", 30),
    ("project_management", "Belajar Dasar Manajemen Proyek", "Dicoding", "https://www.dicoding.com/academies/570-belajar-dasar-manajemen-proyek", "dasar", "kursus", "id", 15),
    ("python_analytics", "Memulai Pemrograman dengan Python", "Dicoding", "https://www.dicoding.com/academies/86-memulai-pemrograman-dengan-python", "dasar", "kursus", "id", 30),
    ("data_cleaning", "Belajar Fundamental Pemrosesan Data", "Dicoding", "https://www.dicoding.com/academies/708-belajar-fundamental-pemrosesan-data", "menengah", "kursus", "id", 30),
    ("wireframing", "Belajar Dasar UX Design", "Dicoding", "https://www.dicoding.com/academies/335-belajar-dasar-ux-design", "dasar", "kursus", "id", 20),
    ("cloud_data_platform", "Belajar Dasar Google Cloud", "Dicoding", "https://www.dicoding.com/academies/337-belajar-dasar-google-cloud", "dasar", "kursus", "id", 15),
    ("api_integration", "Belajar Membangun Arsitektur Microservices", "Dicoding", "https://www.dicoding.com/academies/433-belajar-membangun-arsitektur-microservices", "lanjut", "kursus", "id", 40),
    # replacements for pages behind paywalls / moved
    ("business_case", "What is a business case?", "APM", "https://www.apm.org.uk/resources/what-is-project-management/what-is-a-business-case/", "dasar", "teks", "en", 1),
    ("business_case", "Cost-benefit analysis", "Corporate Finance Institute", "https://corporatefinanceinstitute.com/resources/accounting/cost-benefit-analysis", "menengah", "teks", "en", 1),
    ("strategic_analysis", "SWOT analysis", "MindTools", "https://www.mindtools.com/a4wo118/swot-analysis/", "dasar", "teks", "en", 1),
    ("strategic_analysis", "Business Analysis & Process Management (guided project)", "Coursera", "https://www.coursera.org/projects/business-analysis-process-management", "menengah", "latihan", "en", 2),
    ("risk_management", "What is risk management?", "APM", "https://www.apm.org.uk/resources/what-is-project-management/what-is-risk-management/", "dasar", "teks", "en", 1),
    ("diagramming_tools", "draw.io documentation", "draw.io", "https://www.drawio.com/docs/", "dasar", "teks", "en", 2),
    ("diagramming_tools", "Flowchart maker and templates", "Miro", "https://miro.com/flowchart/", "dasar", "teks", "en", 1),
    ("facilitation_negotiation", "Negotiation skills (daily articles)", "Harvard Program on Negotiation", "https://www.pon.harvard.edu/category/daily/negotiation-skills-daily/", "menengah", "teks", "en", 2),
    ("requirements_documentation", "BABOK Guide overview", "IIBA", "https://www.iiba.org/career-resources/a-business-analysis-professionals-foundation-for-success/babok/", "lanjut", "teks", "en", 2),
]

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"}


def check(url: str) -> tuple[str, int]:
    try:
        with httpx.Client(headers=UA, follow_redirects=True, timeout=25) as c:
            r = c.get(url)
            return url, r.status_code
    except httpx.HTTPError:
        return url, 0


def main():
    urls = sorted({c[3] for c in CANDIDATES})
    with ThreadPoolExecutor(max_workers=8) as ex:
        status = dict(ex.map(check, urls))
    items, dropped = [], []
    for i, (skill, title, provider, url, diff, fmt, lang, hours) in enumerate(CANDIDATES):
        st = status.get(url, 0)
        rec = {"id": f"m{i + 1:03d}", "skill_id": skill, "title": title, "provider": provider, "url": url,
               "difficulty": diff, "format": fmt, "language": lang, "hours": hours, "http_status": st}
        # 200 = verified; 403/429 = bot protection on a known provider page (kept, flagged unverified)
        if st == 200:
            rec["verified"] = True
            items.append(rec)
        elif st in (403, 429, 999):
            rec["verified"] = False
            items.append(rec)
        else:
            dropped.append((url, st))
    (SEED_DIR / "materials.json").write_text(json.dumps({"materials": items}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"kept {len(items)} materials ({sum(m['verified'] for m in items)} verified 200), dropped {len(dropped)}")
    for u, st in dropped:
        print("  DROPPED", st, u)
    for m in items:
        if not m["verified"]:
            print("  UNVERIFIED", m["http_status"], m["url"])


if __name__ == "__main__":
    main()
