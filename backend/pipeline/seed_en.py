"""Add English display text to the seed data (taxonomy descriptions, cluster labels, graph rationales).

The Indonesian originals are kept: they feed the extraction prompts and lexicon matching, and the
paper is written in Indonesian. The API serves the English fields (PATHSYNC_LANG=en, the default).

Run once after editing the dictionaries below: python -m pipeline.seed_en
"""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR

CLUSTERS_EN = {"data_analytics": "Data & Analytics", "business_process": "Business Process", "tools": "Tools",
               "communication": "Professional Communication"}

SKILLS_EN = {
    "sql": ("Write SQL queries to retrieve, join, and summarise data from relational databases.",
            "basic queries to aggregation: SELECT-WHERE, JOIN, GROUP BY-HAVING, subqueries"),
    "statistics": ("Use descriptive and inferential statistics (distributions, correlation, hypothesis tests, regression) to draw conclusions from data.",
                   "descriptive statistics, distributions, correlation, hypothesis testing, simple regression"),
    "data_analysis": ("Process and interpret data to find patterns, answer business questions, and form insights.",
                      "the analysis flow from business question and data exploration to segmentation and insight"),
    "data_visualization": ("Choose and build the right charts so decision-makers understand the data quickly.",
                           "chart types, visual design principles, avoiding misleading charts, visuals for KPIs"),
    "dashboard_reporting": ("Design recurring reports and business intelligence dashboards that track business performance.",
                            "dashboard design, recurring reports, report automation, choosing metrics per audience"),
    "data_cleaning": ("Clean, validate, and prepare data so it is accurate and ready for analysis.",
                      "handling missing and duplicate data, validation, standardising formats, data quality criteria"),
    "data_modeling": ("Understand relational database structure and model data (ERDs, data dictionaries, data mapping).",
                      "relational database concepts, ERDs, normalisation, star schema, data mapping and dictionaries"),
    "python_analytics": ("Use Python (pandas) or R to process and analyse data at a larger scale.",
                         "Python basics, pandas for data manipulation, notebooks, plotting with matplotlib/seaborn"),
    "kpi_metrics": ("Define, calculate, and monitor performance indicators that reflect business goals.",
                    "types of metrics, metric trees, KPIs vs OKRs, funnel and retention metrics"),
    "financial_analysis": ("Read financial statements and analyse financial performance, budgets, and profitability.",
                           "reading income statements and balance sheets, financial ratios, budgeting, profitability analysis"),
    "research_methods": ("Design surveys, interviews, and market research to gather evidence for business decisions.",
                         "research design, surveys and questionnaires, interviews, market and competitor research"),
    "requirements_elicitation": ("Uncover business and user needs through interviews, workshops, and observation.",
                                 "interview techniques, requirements workshops, observation, separating business from user needs"),
    "requirements_documentation": ("Turn requirements into documents the technical team can act on: BRDs, FSDs, user stories, acceptance criteria.",
                                   "BRD/FSD structure, user stories and acceptance criteria, functional specs, traceability"),
    "business_process_modeling": ("Map current and proposed (as-is/to-be) business processes with flowcharts or BPMN.",
                                  "flowchart and BPMN notation, swimlanes, as-is and to-be mapping"),
    "process_improvement": ("Analyse processes to find inefficiencies and propose improvements or automation.",
                            "root-cause analysis, lean and waste, process metrics, automation proposals"),
    "system_modeling_uml": ("Model system behaviour and structure with UML diagrams such as use case, activity, and sequence diagrams.",
                            "use case diagrams and scenarios, activity diagrams, sequence diagrams, DFDs"),
    "sdlc": ("Understand the stages of software development and the analyst's role in each.",
             "SDLC stages, waterfall vs iterative, the BA's role at each stage, managing change requests"),
    "agile_scrum": ("Work within agile: sprints, backlogs, refinement, and cross-functional collaboration.",
                    "agile values, Scrum roles and events, product backlog, refinement, kanban"),
    "testing_uat": ("Write test scenarios and cases, and coordinate user acceptance testing.",
                    "test scenarios and cases, UAT, defect tracking, testing against acceptance criteria"),
    "stakeholder_management": ("Identify, communicate with, and align the expectations of stakeholders across functions.",
                               "stakeholder analysis, power-interest mapping, aligning expectations, escalation"),
    "project_management": ("Plan, monitor, and control project scope, schedule, and risk.",
                           "scope and WBS, schedules and milestones, progress tracking, project risk management"),
    "business_case": ("Build the justification for an initiative: cost-benefit analysis, ROI, and feasibility.",
                      "business case structure, cost-benefit analysis, ROI and payback, assumptions and sensitivity"),
    "change_management": ("Help organisations and users adopt new processes or systems.",
                          "change models (ADKAR), communication and training plans, managing resistance"),
    "strategic_analysis": ("Analyse internal and external factors to support strategic decisions.",
                           "SWOT, PESTEL, five forces, market analysis, turning strategy into initiatives"),
    "risk_management": ("Identify, assess, and mitigate risks, and ensure regulatory compliance.",
                        "risk identification and assessment, risk matrices, mitigation, regulatory compliance"),
    "excel": ("Work with data in spreadsheets: formulas, lookups, pivot tables, and charts.",
              "formulas and cell references, lookups (VLOOKUP/XLOOKUP), pivot tables, basic charts"),
    "power_bi": ("Build data models and interactive dashboards in Microsoft Power BI.",
                 "importing and transforming data, model relationships, basic DAX, publishing dashboards"),
    "tableau": ("Create interactive visualisations and dashboards in Tableau.",
                "data connections, dimensions vs measures, calculated fields, dashboards and stories"),
    "bi_tools_other": ("Use SQL-based web BI tools such as Looker Studio, Looker, Metabase, or Superset.",
                       "connecting data sources, building SQL-based charts, sharing dashboards"),
    "jira_confluence": ("Manage backlogs, tickets, and team documentation with Jira, Confluence, or similar tools.",
                        "Jira issues and workflows, scrum/kanban boards, Confluence documentation pages"),
    "diagramming_tools": ("Draw process and system diagrams with tools such as Visio, Lucidchart, draw.io, or Miro.",
                          "clean flowcharts/BPMN, templates, collaborative diagramming"),
    "wireframing": ("Turn requirements into simple wireframes or mockups that users can validate.",
                    "low-fidelity wireframes, screen flows, clickable prototypes in Figma"),
    "erp_crm": ("Understand the modules and flows of enterprise systems such as SAP, Oracle, Odoo, Dynamics, or Salesforce.",
                "ERP module concepts (finance, procurement, inventory), order-to-cash flow, CRM basics"),
    "cloud_data_platform": ("Access and process data in cloud data warehouses such as BigQuery, Snowflake, or Redshift.",
                            "cloud data warehouse concepts, querying in BigQuery, query cost, sharing datasets"),
    "api_integration": ("Understand how systems exchange data through APIs (REST, JSON/XML) and specify integration requirements.",
                        "REST API concepts, JSON/XML formats, reading API specs (Swagger/OpenAPI), integration flows"),
    "presentation_storytelling": ("Present findings and recommendations concisely, clearly, and persuasively.",
                                  "message structure (pyramid principle), data narratives, clear slides, handling questions"),
    "business_writing": ("Write documents, reports, memos, and user manuals that are clear and actionable.",
                         "concise structured writing, executive reports, user manuals, professional email"),
    "verbal_communication": ("Speak clearly, listen actively, and build working relationships.",
                             "active listening, effective questioning, adapting the message to the audience"),
    "facilitation_negotiation": ("Facilitate meetings and workshops, and negotiate priorities and scope.",
                                 "designing workshop agendas, facilitation techniques, negotiating priorities, building consensus"),
    "english_proficiency": ("Read, write, and speak English in a work context.",
                            "work email and documents, presentations and meetings in English"),
    "critical_thinking": ("Break problems down, weigh evidence, and reason towards solutions.",
                          "problem decomposition, issue trees, root-cause analysis, weighing evidence"),
    "collaboration": ("Work effectively in cross-functional teams, share information, and support others.",
                      "cross-functional teamwork, sharing information, giving and receiving feedback"),
}

RATIONALES_EN = [
    "Early-stage data cleaning is usually done in a spreadsheet.",
    "Data has to be pulled and filtered with queries before it can be cleaned at scale.",
    "Early data analysis in BA work almost always happens in a spreadsheet.",
    "Analysis requires pulling and joining data from databases.",
    "ESCO: 'apply statistical analysis techniques' lists 'statistics' as a supporting skill.",
    "ESCO: data quality ('implement data quality processes') comes before interpreting data.",
    "Data for visuals has to be prepared with queries (paper example, Figure 6).",
    "Basic charts are first learned in a spreadsheet.",
    "ESCO: 'deliver visual presentation of data' builds on 'visual presentation techniques'.",
    "ESCO: 'report analysis results' has 'perform data analysis' as its parent concept.",
    "A useful dashboard starts with choosing the right metrics.",
    "Writing queries makes relational and schema concepts meaningful.",
    "Python scales up an analysis flow you already understand.",
    "Day-to-day financial analysis is done with spreadsheet models.",
    "ESCO: 'conduct quantitative research' relates to 'manage quantitative data' and statistical methods.",
    "Visualisation principles come before mastering a BI tool.",
    "Power Query and Power BI data models build on spreadsheet logic.",
    "Visualisation principles come before mastering a BI tool.",
    "Visualisation principles come before mastering a BI tool.",
    "Looker Studio and Metabase are usually built on SQL queries.",
    "BigQuery and Snowflake are accessed with SQL.",
    "Managing stakeholders requires good spoken communication.",
    "ESCO: 'interact with users to gather requirements' has 'use questioning techniques' as its parent concept.",
    "Identifying stakeholders comes before gathering requirements.",
    "ESCO: 'analyse business requirements' includes 'business requirements techniques'.",
    "Requirements documents need clear, structured writing.",
    "ESCO: 'analyse business processes' includes 'business process modelling'.",
    "Process improvements need to be measured with before-and-after data.",
    "Activity diagrams and use cases start from understanding the process flow.",
    "ESCO: 'translate requirement concepts into visual design' builds on requirements already gathered.",
    "Agile is understood as one approach within the development life cycle.",
    "Test cases and UAT are derived from requirements and acceptance criteria.",
    "Testing is a stage in the development life cycle.",
    "ESCO: 'manage ICT project' relies on coordinating stakeholders.",
    "ESCO: 'provide cost benefit analysis reports' requires financial analysis.",
    "Benefits in a business case are expressed as measurable metrics.",
    "Change management depends on stakeholder support.",
    "ESCO: analysing external factors relies on 'market research'.",
    "ESCO: 'make strategic business decisions' has 'apply strategic thinking' as its parent concept.",
    "Assessing risk requires systematic reasoning about likelihood and impact.",
    "Jira is used to run agile workflows.",
    "Process notation is learned before the tool used to draw it.",
    "ESCO: 'translate requirement concepts into visual design'.",
    "ERP modules automate business processes that must be understood first.",
    "ESCO: 'deliver visual presentation of data' includes 'visual presentation techniques'.",
    "A presentation is a structured form of spoken communication.",
    "Facilitation and negotiation rely on spoken communication.",
    "Negotiating priorities requires understanding every party's interests.",
    "Integration requirements are defined within the system development life cycle.",
    "ESCO: 'integrate ICT data' relies on understanding data structures.",
]


def main():
    tp = SEED_DIR / "taxonomy.json"
    tax = json.loads(tp.read_text(encoding="utf-8"))
    tax["clusters_en"] = CLUSTERS_EN
    for s in tax["skills"]:
        desc, learn = SKILLS_EN[s["id"]]
        s["description_en"], s["learn_what_en"] = desc, learn
    tp.write_text(json.dumps(tax, ensure_ascii=False, indent=2), encoding="utf-8")

    gp = SEED_DIR / "graph.json"
    graph = json.loads(gp.read_text(encoding="utf-8"))
    assert len(graph["edges"]) == len(RATIONALES_EN)
    for e, r in zip(graph["edges"], RATIONALES_EN):
        e["rationale_en"] = r
    gp.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[seed_en] {len(tax['skills'])} skills, {len(graph['edges'])} edges")


if __name__ == "__main__":
    main()
