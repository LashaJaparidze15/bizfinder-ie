"""
CRO (Companies Registration Office) ingest -> business_sources.

Uses the CRO Open Services FREE "Company search" API:
    https://services.cro.ie/cws/companies
Authenticated via HTTP Basic Auth (registered email + API key). The search itself is
free of charge. Returns Company objects (name, number, address, status) — our official
trust backbone, complementing OSM (which has geo+category but no registration data).

Writes RAW records to business_sources(source='cro'); resolve.py merges into businesses.

Env (.env):
    CRO_API_EMAIL, CRO_API_KEY, DATABASE_URL

Usage:
    python cro_ingest.py --county Galway --limit 100            # dry-run
    python cro_ingest.py --county Galway --limit 100 --write    # persist
    python cro_ingest.py --name "supermac" --limit 20           # search by name
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

CRO_URL = "https://services.cro.ie/cws/companies"
EMAIL = os.getenv("CRO_API_EMAIL")
KEY = os.getenv("CRO_API_KEY")


def fetch(name: str | None = None, address: str | None = None, limit: int = 100) -> list[dict]:
    if not EMAIL or not KEY:
        sys.exit("CRO_API_EMAIL / CRO_API_KEY not set — register at services.cro.ie for a free key.")

    # company_bus_ind=E -> include both companies and registered business names.
    params = {
        "company_bus_ind": "E",
        "searchType": "CONTAINS",
        "max": limit,
        "skip": 0,
        "format": "json",
        "htmlEnc": 0,
    }
    if name:
        params["company_name"] = name
    if address:
        params["address"] = address

    resp = requests.get(CRO_URL, params=params, auth=(EMAIL, KEY), timeout=60)
    resp.raise_for_status()
    data = resp.json()
    # API may return a bare array or an object wrapping one.
    companies = data if isinstance(data, list) else data.get("companies", data.get("results", []))
    return [to_source_record(c, fallback_county=address) for c in companies]


def to_source_record(c: dict, fallback_county: str | None = None) -> dict:
    addr = " ".join(
        str(c[k]) for k in ("company_addr_1", "company_addr_2", "company_addr_3", "company_addr_4")
        if c.get(k)
    ) or None
    return {
        "source_record_id": str(c.get("company_num")),
        "name": c.get("company_name"),
        "company_number": c.get("company_num"),
        "status": c.get("company_status_desc"),
        "category_hint": c.get("company_type_desc"),
        "address_line": addr,
        "eircode": c.get("eircode"),
        "county": c.get("county") or fallback_county,
        "registered_on": c.get("company_reg_date"),
        "raw": c,
    }


def write_to_db(records: list[dict]) -> int:
    import psycopg

    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set — cannot --write.")
    inserted = 0
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        for r in records:
            if not r.get("source_record_id") or r["source_record_id"] == "None":
                continue
            cur.execute(
                """insert into business_sources (source, source_record_id, raw_payload)
                   values ('cro', %s, %s)""",
                (r["source_record_id"], json.dumps(r)),
            )
            inserted += 1
        conn.commit()
    return inserted


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", help="search by address/county")
    ap.add_argument("--name", help="search by company/business name")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--write", action="store_true", help="persist to business_sources")
    args = ap.parse_args()

    if not args.county and not args.name:
        sys.exit("provide --county or --name")

    print(f"CRO search (county={args.county} name={args.name} limit={args.limit})...", file=sys.stderr)
    records = fetch(name=args.name, address=args.county, limit=args.limit)
    print(f"  {len(records)} companies", file=sys.stderr)

    if args.write:
        n = write_to_db(records)
        print(f"Inserted {n} rows into business_sources.", file=sys.stderr)
    else:
        for r in records[:10]:
            print(json.dumps({k: r.get(k) for k in ("source_record_id", "name", "status", "county", "address_line")}))
        print(f"(dry-run: showed {min(10, len(records))} of {len(records)}; pass --write to persist)", file=sys.stderr)


if __name__ == "__main__":
    main()
