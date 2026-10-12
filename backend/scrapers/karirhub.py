"""Scraper for Karirhub (Kementerian Ketenagakerjaan) public vacancy API.

Karirhub is the government job portal that aggregates vacancies from employers and
partner platforms. The site's own frontend reads from the public endpoints below;
we use the same endpoints at a polite rate.

    list   : GET https://api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies
             ?keyword=<q>&limit<=50&page=<n>
    detail : GET https://api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies/<id>
"""
from __future__ import annotations

import argparse
from datetime import datetime

from pathsync.roles import all_keywords

from .common import RAW_DIR, PoliteClient, Posting, classify_role, detect_language, html_to_text, ts_to_date, write_jsonl

BASE = "https://api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies"
HEADERS = {"Origin": "https://karirhub.kemnaker.go.id", "Referer": "https://karirhub.kemnaker.go.id/"}

KEYWORDS = all_keywords()


def list_keyword(client: PoliteClient, keyword: str, max_pages: int = 60) -> list[dict]:
    rows, page = [], 1
    while page <= max_pages:
        r = client.get(BASE, params={"keyword": keyword, "limit": 50, "page": page})
        if r is None or r.status_code != 200:
            break
        payload = r.json()
        rows.extend(payload.get("data", []))
        meta = payload.get("meta", {})
        if page >= int(meta.get("last_page") or 1):
            break
        page += 1
    return rows


def fetch_detail(client: PoliteClient, vid: str) -> dict | None:
    r = client.get(f"{BASE}/{vid}")
    if r is None or r.status_code != 200:
        return None
    return r.json().get("data")


def scrape(keywords: list[str] | None = None, verbose: bool = True) -> list[dict]:
    client = PoliteClient(min_interval=0.35, headers=HEADERS)
    seen: dict[str, dict] = {}
    for kw in keywords or KEYWORDS:
        items = list_keyword(client, kw)
        new = 0
        for it in items:
            if it["id"] not in seen:
                seen[it["id"]] = it
                new += 1
        if verbose:
            print(f"[karirhub] keyword={kw!r:24s} listed={len(items):5d} new={new}")

    candidates = [it for it in seen.values() if classify_role(it.get("title", ""))]
    if verbose:
        print(f"[karirhub] unique listed={len(seen)} role-matched={len(candidates)} -> fetching details")

    out: list[dict] = []
    for i, it in enumerate(candidates, 1):
        d = fetch_detail(client, it["id"])
        if not d:
            continue
        desc = html_to_text(d.get("description"))
        qual = html_to_text(d.get("qualification"))
        text = "\n\n".join(x for x in [desc, ("Kualifikasi:\n" + qual) if qual else ""] if x)
        region = (d.get("region") or {}).get("name") or ""
        employer = (d.get("employer") or {}).get("name") or it.get("company_name") or ""
        p = Posting(
            source="karirhub",
            source_id=it["id"],
            url=f"https://karirhub.kemnaker.go.id/lowongan-dalam-negeri/lowongan/{it['id']}",
            title=d.get("title") or it.get("title", ""),
            company=employer,
            location=region or "Indonesia",
            published_at=ts_to_date(d.get("published_at") or it.get("published_at")),
            description_text=text,
            role=classify_role(d.get("title") or it.get("title", "")),
            language=detect_language(text),
            raw_meta={
                "industry": it.get("industry_name"),
                "job_function": it.get("job_function_name"),
                "job_type": it.get("job_type_name"),
                "education": (d.get("min_education") or {}).get("name"),
                "platform": it.get("platform_name"),
                "platform_link": it.get("platform_link"),
                "expires_at": d.get("expires_at"),
                "created_at": d.get("created_at"),
            },
        )
        out.append(p.to_dict())
        if verbose and i % 25 == 0:
            print(f"[karirhub] details {i}/{len(candidates)}")
    client.close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    rows = scrape()
    stamp = datetime.now().strftime("%Y%m%d")
    path = args.out or (RAW_DIR / f"karirhub_{stamp}.jsonl")
    n = write_jsonl(path, rows)
    print(f"[karirhub] wrote {n} postings -> {path}")


if __name__ == "__main__":
    main()
