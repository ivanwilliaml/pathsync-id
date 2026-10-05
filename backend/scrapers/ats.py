"""Scrapers for public applicant-tracking-system (ATS) posting endpoints.

Paper III.C.1: "Teks lowongan diambil dari laman karier perusahaan yang ditayangkan
melalui titik akses publik sistem rekrutmen". Every endpoint below is the public,
documented job-board API that the ATS vendor provides for embedding a company's
open positions on its career page. Only postings located in Indonesia are kept.

    workable    GET https://jobs.workable.com/api/v1/jobs?query=..&location=Indonesia (public job search)
    greenhouse  GET https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
    lever       GET https://api.lever.co/v0/postings/<slug>?mode=json
    smartrec    GET https://api.smartrecruiters.com/v1/companies/<slug>/postings?country=id
    ashby       GET https://api.ashbyhq.com/posting-api/job-board/<slug>
    recruitee   GET https://<slug>.recruitee.com/api/offers/
"""
from __future__ import annotations

import argparse
import ast
from datetime import datetime

from .common import (RAW_DIR, PoliteClient, Posting, classify_role, detect_language, html_to_text,
                     is_indonesia, ts_to_date, write_jsonl)

WORKABLE_QUERIES = [
    "business analyst", "system analyst", "business process analyst", "functional analyst",
    "data analyst", "business intelligence", "product analyst", "analyst", "analytics",
]
WORKABLE_LOCATIONS = ["Indonesia", "Jakarta", "Surabaya", "Bandung", "Tangerang"]

# Companies with an Indonesian presence; slugs are probed on every ATS and silently
# skipped when the board does not exist. Extend this list to widen coverage.
COMPANY_SLUGS = [
    "xendit", "kredivo", "ninjavan", "traveloka", "gojek", "gotogroup", "goto", "tokopedia", "grab",
    "akulaku", "ajaib", "pintu", "flip", "flipid", "halodoc", "ruangguru", "efishery", "mekari",
    "bukalapak", "blibli", "dana", "ovo", "amartha", "investree", "koinworks", "stockbit", "sayurbox",
    "astro", "astronauts", "kopikenangan", "glints", "kalibrr", "carousell", "shopback", "fundingsocieties",
    "aspire", "airwallex", "zalora", "lazada", "evermos", "privy", "qoala", "pluang", "julo", "alami",
    "bibit", "kitabisa", "sociolla", "lionparcel", "kargo", "waresix", "shipper", "aruna", "segari",
    "jago", "superbank", "allobank", "brankas", "ayoconnect", "durianpay", "oy", "oyindonesia", "midtrans",
    "doku", "pomona", "eratani", "fazz", "xfers", "atome", "advance", "advanceai", "finaccel", "home-credit",
    "tiket", "tiketcom", "agoda", "bobobox", "ula", "hara", "bizzy", "mapan", "warung-pintar", "gredu",
    "zenius", "pahamify", "cakap", "skillacademy", "binar", "hacktiv8", "dicoding", "jurnal", "talenta",
    "qasir", "moka", "majoo", "olsera", "esb", "rukita", "pinhome", "lamudi", "rumah123", "99group",
    "mamikos", "hypefast", "sirclo", "ginee", "jubelio", "desty", "orderonline", "shopee", "sea",
    "bytedance", "tiktok", "canva", "thoughtworks", "accenture", "deloitte", "pwc", "ey", "kpmg",
    "mckinsey", "bcg", "bain", "dkatalis", "kasisto", "nium", "wise", "rapyd", "paidy", "pace", "kredit-pintar",
    "indodana", "uangme", "adakami", "easycash", "rupiah-cepat", "tunaiku", "danamas", "modalku",
    "crowdo", "akseleran", "lummo", "bukuwarung", "bukukas", "credibook", "payfazz", "sampingan",
    "staffinc", "mitrakerja", "gajigesa", "wagely", "kerjoo", "ottopay", "linkaja", "shopeepay", "isaku",
    # discovered via web search of public job boards that list Jakarta roles (slugs are case-sensitive)
    "GoToGroup", "amarbank", "payjoy", "atibusinessgroup", "qualysoft", "tsmg", "portcast", "acommerce",
    "artefactlinkedin", "Qraved", "FLOW1", "kpler", "getwingapp",
]

# Workday career sites (public CXS endpoint behind <tenant>.<dc>.myworkdayjobs.com/<site>).
# Traveloka was dropped (Oct 2026): every site name on wd1/wd3/wd5/wd10/wd12/wd103 returns 422, i.e. no Workday tenant.
WORKDAY_SITES = [
    ("aia", "wd3", "External"), ("samudera", "wd3", "Careers"),
    ("sunlife", "wd3", "Experienced"), ("binus", "wd3", "lifeatbinus"), ("kbr", "wd5", "KBR_Careers"),
    ("prysmiangroup", "wd3", "Careers"), ("cloudera", "wd5", "External_Career"), ("csgi", "wd5", "csgcareers"),
    ("hsbc", "wd3", "external"), ("manulife", "wd3", "MFCJH_Jobs"), ("pg", "wd5", "1000"),
    ("dbs", "wd3", "DBS_Careers"), ("prudential", "wd3", "prudential"), ("covestro", "wd3", "cov_external"),
]
WORKDAY_QUERIES = ["analyst", "analis", "business analyst", "data analyst", "system analyst", "business intelligence"]


# ------------------------------------------------------------------- workable


def scrape_workable(client: PoliteClient, verbose=True) -> list[Posting]:
    out: dict[str, Posting] = {}
    for loc in WORKABLE_LOCATIONS:
        for q in WORKABLE_QUERIES:
            token, pages = None, 0
            while pages < 10:
                params = {"query": q, "location": loc}
                if token:
                    params["pageToken"] = token
                r = client.get("https://jobs.workable.com/api/v1/jobs", params=params)
                if r is None or r.status_code != 200:
                    break
                d = r.json()
                for j in d.get("jobs", []):
                    loc_obj = j.get("location") or {}
                    if isinstance(loc_obj, str):
                        try:
                            loc_obj = ast.literal_eval(loc_obj)
                        except (ValueError, SyntaxError):
                            loc_obj = {}
                    loc_str = ", ".join(x for x in [loc_obj.get("city"), loc_obj.get("countryName")] if x)
                    if not is_indonesia(loc_str):
                        continue
                    role = classify_role(j.get("title", ""))
                    if not role or j["id"] in out:
                        continue
                    comp = j.get("company") or {}
                    if isinstance(comp, str):
                        try:
                            comp = ast.literal_eval(comp)
                        except (ValueError, SyntaxError):
                            comp = {}
                    text = "\n\n".join(x for x in [
                        html_to_text(j.get("description")),
                        ("Requirements:\n" + html_to_text(j.get("requirementsSection"))) if j.get("requirementsSection") else "",
                    ] if x)
                    out[j["id"]] = Posting(
                        source="workable", source_id=j["id"], url=j.get("url", ""), title=j.get("title", ""),
                        company=comp.get("title", ""), location=loc_str, published_at=ts_to_date(j.get("created")),
                        description_text=text, role=role, language=detect_language(text),
                        raw_meta={"department": j.get("department"), "employment": j.get("employmentType"),
                                  "workplace": j.get("workplace")},
                    )
                token = d.get("nextPageToken")
                pages += 1
                if not token:
                    break
        if verbose:
            print(f"[workable] location={loc:10s} kept so far={len(out)}")
    return list(out.values())


# ---------------------------------------------------------- per-company boards


def _greenhouse(client, slug):
    r = client.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", params={"content": "true"})
    if r is None or r.status_code != 200:
        return []
    res = []
    for j in r.json().get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        if not is_indonesia(loc):
            continue
        role = classify_role(j.get("title", ""))
        if not role:
            continue
        text = html_to_text(j.get("content"))
        res.append(Posting("greenhouse", str(j["id"]), j.get("absolute_url", ""), j.get("title", ""), slug, loc,
                           ts_to_date(j.get("first_published") or j.get("updated_at")), text, role,
                           detect_language(text)))
    return res


def _lever(client, slug):
    r = client.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"})
    if r is None or r.status_code != 200:
        return []
    res = []
    for j in r.json():
        cats = j.get("categories") or {}
        loc = cats.get("location", "") or ", ".join(cats.get("allLocations", []) or [])
        if not is_indonesia(loc):
            continue
        role = classify_role(j.get("text", ""))
        if not role:
            continue
        parts = [j.get("descriptionPlain") or html_to_text(j.get("description"))]
        for lst in j.get("lists", []) or []:
            parts.append(lst.get("text", "") + ":\n" + html_to_text(lst.get("content")))
        parts.append(j.get("additionalPlain") or "")
        text = "\n\n".join(p for p in parts if p)
        res.append(Posting("lever", j["id"], j.get("hostedUrl", ""), j.get("text", ""), slug, loc,
                           ts_to_date(j.get("createdAt")), text, role, detect_language(text)))
    return res


def _smartrecruiters(client, slug):
    r = client.get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings", params={"country": "id", "limit": 100})
    if r is None or r.status_code != 200:
        return []
    res = []
    for j in r.json().get("content", []):
        role = classify_role(j.get("name", ""))
        if not role:
            continue
        d = client.get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings/{j['id']}")
        if d is None or d.status_code != 200:
            continue
        dj = d.json()
        secs = (dj.get("jobAd") or {}).get("sections") or {}
        text = "\n\n".join(html_to_text((secs.get(k) or {}).get("text")) for k in
                           ["companyDescription", "jobDescription", "qualifications", "additionalInformation"])
        loc = (j.get("location") or {})
        loc_s = ", ".join(x for x in [loc.get("city"), loc.get("country")] if x)
        res.append(Posting("smartrecruiters", j["id"], dj.get("postingUrl", ""), j.get("name", ""), slug, loc_s,
                           ts_to_date(j.get("releasedDate")), text.strip(), role, detect_language(text)))
    return res


def _ashby(client, slug):
    r = client.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    if r is None or r.status_code != 200:
        return []
    res = []
    for j in r.json().get("jobs", []):
        loc = j.get("location", "") + " " + " ".join(x.get("location", "") for x in j.get("secondaryLocations", []) or [])
        if not is_indonesia(loc):
            continue
        role = classify_role(j.get("title", ""))
        if not role:
            continue
        text = j.get("descriptionPlain") or html_to_text(j.get("descriptionHtml"))
        res.append(Posting("ashby", j.get("id", ""), j.get("jobUrl", ""), j.get("title", ""), slug, loc.strip(),
                           ts_to_date(j.get("publishedAt")), text, role, detect_language(text)))
    return res


def _recruitee(client, slug):
    r = client.get(f"https://{slug}.recruitee.com/api/offers/")
    if r is None or r.status_code != 200 or "json" not in r.headers.get("content-type", ""):
        return []
    res = []
    for j in r.json().get("offers", []):
        loc = ", ".join(x for x in [j.get("city"), j.get("country")] if x)
        if not is_indonesia(loc):
            continue
        role = classify_role(j.get("title", ""))
        if not role:
            continue
        text = html_to_text((j.get("description") or "") + (j.get("requirements") or ""))
        res.append(Posting("recruitee", str(j.get("id")), j.get("careers_url", ""), j.get("title", ""), slug, loc,
                           ts_to_date(j.get("published_at") or j.get("created_at")), text, role, detect_language(text)))
    return res


BOARDS = {"greenhouse": _greenhouse, "lever": _lever, "smartrecruiters": _smartrecruiters,
          "ashby": _ashby, "recruitee": _recruitee}


def scrape_workday(client: PoliteClient, sites=None, verbose=True) -> list[Posting]:
    """Workday career sites expose a public JSON search used by their own frontend."""
    out: dict[str, Posting] = {}
    for tenant, dc, site in sites or WORKDAY_SITES:
        base = f"https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}"
        paths: dict[str, dict] = {}
        for q in WORKDAY_QUERIES:
            try:
                r = client.client.post(f"{base}/jobs", json={"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": q},
                                       headers={"Content-Type": "application/json", "Accept": "application/json"})
            except Exception:
                break
            if r.status_code != 200:
                break
            for jp in r.json().get("jobPostings", []):
                paths.setdefault(jp.get("externalPath", ""), jp)
        kept = 0
        for path, jp in paths.items():
            role = classify_role(jp.get("title", ""))
            if not path or not role:
                continue
            d = client.get(f"{base}{path}")
            if d is None or d.status_code != 200:
                continue
            info = d.json().get("jobPostingInfo", {})
            loc = " ".join(filter(None, [info.get("location"), " ".join(info.get("additionalLocations") or []),
                                         jp.get("locationsText")]))
            country = (info.get("country") or {}).get("descriptor", "") if isinstance(info.get("country"), dict) else ""
            if not (is_indonesia(loc) or is_indonesia(country)):
                continue
            text = html_to_text(info.get("jobDescription"))
            key = f"{tenant}:{info.get('jobReqId') or path}"
            out[key] = Posting("workday", key, info.get("externalUrl", ""), info.get("title", jp.get("title", "")),
                               tenant, loc.strip(), ts_to_date(info.get("startDate")), text, role, detect_language(text),
                               raw_meta={"posted_on": info.get("postedOn"), "time_type": info.get("timeType")})
            kept += 1
        if verbose and paths:
            print(f"[workday] {tenant}/{site}: searched={len(paths)} kept={kept}")
    return list(out.values())


def scrape_boards(client: PoliteClient, slugs=None, verbose=True) -> tuple[list[Posting], dict]:
    found, hits = [], {}
    for slug in slugs or COMPANY_SLUGS:
        for name, fn in BOARDS.items():
            try:
                res = fn(client, slug)
            except Exception as e:  # a malformed board must not stop the run
                if verbose:
                    print(f"[ats] {name}/{slug} error {type(e).__name__}")
                continue
            if res:
                hits[f"{name}/{slug}"] = len(res)
                found.extend(res)
                if verbose:
                    print(f"[ats] {name}/{slug}: {len(res)} role-matched postings in Indonesia")
    return found, hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-boards", action="store_true")
    ap.add_argument("--only-slugs", nargs="*", default=None, help="probe only these company slugs")
    args = ap.parse_args()
    client = PoliteClient(min_interval=0.25)
    rows = [p.to_dict() for p in scrape_workable(client)]
    rows += [p.to_dict() for p in scrape_workday(client)]
    if not args.skip_boards:
        boards, hits = scrape_boards(client, slugs=args.only_slugs)
        rows += [p.to_dict() for p in boards]
        print(f"[ats] boards with hits: {hits}")
    client.close()
    stamp = datetime.now().strftime("%Y%m%d")
    path = RAW_DIR / f"ats_{stamp}.jsonl"
    print(f"[ats] wrote {write_jsonl(path, rows)} postings -> {path}")


if __name__ == "__main__":
    main()
