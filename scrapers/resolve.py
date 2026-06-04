"""
Entity-resolution v1: merge raw business_sources -> canonical businesses.

Strategy (v1):
  1. Take the LATEST unmatched row per (source, source_record_id).
  2. Try to match an existing canonical business:
       a. by phone (E.164 exact)            -- strong signal
       b. by normalized_name + geo <=150m   -- same name, near same spot
  3. Match -> link the source row(s) to that business.
     No match -> create a new business (+ location + phones + category).

Idempotent: re-running only processes rows still unmatched. Run after scraping:
    python resolve.py
"""
from __future__ import annotations

import json
import os
import re
import sys

import psycopg
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

LEGAL_SUFFIXES = re.compile(r"\b(ltd|ltd\.|limited|plc|teoranta|teo|cyf)\b", re.I)


def normalize_name(name: str) -> str:
    n = name.lower().strip()
    n = re.sub(r"^the\s+", "", n)
    n = LEGAL_SUFFIXES.sub("", n)
    n = re.sub(r"[^a-z0-9\s]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "business"


def get_or_create_category(cur, hint: str | None) -> int | None:
    if not hint:
        return None
    slug = slugify(hint)
    cur.execute("select id from categories where slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "insert into categories (name, slug) values (%s, %s) returning id",
        (hint.replace("_", " ").title(), slug),
    )
    return cur.fetchone()[0]


def unique_slug(cur, base: str) -> str:
    slug = base
    i = 2
    while True:
        cur.execute("select 1 from businesses where slug = %s", (slug,))
        if not cur.fetchone():
            return slug
        slug = f"{base}-{i}"
        i += 1


def trust_score(p: dict) -> float:
    score = 0.0
    if p.get("phone_e164"):
        score += 30
    if p.get("website"):
        score += 25
    if p.get("address_line"):
        score += 20
    if p.get("lat") and p.get("lng"):
        score += 15
    if p.get("category_hint"):
        score += 10
    return score


def find_match(cur, norm: str, phone: str | None, lat, lng) -> int | None:
    if phone:
        cur.execute("select business_id from phone_numbers where e164 = %s limit 1", (phone,))
        row = cur.fetchone()
        if row:
            return row[0]
    if lat and lng:
        cur.execute(
            """select b.id
                 from businesses b
                 join locations l on l.business_id = b.id
                where b.normalized_name = %s
                  and ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography, 150)
                limit 1""",
            (norm, lng, lat),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    return None


def create_business(cur, p: dict, norm: str) -> int:
    category_id = get_or_create_category(cur, p.get("category_hint"))
    slug = unique_slug(cur, slugify(p["name"]))
    cur.execute(
        """insert into businesses (slug, name, normalized_name, category_id, trust_score,
                                   has_website, website_url)
           values (%s,%s,%s,%s,%s,%s,%s) returning id""",
        (slug, p["name"], norm, category_id, trust_score(p), bool(p.get("website")), p.get("website")),
    )
    biz_id = cur.fetchone()[0]

    if p.get("lat") and p.get("lng"):
        cur.execute(
            """insert into locations (business_id, address_line, eircode, county, town, geom)
               values (%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)""",
            (biz_id, p.get("address_line"), p.get("eircode"), p.get("county"), p.get("town"),
             p["lng"], p["lat"]),
        )
    if p.get("phone_e164"):
        cur.execute(
            """insert into phone_numbers (business_id, e164, source)
               values (%s,%s,'osm') on conflict (business_id, e164) do nothing""",
            (biz_id, p["phone_e164"]),
        )
    return biz_id


def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set")

    created = matched = 0
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """select distinct on (source, source_record_id)
                          source, source_record_id, raw_payload
                     from business_sources
                    where business_id is null
                    order by source, source_record_id, scraped_at desc"""
            )
            rows = cur.fetchall()
            print(f"{len(rows)} unmatched source records to resolve...", file=sys.stderr)

            for source, source_record_id, payload in rows:
                p = payload if isinstance(payload, dict) else json.loads(payload)
                if not p.get("name"):
                    continue
                norm = normalize_name(p["name"])
                match_id = find_match(cur, norm, p.get("phone_e164"), p.get("lat"), p.get("lng"))

                if match_id:
                    biz_id = match_id
                    matched += 1
                    # attach a phone we didn't have yet
                    if p.get("phone_e164"):
                        cur.execute(
                            """insert into phone_numbers (business_id, e164, source)
                               values (%s,%s,'osm') on conflict (business_id, e164) do nothing""",
                            (biz_id, p["phone_e164"]),
                        )
                else:
                    biz_id = create_business(cur, p, norm)
                    created += 1

                # link ALL source rows for this record to the canonical business
                cur.execute(
                    """update business_sources set business_id = %s
                        where source = %s and source_record_id = %s""",
                    (biz_id, source, source_record_id),
                )
        conn.commit()

    print(f"Done. created={created} matched={matched}", file=sys.stderr)


if __name__ == "__main__":
    main()
