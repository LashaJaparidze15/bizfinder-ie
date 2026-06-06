"""
OSM Overpass scraper -> business_sources.

Fetches named businesses (shops, amenities, offices, crafts, tourism) within an Irish
county boundary and writes RAW records to business_sources (source='osm'). The
entity-resolution job later merges these into canonical `businesses`.

Usage:
    python osm_overpass.py --county Galway --limit 50            # dry-run (prints, no DB)
    python osm_overpass.py --county Galway --write               # writes to business_sources

Env (.env at repo root or scrapers/):
    DATABASE_URL, OVERPASS_URL, SCRAPER_USER_AGENT
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import phonenumbers
import requests
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
USER_AGENT = os.getenv("SCRAPER_USER_AGENT", "bizfinder-ie/0.1")

# Tag groups that indicate a real business POI.
POI_FILTERS = [
    'node["name"]["shop"](area.a);',
    'way["name"]["shop"](area.a);',
    'node["name"]["amenity"~"restaurant|cafe|pub|bar|fast_food|pharmacy|bank|fuel|dentist|doctors|veterinary|car_repair"](area.a);',
    'way["name"]["amenity"~"restaurant|cafe|pub|bar|fast_food|pharmacy|bank|fuel|dentist|doctors|veterinary|car_repair"](area.a);',
    'node["name"]["office"](area.a);',
    'way["name"]["office"](area.a);',
    'node["name"]["craft"](area.a);',
    'way["name"]["craft"](area.a);',
    'node["name"]["tourism"~"hotel|guest_house|hostel"](area.a);',
    'way["name"]["tourism"~"hotel|guest_house|hostel"](area.a);',
]


def build_query(county: str, limit: int) -> str:
    # Irish counties are admin boundaries; match "County X" or bare "X".
    area = (
        f'area["boundary"="administrative"]["name"~"^(County {county}|{county})$"]->.a;'
    )
    body = "\n  ".join(POI_FILTERS)
    return f"""[out:json][timeout:90];
{area}
(
  {body}
);
out center {limit};
"""


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        parsed = phonenumbers.parse(raw, "IE")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass
    return None


def to_source_record(el: dict) -> dict:
    tags = el.get("tags", {})
    # node has lat/lon; way (with `out center`) has center.
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    category = (
        tags.get("shop")
        or tags.get("amenity")
        or tags.get("office")
        or tags.get("craft")
        or tags.get("tourism")
    )
    phone_raw = tags.get("phone") or tags.get("contact:phone")
    addr_parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:city") or tags.get("addr:town"),
    ]
    return {
        "source_record_id": f"{el['type']}/{el['id']}",
        "name": tags.get("name"),
        "category_hint": category,
        "phone_raw": phone_raw,
        "phone_e164": normalize_phone(phone_raw),
        "website": tags.get("website") or tags.get("contact:website"),
        "address_line": " ".join(p for p in addr_parts if p) or None,
        "eircode": tags.get("addr:postcode"),
        "county": tags.get("addr:county"),
        "lat": lat,
        "lng": lon,
        "raw_tags": tags,
    }


def fetch(county: str, limit: int) -> list[dict]:
    query = build_query(county, limit)
    resp = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers={"User-Agent": USER_AGENT},
        timeout=120,
    )
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    records = [to_source_record(el) for el in elements if el.get("tags", {}).get("name")]
    # We queried within the county's boundary, so stamp it on each record
    # (OSM's addr:county tag is usually absent).
    for r in records:
        if not r.get("county"):
            r["county"] = county
    return records


def write_to_db(records: list[dict]) -> int:
    import psycopg

    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set — cannot --write.")

    inserted = 0
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for r in records:
                cur.execute(
                    """insert into business_sources (source, source_record_id, raw_payload)
                       values ('osm', %s, %s)""",
                    (r["source_record_id"], json.dumps(r)),
                )
                inserted += 1
        conn.commit()
    return inserted


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", default=os.getenv("DEV_COUNTY", "Galway"))
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--write", action="store_true", help="write to business_sources (else dry-run)")
    args = ap.parse_args()

    print(f"Fetching OSM businesses for County {args.county} (limit {args.limit})...", file=sys.stderr)
    t0 = time.time()
    records = fetch(args.county, args.limit)
    print(f"  {len(records)} records in {time.time() - t0:.1f}s", file=sys.stderr)

    if args.write:
        n = write_to_db(records)
        print(f"Inserted {n} rows into business_sources.", file=sys.stderr)
    else:
        # Dry-run: print a small sample as JSON.
        for r in records[:10]:
            print(json.dumps({k: r[k] for k in ("source_record_id", "name", "category_hint", "phone_e164", "county", "lat", "lng")}))
        print(f"(dry-run: showed {min(10, len(records))} of {len(records)}; pass --write to persist)", file=sys.stderr)


if __name__ == "__main__":
    main()
