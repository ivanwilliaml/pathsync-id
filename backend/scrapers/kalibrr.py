"""Scraper for Kalibrr's public job-board search endpoint (Indonesia).

The kalibrr.com job board reads from the endpoint below; robots.txt does not
disallow it. Search results already carry the full description and
qualifications, so no per-posting detail request is needed.

    GET https://www.kalibrr.com/kjs/job_board/search?text=<q>&limit<=100&offset=<n>&country=Indonesia
"""
from __future__ import annotations

import argparse
from datetime import datetime

from .common import RAW_DIR, PoliteClient, Posting, classify_role, detect_language, html_to_text, ts_to_date, write_jsonl
from .karirhub import KEYWORDS

BASE = "https://www.kalibrr.com/kjs/job_board/search"
PAGE = 100


def scrape(keywords: list[str] | None = None, max_per_keyword: int = 1200, verbose: bool = True) -> list[dict]:
    client = PoliteClient(min_interval=0.5, headers={"User-Agent": "Mozilla/5.0 (PathSync research crawler)"})
    out: dict[str, dict] = {}
    for kw in keywords or KEYWORDS:
        offset, kept = 0, 0
        while offset < max_per_keyword:
            r = client.get(BASE, params={"text": kw, "limit": PAGE, "offset": offset, "country": "Indonesia"})
            if r is None or r.status_code != 200:
                break
            payload = r.json()
            jobs = payload.get("jobs", [])
            total = int(payload.get("count") or 0)
            for j in jobs:
                title = j.get("name") or ""
                role = classify_role(title)
                jid = str(j.get("id"))
                if not role or jid in out:
                    continue
                desc = html_to_text(j.get("description"))
                qual = html_to_text(j.get("qualifications"))
                text = "\n\n".join(x for x in [desc, ("Qualifications:\n" + qual) if qual else ""] if x)
                loc = (j.get("google_location") or {}).get("address_components") or {}
                code = (j.get("company") or {}).get("code") or ""
                p = Posting(
                    source="kalibrr", source_id=jid,
                    url=f"https://www.kalibrr.com/c/{code}/jobs/{jid}/{j.get('slug', '')}",
                    title=title, company=j.get("company_name") or "",
                    location=", ".join(x for x in [loc.get("city"), loc.get("country")] if x) or "Indonesia",
                    published_at=ts_to_date(j.get("activation_date") or j.get("created_at")),
                    description_text=text, role=role, language=detect_language(text),
                    raw_meta={"function": j.get("function"), "tenure": j.get("tenure"),
                              "fresh_grads": j.get("is_open_to_fresh_grads"), "work_experience": j.get("work_experience"),
                              "education_level": j.get("education_level")},
                )
                out[jid] = p.to_dict()
                kept += 1
            if len(jobs) < PAGE or offset + PAGE >= total:
                break
            offset += PAGE
        if verbose:
            print(f"[kalibrr] keyword={kw!r:32s} kept={kept:4d} total={len(out)}")
    client.close()
    return list(out.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    rows = scrape()
    stamp = datetime.now().strftime("%Y%m%d")
    path = args.out or (RAW_DIR / f"kalibrr_{stamp}.jsonl")
    n = write_jsonl(path, rows)
    print(f"[kalibrr] wrote {n} postings -> {path}")


if __name__ == "__main__":
    main()
