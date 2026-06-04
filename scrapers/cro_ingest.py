"""
CRO (Companies Registration Office) ingest -> business_sources.  [STUB]

CRO is the official, national registry of Irish companies — the trust backbone for our
data (registered name, company number, registered address, status). It complements OSM
(which has location + category but rarely phone/registration data).

ACCESS (to be set up — needs the user):
  * CRO Open Services API: https://services.cro.ie/ — free registration for an API key.
    Returns company data as JSON. Rate-limited.
  * Alternatively, CRO publishes downloadable bulk company datasets.

This module is a STUB: it defines the target record shape and the write path, but the
fetch() needs a real API key / data file before it can run. Same contract as the OSM
scraper — write RAW records to business_sources(source='cro'); entity-resolution merges
them into canonical businesses later.

Usage (once implemented):
    python cro_ingest.py --county Galway --write
"""
from __future__ import annotations

import json
import os
import sys


def to_source_record(company: dict) -> dict:
    """Map a CRO company payload to our business_sources record shape."""
    return {
        "source_record_id": str(company.get("company_num")),
        "name": company.get("company_name"),
        "company_number": company.get("company_num"),
        "status": company.get("company_status_desc"),
        "address_line": company.get("company_addr_1"),
        "county": company.get("county_description"),
        "eircode": company.get("eircode"),
        "registered_on": company.get("company_reg_date"),
        "raw": company,
    }


def fetch(county: str, limit: int) -> list[dict]:
    raise NotImplementedError(
        "CRO fetch not implemented yet — register at https://services.cro.ie/ for an API "
        "key, set CRO_API_KEY in .env, then implement the company-search call here."
    )


def write_to_db(records: list[dict]) -> int:
    import psycopg

    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set — cannot --write.")
    inserted = 0
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        for r in records:
            cur.execute(
                """insert into business_sources (source, source_record_id, raw_payload)
                   values ('cro', %s, %s)""",
                (r["source_record_id"], json.dumps(r)),
            )
            inserted += 1
        conn.commit()
    return inserted


if __name__ == "__main__":
    print(__doc__)
    print("STUB — implement fetch() once CRO API access is set up.", file=sys.stderr)
