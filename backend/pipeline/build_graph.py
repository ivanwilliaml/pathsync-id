"""Build data/seed/graph.json (draft prerequisite edges for the hard-skill taxonomy v3).

Keeps the legacy edges whose two skills still exist and adds the edges of the new careers. An edge A -> B says that
learning A first makes B much easier (the engine treats B as not ready until A is at least 0.6). Edges stay drafts until
the expert panel validates them (paper III.A.3). Run: python -m pipeline.build_graph
"""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR
from pathsync.taxonomy import CycleError, SkillGraph, load_skills

NEW_EDGES = [
    # web front end
    ("html_css", "javascript", "The DOM that JavaScript manipulates is built from HTML and styled with CSS."),
    ("html_css", "responsive_accessible_web", "Responsive and accessible design is applied through HTML structure and CSS."),
    ("html_css", "cms_wordpress", "Themes and page builders assume HTML and CSS knowledge."),
    ("html_css", "web_performance", "Page speed work starts from how markup, styles and assets are delivered."),
    ("javascript", "typescript", "TypeScript is JavaScript with types, so JavaScript comes first."),
    ("javascript", "react", "React components are written in JavaScript."),
    ("javascript", "frontend_frameworks_other", "Vue, Angular and Svelte are JavaScript or TypeScript frameworks."),
    ("javascript", "nodejs_backend", "Node.js runs JavaScript on the server."),
    ("javascript", "web_performance", "Bundling, lazy loading and runtime cost are JavaScript topics."),
    ("react", "react_native", "React Native reuses React concepts for mobile."),
    ("react", "frontend_testing", "Component tests target React or similar components."),
    ("javascript", "frontend_testing", "Front-end tests are written in JavaScript."),
    # programming and back end
    ("programming_fundamentals", "data_structures_algorithms", "Data structures are implemented with basic programming constructs."),
    ("programming_fundamentals", "python_programming", "General programming ideas make a first language easier."),
    ("programming_fundamentals", "java_spring", "Spring builds on Java and object-oriented design."),
    ("programming_fundamentals", "php_laravel", "Laravel builds on PHP and object-oriented design."),
    ("programming_fundamentals", "golang_backend", "Go builds on core programming concepts."),
    ("programming_fundamentals", "dotnet_csharp", "C# is an object-oriented language."),
    ("programming_fundamentals", "unit_testing_tdd", "Tests are written against functions and classes."),
    ("programming_fundamentals", "rest_api_design", "Building APIs needs working code in some language."),
    ("python_programming", "python_backend", "Django, FastAPI and Flask are Python frameworks."),
    ("python_programming", "python_analytics", "pandas and NumPy are Python libraries."),
    ("rest_api_design", "auth_security_basics", "Authentication protects the endpoints of an API."),
    ("rest_api_design", "api_testing", "API tests call and check HTTP endpoints."),
    ("rest_api_design", "mobile_backend_services", "Mobile apps consume back-end APIs."),
    ("rest_api_design", "system_design_architecture", "Service boundaries are defined through their APIs."),
    ("sql", "nosql_databases", "Relational concepts make it clear when a NoSQL store fits."),
    ("nosql_databases", "caching_messaging", "Redis is both a NoSQL store and the most common cache."),
    ("rest_api_design", "caching_messaging", "Caching and queues sit behind API endpoints."),
    ("caching_messaging", "system_design_architecture", "Caches and queues are core building blocks of scalable systems."),
    ("git_version_control", "ci_cd_pipelines", "Pipelines are triggered by commits and merges."),
    ("cryptography_basics", "auth_security_basics", "Password hashing, tokens and TLS rely on cryptographic basics."),
    # mobile
    ("programming_fundamentals", "flutter_dart", "Dart is an object-oriented language."),
    ("programming_fundamentals", "android_kotlin", "Kotlin builds on core programming concepts."),
    ("programming_fundamentals", "ios_swift", "Swift builds on core programming concepts."),
    ("flutter_dart", "mobile_release_quality", "Release and quality work applies to a finished mobile app."),
    ("android_kotlin", "mobile_release_quality", "Release and quality work applies to a finished mobile app."),
    ("ios_swift", "mobile_release_quality", "Release and quality work applies to a finished mobile app."),
    # testing
    ("test_design_techniques", "test_automation_web", "Automate test cases only after you know what to test."),
    ("test_design_techniques", "performance_testing", "Performance scenarios come from well-designed test cases."),
    ("test_design_techniques", "testing_uat", "UAT scripts are built from test design techniques."),
    ("programming_fundamentals", "test_automation_web", "Test automation is written as code."),
    ("test_automation_web", "ci_for_testing", "Automated tests are what the pipeline runs."),
    ("ci_cd_pipelines", "ci_for_testing", "Testing in CI needs a pipeline to run in."),
    # data and machine learning
    ("statistics", "math_for_ml", "Probability and distributions underpin machine-learning methods."),
    ("math_for_ml", "machine_learning", "Models and loss functions rest on linear algebra and probability."),
    ("python_analytics", "machine_learning", "scikit-learn workflows start from pandas data."),
    ("statistics", "machine_learning", "Model evaluation uses statistical thinking."),
    ("machine_learning", "deep_learning", "Neural networks build on classical ML ideas."),
    ("machine_learning", "nlp_computer_vision", "NLP and vision pipelines use ML foundations."),
    ("deep_learning", "nlp_computer_vision", "Modern NLP and vision use neural networks."),
    ("machine_learning", "mlops_deployment", "There must be a model before it can be deployed."),
    ("docker_containers", "mlops_deployment", "Models are usually served from containers."),
    # data engineering
    ("data_modeling", "data_warehousing", "Warehouse schemas apply dimensional data modelling."),
    ("sql", "etl_pipelines", "Transformations are mostly written in SQL."),
    ("python_programming", "etl_pipelines", "Custom pipeline steps are written in Python."),
    ("etl_pipelines", "workflow_orchestration", "Orchestrators schedule and monitor the pipelines."),
    ("python_programming", "workflow_orchestration", "Airflow DAGs are defined in Python."),
    ("etl_pipelines", "streaming_data", "Streaming extends batch pipelines to continuous data."),
    ("sql", "big_data_spark", "Spark SQL and DataFrames work like SQL tables."),
    ("python_programming", "big_data_spark", "PySpark is the most common way to write Spark jobs."),
    # cloud and devops
    ("linux_administration", "docker_containers", "Containers run on Linux primitives and are managed from the shell."),
    ("docker_containers", "kubernetes", "Kubernetes orchestrates containers."),
    ("docker_containers", "ci_cd_pipelines", "Pipelines build and ship container images."),
    ("linux_administration", "infrastructure_as_code", "Provisioned servers are Linux machines."),
    ("cloud_aws", "infrastructure_as_code", "Terraform and CloudFormation provision cloud resources."),
    ("networking_fundamentals", "cloud_aws", "VPCs, subnets and security groups are networking concepts."),
    ("linux_administration", "cloud_aws", "EC2 instances are mostly Linux servers."),
    ("networking_fundamentals", "cloud_gcp_azure", "Virtual networks work the same way in every cloud."),
    ("linux_administration", "cloud_gcp_azure", "Most cloud virtual machines run Linux."),
    ("linux_administration", "monitoring_observability", "Metrics and logs come from hosts and services."),
    ("docker_containers", "monitoring_observability", "Container workloads need container-aware monitoring."),
    ("linux_administration", "web_servers_proxies", "Nginx and Apache run on Linux servers."),
    ("networking_fundamentals", "web_servers_proxies", "Proxies and TLS are network concepts."),
    # security
    ("networking_fundamentals", "network_security", "Firewalls and segmentation apply networking knowledge."),
    ("network_security", "siem_monitoring", "SIEM rules detect the network and host events you know how to read."),
    ("networking_fundamentals", "vulnerability_assessment", "Scanning and rating exposures needs network basics."),
    ("linux_administration", "vulnerability_assessment", "Most findings are on Linux hosts and services."),
    ("vulnerability_assessment", "penetration_testing", "Pen tests exploit what an assessment finds."),
    ("linux_administration", "penetration_testing", "Exploitation and privilege escalation happen on Linux and Windows hosts."),
    ("network_security", "incident_response_forensics", "Responders investigate network and host evidence."),
    ("siem_monitoring", "incident_response_forensics", "Incidents are usually detected through monitoring."),
    ("vulnerability_assessment", "security_frameworks_compliance", "Frameworks require risk and vulnerability management."),
    ("auth_security_basics", "cloud_security", "Cloud security applies identity and application security."),
    ("docker_containers", "cloud_security", "Container and image hardening is part of cloud security."),
    ("cloud_aws", "cloud_security", "Cloud account hardening needs platform knowledge."),
    # design
    ("figma_design_tools", "prototyping_interaction", "Prototypes are built in design tools."),
    ("wireframing", "prototyping_interaction", "Wireframes become interactive prototypes."),
    ("user_research", "usability_testing", "Usability tests use research methods."),
    ("prototyping_interaction", "usability_testing", "You test prototypes before building them."),
    ("user_research", "information_architecture", "Structure comes from how users think about content."),
    ("figma_design_tools", "design_systems", "Design systems live in the design tool as components."),
    ("visual_design_fundamentals", "design_systems", "Tokens and components encode visual design decisions."),
    ("visual_design_fundamentals", "accessibility_design", "Contrast, type and spacing are visual design choices."),
    # marketing
    ("web_analytics", "conversion_optimization", "Experiments start from funnel and conversion data."),
    ("web_analytics", "search_ads", "Campaigns are optimised with conversion tracking."),
    ("web_analytics", "social_media_ads", "Campaigns are optimised with conversion tracking."),
    ("content_creation_tools", "social_media_ads", "Ads need creatives made with content tools."),
    # finance and accounting
    ("accounting_fundamentals", "financial_statements", "Statements are built from journals and ledgers."),
    ("accounting_fundamentals", "ap_ar_reconciliation", "Payables, receivables and reconciliations use double entry."),
    ("accounting_fundamentals", "accounting_software", "Software automates journal and ledger logic."),
    ("accounting_fundamentals", "tax_compliance_id", "Tax calculations start from properly recorded transactions."),
    ("accounting_fundamentals", "cost_accounting", "Costing builds on basic accounting concepts."),
    ("financial_statements", "budgeting_forecasting", "Budgets and forecasts are built from the statements."),
    ("excel", "budgeting_forecasting", "Budgets and models are built in spreadsheets."),
    ("financial_statements", "audit_internal_control", "Auditors test the numbers in the statements."),
    ("financial_statements", "financial_analysis", "Ratios and analysis are computed from the statements."),
]


def main() -> None:
    skills = load_skills()
    old = json.loads((SEED_DIR / "graph.json").read_text(encoding="utf-8"))
    edges = [e for e in old["edges"] if e["from"] in skills and e["to"] in skills and "rationale_en" in e]
    have = {(e["from"], e["to"]) for e in edges}
    for a, b, why in NEW_EDGES:
        assert a in skills and b in skills, (a, b)
        if (a, b) not in have:
            edges.append({"from": a, "to": b, "source": "tim", "rationale": why, "rationale_en": why})
            have.add((a, b))
    from pathsync.taxonomy import Edge

    try:
        SkillGraph(skills, [Edge(e["from"], e["to"]) for e in edges])
    except CycleError as e:
        raise SystemExit(f"cycle: {e}") from e
    old["edges"] = edges
    old["version"] = "2026.10-v3-draft"
    old["status_note"] = ("Draft prerequisite edges for the hard-skill taxonomy. Each edge is validated by three experts in the "
                          "Expert Panel; until then the engine uses every draft edge (paper III.A.3).")
    (SEED_DIR / "graph.json").write_text(json.dumps(old, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(edges)} edges over {len(skills)} skills")


if __name__ == "__main__":
    main()
