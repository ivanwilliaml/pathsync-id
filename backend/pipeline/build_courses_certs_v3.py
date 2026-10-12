"""Update courses.json and certificates.json for the hard-skill taxonomy v3.

* Strips skills that no longer exist (soft skills) from every course and certificate; drops entries left empty.
* Adds the courses and certificates of the new careers (course names are the usual Indonesian catalogue names).
Run: python -m pipeline.build_courses_certs_v3
"""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR

# name, aliases, programs, {skill: strength}
COURSES = [
    ("Pemrograman Web", ["Web Programming", "Pemrograman Web Lanjut", "Web Development"], ["SI", "TI"], {"html_css": 0.9, "javascript": 0.6, "php_laravel": 0.4, "rest_api_design": 0.3}),
    ("Pemrograman Berorientasi Objek", ["Object Oriented Programming", "OOP", "PBO"], ["SI", "TI"], {"programming_fundamentals": 0.9}),
    ("Algoritma dan Pemrograman", ["Dasar Pemrograman", "Programming Fundamentals", "Pemrograman Dasar"], ["SI", "TI", "Statistika"], {"programming_fundamentals": 0.8, "python_programming": 0.4}),
    ("Struktur Data", ["Algoritma dan Struktur Data", "Data Structures", "Data Structures and Algorithms"], ["SI", "TI"], {"data_structures_algorithms": 0.9, "programming_fundamentals": 0.4}),
    ("Pemrograman Mobile", ["Mobile Programming", "Pengembangan Aplikasi Mobile", "Mobile Application Development"], ["SI", "TI"], {"android_kotlin": 0.5, "flutter_dart": 0.4, "mobile_backend_services": 0.3}),
    ("Pemrograman Python", ["Python Programming", "Python"], ["SI", "TI", "Statistika"], {"python_programming": 0.9}),
    ("Pemrograman Java", ["Java Programming", "Java"], ["SI", "TI"], {"java_spring": 0.5, "programming_fundamentals": 0.6}),
    ("Jaringan Komputer", ["Computer Networks", "Komunikasi Data dan Jaringan", "Networking"], ["SI", "TI"], {"networking_fundamentals": 0.9, "network_security": 0.3}),
    ("Keamanan Informasi", ["Keamanan Siber", "Information Security", "Cyber Security", "Keamanan Jaringan"], ["SI", "TI"], {"network_security": 0.5, "cryptography_basics": 0.5, "security_frameworks_compliance": 0.4, "auth_security_basics": 0.3}),
    ("Kriptografi", ["Cryptography"], ["SI", "TI"], {"cryptography_basics": 0.9}),
    ("Sistem Operasi", ["Operating Systems", "Administrasi Sistem Linux", "Linux"], ["SI", "TI"], {"linux_administration": 0.6}),
    ("Komputasi Awan", ["Cloud Computing", "Cloud Infrastructure"], ["SI", "TI"], {"cloud_aws": 0.5, "cloud_gcp_azure": 0.4, "docker_containers": 0.3}),
    ("Pengujian Perangkat Lunak", ["Software Testing", "Quality Assurance", "Penjaminan Mutu Perangkat Lunak", "Software Quality"], ["SI", "TI"], {"test_design_techniques": 0.8, "unit_testing_tdd": 0.4, "test_automation_web": 0.3}),
    ("Kecerdasan Buatan", ["Artificial Intelligence", "AI"], ["SI", "TI", "Statistika"], {"machine_learning": 0.5, "math_for_ml": 0.3}),
    ("Pembelajaran Mesin", ["Machine Learning", "Data Mining", "Penambangan Data"], ["SI", "TI", "Statistika"], {"machine_learning": 0.9, "math_for_ml": 0.5, "python_analytics": 0.4}),
    ("Pembelajaran Mendalam", ["Deep Learning", "Neural Networks", "Jaringan Syaraf Tiruan"], ["TI", "Statistika"], {"deep_learning": 0.9}),
    ("Pengolahan Citra Digital", ["Image Processing", "Computer Vision", "Visi Komputer"], ["TI"], {"nlp_computer_vision": 0.8}),
    ("Pemrosesan Bahasa Alami", ["Natural Language Processing", "NLP", "Text Mining"], ["TI"], {"nlp_computer_vision": 0.8}),
    ("Basis Data NoSQL", ["NoSQL Databases", "Big Data", "Basis Data Lanjut Non-Relasional"], ["SI", "TI"], {"nosql_databases": 0.7, "big_data_spark": 0.4}),
    ("Data Warehouse dan Business Intelligence", ["Data Warehouse", "Gudang Data", "Data Warehousing", "Business Intelligence"], ["SI", "TI"], {"data_warehousing": 0.8, "etl_pipelines": 0.4, "data_modeling": 0.4}),
    ("Arsitektur Perangkat Lunak", ["Software Architecture", "Desain Perangkat Lunak", "Software Design"], ["SI", "TI"], {"system_design_architecture": 0.6, "programming_fundamentals": 0.4}),
    ("DevOps", ["Manajemen Infrastruktur", "Continuous Integration", "Deployment"], ["SI", "TI"], {"ci_cd_pipelines": 0.6, "docker_containers": 0.5, "git_version_control": 0.4}),
    ("Pemrograman Backend", ["Backend Development", "Pengembangan Layanan Web", "Web Services"], ["SI", "TI"], {"rest_api_design": 0.7, "nodejs_backend": 0.3, "python_backend": 0.3, "auth_security_basics": 0.3}),
    ("Interaksi Manusia dan Komputer", ["Human Computer Interaction", "HCI", "Desain Interaksi"], ["SI", "TI", "DKV"], {"usability_testing": 0.6, "user_research": 0.5, "prototyping_interaction": 0.4, "visual_design_fundamentals": 0.3, "accessibility_design": 0.3, "wireframing": 0.5}),
    ("Desain Antarmuka Pengguna", ["UI/UX Design", "User Interface Design", "Desain UI UX", "User Experience"], ["SI", "TI", "DKV"], {"figma_design_tools": 0.6, "prototyping_interaction": 0.5, "visual_design_fundamentals": 0.5, "design_systems": 0.3, "wireframing": 0.4}),
    ("Desain Grafis", ["Multimedia", "Desain Komunikasi Visual", "Graphic Design", "Desain Visual"], ["DKV", "SI"], {"visual_design_fundamentals": 0.7, "figma_design_tools": 0.5, "content_creation_tools": 0.4}),
    ("Pemasaran Digital", ["Digital Marketing", "Social Media Marketing", "Internet Marketing"], ["Manajemen", "DKV", "SI"], {"seo": 0.5, "search_ads": 0.4, "social_media_ads": 0.4, "web_analytics": 0.4, "email_marketing_automation": 0.3}),
    ("Bisnis Elektronik", ["E-Commerce", "E-Business", "Electronic Commerce"], ["Manajemen", "SI"], {"marketplace_ecommerce": 0.6, "web_analytics": 0.3}),
    ("Analitika Web", ["Web Analytics", "Marketing Analytics"], ["Manajemen", "SI", "Statistika"], {"web_analytics": 0.8, "conversion_optimization": 0.3}),
    ("Pengantar Akuntansi", ["Akuntansi Dasar", "Introduction to Accounting", "Financial Accounting I"], ["Akuntansi", "Manajemen"], {"accounting_fundamentals": 0.9}),
    ("Akuntansi Keuangan Menengah", ["Intermediate Accounting", "Akuntansi Keuangan", "Financial Accounting II"], ["Akuntansi"], {"accounting_fundamentals": 0.7, "financial_statements": 0.8}),
    ("Akuntansi Biaya", ["Cost Accounting", "Akuntansi Manajemen Biaya"], ["Akuntansi", "Manajemen"], {"cost_accounting": 0.9}),
    ("Perpajakan", ["Taxation", "Pajak", "Tax Accounting"], ["Akuntansi", "Manajemen"], {"tax_compliance_id": 0.9}),
    ("Auditing", ["Pemeriksaan Akuntansi", "Audit", "Audit Internal", "Internal Audit"], ["Akuntansi"], {"audit_internal_control": 0.9}),
    ("Sistem Informasi Akuntansi", ["Accounting Information Systems", "SIA", "Praktikum Akuntansi Komputer"], ["Akuntansi", "SI"], {"accounting_software": 0.7, "accounting_fundamentals": 0.4}),
    ("Akuntansi Manajemen", ["Management Accounting", "Penganggaran", "Budgeting"], ["Akuntansi", "Manajemen"], {"budgeting_forecasting": 0.7, "cost_accounting": 0.5}),
    ("Analisis Laporan Keuangan", ["Financial Statement Analysis", "Analisa Laporan Keuangan"], ["Akuntansi", "Manajemen"], {"financial_statements": 0.6, "financial_analysis": 0.8}),
    ("Akuntansi Utang dan Piutang", ["Accounts Payable and Receivable", "Akuntansi Perusahaan Dagang"], ["Akuntansi"], {"ap_ar_reconciliation": 0.6, "accounting_fundamentals": 0.5}),
]

# name, aliases, level, {skill: strength}
CERTS = [
    ("Meta Front-End Developer Professional Certificate", ["Meta Front-End Developer", "Meta Frontend Developer"], "profesional", {"html_css": 0.6, "javascript": 0.6, "react": 0.6, "git_version_control": 0.3}),
    ("Meta Back-End Developer Professional Certificate", ["Meta Back-End Developer", "Meta Backend Developer"], "profesional", {"python_programming": 0.5, "rest_api_design": 0.5, "sql": 0.4, "git_version_control": 0.3, "python_backend": 0.4}),
    ("freeCodeCamp Responsive Web Design", ["freeCodeCamp Responsive Web Design Certification"], "kursus", {"html_css": 0.8, "responsive_accessible_web": 0.5}),
    ("freeCodeCamp JavaScript Algorithms and Data Structures", ["freeCodeCamp JavaScript"], "kursus", {"javascript": 0.8, "data_structures_algorithms": 0.4, "programming_fundamentals": 0.4}),
    ("Dicoding: Belajar Dasar Pemrograman Web", ["Belajar Dasar Pemrograman Web", "Dicoding Pemrograman Web"], "kursus", {"html_css": 0.6, "javascript": 0.3}),
    ("Dicoding: Belajar Dasar Pemrograman Python", ["Belajar Dasar Python", "Dicoding Python"], "kursus", {"python_programming": 0.6, "programming_fundamentals": 0.4}),
    ("Dicoding: Belajar Fundamental Aplikasi Android", ["Belajar Membuat Aplikasi Android", "Dicoding Android"], "kursus", {"android_kotlin": 0.6, "mobile_release_quality": 0.2}),
    ("Dicoding: Belajar Membuat Aplikasi Flutter", ["Belajar Flutter", "Dicoding Flutter"], "kursus", {"flutter_dart": 0.6}),
    ("Dicoding: Belajar Dasar Pemrosesan Data / Machine Learning", ["Dicoding Machine Learning", "Belajar Machine Learning untuk Pemula"], "kursus", {"machine_learning": 0.6, "python_analytics": 0.3}),
    ("BNSP Junior Web Programmer", ["Sertifikasi BNSP Junior Web Programmer", "Junior Web Programmer"], "ujian", {"html_css": 0.6, "javascript": 0.5, "programming_fundamentals": 0.5}),
    ("BNSP Network Administrator", ["Sertifikasi BNSP Network Administrator", "Network Administrator"], "ujian", {"networking_fundamentals": 0.7, "linux_administration": 0.4, "network_security": 0.3}),
    ("Google IT Support Professional Certificate", ["Google IT Support"], "profesional", {"networking_fundamentals": 0.6, "linux_administration": 0.3, "network_security": 0.2}),
    ("CompTIA Network+", ["Network+", "CompTIA Network Plus"], "ujian", {"networking_fundamentals": 0.8, "network_security": 0.3}),
    ("CompTIA Security+", ["Security+", "CompTIA Security Plus"], "ujian", {"network_security": 0.5, "cryptography_basics": 0.4, "security_frameworks_compliance": 0.4, "vulnerability_assessment": 0.3, "incident_response_forensics": 0.3}),
    ("Certified Ethical Hacker (CEH)", ["CEH", "EC-Council CEH"], "ujian", {"penetration_testing": 0.6, "vulnerability_assessment": 0.5, "network_security": 0.4}),
    ("Offensive Security Certified Professional (OSCP)", ["OSCP", "OffSec OSCP"], "ujian", {"penetration_testing": 0.9, "linux_administration": 0.5}),
    ("ISO 27001 Lead Implementer / Lead Auditor", ["ISO 27001 LI", "ISO 27001 LA", "ISO 27001 Certification"], "ujian", {"security_frameworks_compliance": 0.9}),
    ("AWS Certified Cloud Practitioner", ["AWS Cloud Practitioner", "AWS CLF-C02"], "ujian", {"cloud_aws": 0.5}),
    ("AWS Certified Solutions Architect - Associate", ["AWS Solutions Architect Associate", "AWS SAA-C03"], "ujian", {"cloud_aws": 0.8, "networking_fundamentals": 0.3, "system_design_architecture": 0.3}),
    ("Microsoft Azure Fundamentals (AZ-900)", ["AZ-900", "Azure Fundamentals"], "ujian", {"cloud_gcp_azure": 0.5}),
    ("Google Associate Cloud Engineer", ["Google ACE", "Associate Cloud Engineer"], "ujian", {"cloud_gcp_azure": 0.7}),
    ("Certified Kubernetes Administrator (CKA)", ["CKA", "Kubernetes Administrator"], "ujian", {"kubernetes": 0.9, "docker_containers": 0.5, "linux_administration": 0.4}),
    ("HashiCorp Certified: Terraform Associate", ["Terraform Associate"], "ujian", {"infrastructure_as_code": 0.8}),
    ("Linux Foundation Certified System Administrator (LFCS)", ["LFCS", "RHCSA"], "ujian", {"linux_administration": 0.8}),
    ("TensorFlow Developer Certificate", ["TensorFlow Certificate"], "ujian", {"deep_learning": 0.7, "machine_learning": 0.5}),
    ("DeepLearning.AI Machine Learning Specialization", ["Machine Learning Specialization", "Andrew Ng Machine Learning"], "profesional", {"machine_learning": 0.8, "math_for_ml": 0.4, "python_analytics": 0.3}),
    ("DeepLearning.AI Deep Learning Specialization", ["Deep Learning Specialization"], "profesional", {"deep_learning": 0.8, "machine_learning": 0.3}),
    ("Databricks Certified Data Engineer Associate", ["Databricks Data Engineer Associate"], "ujian", {"big_data_spark": 0.6, "etl_pipelines": 0.6, "data_warehousing": 0.5, "sql": 0.4}),
    ("Google Professional Data Engineer", ["GCP Data Engineer"], "ujian", {"data_warehousing": 0.6, "etl_pipelines": 0.6, "streaming_data": 0.4, "cloud_gcp_azure": 0.4}),
    ("ISTQB Certified Tester Foundation Level (CTFL)", ["ISTQB Foundation", "ISTQB CTFL"], "ujian", {"test_design_techniques": 0.8, "testing_uat": 0.4}),
    ("Google UX Design Professional Certificate", ["Google UX Design"], "profesional", {"user_research": 0.6, "figma_design_tools": 0.5, "prototyping_interaction": 0.6, "usability_testing": 0.5, "wireframing": 0.6, "visual_design_fundamentals": 0.3}),
    ("Google Ads Search Certification", ["Google Ads Certification", "Google Ads Search"], "ujian", {"search_ads": 0.8, "web_analytics": 0.3}),
    ("Google Analytics Certification (GA4)", ["GA4 Certification", "Google Analytics Individual Qualification", "GAIQ"], "ujian", {"web_analytics": 0.8}),
    ("Meta Certified Digital Marketing Associate", ["Meta Blueprint Certification", "Meta Digital Marketing Associate"], "ujian", {"social_media_ads": 0.7, "web_analytics": 0.3}),
    ("HubSpot Academy: Email Marketing Certification", ["HubSpot Email Marketing"], "kursus", {"email_marketing_automation": 0.7}),
    ("Google Digital Marketing & E-commerce Professional Certificate", ["Google Digital Marketing and E-commerce"], "profesional", {"seo": 0.5, "search_ads": 0.4, "social_media_ads": 0.4, "web_analytics": 0.5, "email_marketing_automation": 0.4, "conversion_optimization": 0.3, "marketplace_ecommerce": 0.3}),
    ("Brevet Pajak A dan B", ["Brevet A&B", "Brevet Pajak AB"], "ujian", {"tax_compliance_id": 0.8}),
    ("Brevet Pajak C", ["Brevet C"], "ujian", {"tax_compliance_id": 0.9}),
    ("Sertifikasi Accurate Online", ["Accurate Certified", "Sertifikat Accurate"], "kursus", {"accounting_software": 0.7}),
    ("Certified Internal Auditor (CIA)", ["CIA", "IIA CIA"], "ujian", {"audit_internal_control": 0.9}),
    ("ACCA Applied Skills", ["ACCA", "ACCA Qualification"], "ujian", {"accounting_fundamentals": 0.7, "financial_statements": 0.7, "audit_internal_control": 0.5, "tax_compliance_id": 0.4}),
]


def main() -> None:
    skills = {s["id"] for s in json.loads((SEED_DIR / "taxonomy.json").read_text(encoding="utf-8"))["skills"]}

    c = json.loads((SEED_DIR / "courses.json").read_text(encoding="utf-8"))
    kept = []
    for x in c["courses"]:
        x["skills"] = {k: v for k, v in x["skills"].items() if k in skills}
        if x["skills"]:
            kept.append(x)
    by_name = {x["name"].lower(): x for x in kept}
    for name, aliases, programs, mapping in COURSES:
        assert set(mapping) <= skills, (name, set(mapping) - skills)
        hit = by_name.get(name.lower()) or next((x for x in kept if name.lower() in {a.lower() for a in x["aliases"]}), None)
        if hit:
            hit["skills"] = {**hit["skills"], **mapping}
            hit["aliases"] = sorted(set(hit["aliases"]) | set(aliases))
            hit["programs"] = sorted(set(hit["programs"]) | set(programs))
        else:
            kept.append({"name": name, "aliases": aliases, "programs": programs, "skills": mapping})
    c["courses"] = kept
    c["note"] = ("Draf pemetaan capaian pembelajaran mata kuliah ke keterampilan teknis (kekuatan 0-1) untuk prodi SI, TI, "
                 "Statistika, DKV, Manajemen, dan Akuntansi berdasarkan nama dan deskripsi umum mata kuliah di katalog kurikulum "
                 "publik. Divalidasi ulang terhadap silabus rinci setelah izin kampus (paper Tabel 5).")
    (SEED_DIR / "courses.json").write_text(json.dumps(c, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    cc = json.loads((SEED_DIR / "certificates.json").read_text(encoding="utf-8"))
    certs = []
    for x in cc["certificates"]:
        x["skills"] = {k: v for k, v in x["skills"].items() if k in skills}
        if x["skills"]:
            certs.append(x)
    have = {x["name"].lower() for x in certs}
    for name, aliases, level, mapping in CERTS:
        assert set(mapping) <= skills, (name, set(mapping) - skills)
        if name.lower() not in have:
            certs.append({"name": name, "aliases": aliases, "level": level, "skills": mapping})
    cc["certificates"] = certs
    (SEED_DIR / "certificates.json").write_text(json.dumps(cc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(kept)} courses, {len(certs)} certificates")


if __name__ == "__main__":
    main()
