"""
Fast entity-resolution: same semantics as resolve.py, but built for a
high-latency remote DB. resolve.py does ~5 sequential round-trips PER row; at
~400ms RTT to Supabase that's hours for 47k rows. Here we instead:

  1. Load existing state (phones, name+geo, slugs, categories) in a few queries.
  2. Do all matching in memory (phone exact -> normalized_name + geo<=150m -> create),
     keeping in-run creations matchable by later rows (identical to resolve.py).
  3. Bulk-write everything with pipelined executemany + a single UPDATE..FROM for links.

Idempotent: only touches business_sources rows with business_id IS NULL.
Run after scraping (instead of resolve.py):  python resolve_fast.py
"""
from __future__ import annotations

import json
import math
import os
import sys

import psycopg
from dotenv import load_dotenv

from resolve import normalize_name, slugify, trust_score

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def unique_slug_mem(base: str, slugs: set[str]) -> str:
    slug = base or "business"
    i = 2
    while slug in slugs:
        slug = f"{base}-{i}"
        i += 1
    slugs.add(slug)
    return slug


def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set")

    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            # The bulk UPDATE/inserts can legitimately exceed Supabase's default
            # 2-min statement_timeout; lift it for this session.
            cur.execute("set statement_timeout = 0")

            # ---- load existing state ----
            cur.execute("select e164, business_id from phone_numbers")
            phones: dict[str, int] = {e: b for e, b in cur.fetchall()}

            cur.execute(
                """select b.normalized_name,
                          ST_Y(l.geom::geometry), ST_X(l.geom::geometry), b.id
                     from businesses b join locations l on l.business_id = b.id"""
            )
            by_name: dict[str, list] = {}
            for norm, lat, lng, bid in cur.fetchall():
                by_name.setdefault(norm, []).append((lat, lng, bid))

            cur.execute("select slug from businesses")
            slugs: set[str] = {r[0] for r in cur.fetchall()}

            cur.execute("select slug, id from categories")
            cats: dict[str, int] = {s: i for s, i in cur.fetchall()}

            # ---- unmatched records (same selection/order as resolve.py) ----
            cur.execute(
                """select distinct on (source, source_record_id)
                          source, source_record_id, raw_payload
                     from business_sources
                    where business_id is null
                    order by source, source_record_id, scraped_at desc"""
            )
            rows = cur.fetchall()
            print(f"{len(rows)} unmatched records; resolving in memory...", file=sys.stderr)

            # ---- in-memory resolution ----
            # ref: int >=0 = existing business id; int <0 = new business (index -ref-1)
            new_biz: list[dict] = []          # {slug,name,norm,cat_slug,trust,has_website,website}
            new_locs: list[tuple] = []        # (ref, address, eircode, county, town, lat, lng)
            new_phones: list[tuple] = []      # (ref, e164)
            links: list[tuple] = []           # (source, source_record_id, ref)
            need_cat_slugs: set[str] = set()
            created = matched = 0

            for source, srid, payload in rows:
                p = payload if isinstance(payload, dict) else json.loads(payload)
                name = p.get("name")
                if not name:
                    continue
                norm = normalize_name(name)
                phone = p.get("phone_e164")
                lat, lng = p.get("lat"), p.get("lng")

                ref = None
                if phone and phone in phones:
                    ref = phones[phone]
                if ref is None and lat and lng and norm in by_name:
                    for blat, blng, bref in by_name[norm]:
                        if blat is not None and haversine_m(lat, lng, blat, blng) <= 150:
                            ref = bref
                            break

                if ref is None:
                    slug = unique_slug_mem(slugify(name), slugs)
                    ref = -(len(new_biz) + 1)
                    cat_slug = slugify(p["category_hint"]) if p.get("category_hint") else None
                    if cat_slug and cat_slug not in cats:
                        need_cat_slugs.add(cat_slug)
                    new_biz.append({
                        "slug": slug, "name": name, "norm": norm, "cat_slug": cat_slug,
                        "trust": trust_score(p), "has_website": bool(p.get("website")),
                        "website": p.get("website"),
                        "_hint": p.get("category_hint"),
                    })
                    if lat and lng:
                        new_locs.append((ref, p.get("address_line"), p.get("eircode"),
                                         p.get("county"), p.get("town"), lat, lng))
                        by_name.setdefault(norm, []).append((lat, lng, ref))
                    if phone:
                        phones[phone] = ref
                        new_phones.append((ref, phone))
                    created += 1
                else:
                    if phone and phone not in phones:
                        phones[phone] = ref
                        new_phones.append((ref, phone))
                    matched += 1

                links.append((source, srid, ref))

            print(f"  in-memory done: would create={created} matched={matched}; writing...", file=sys.stderr)

            # ---- bulk write ----
            # 1) new categories
            if need_cat_slugs:
                cat_rows = [(s.replace("-", " ").title(), s) for s in need_cat_slugs]
                cur.executemany(
                    "insert into categories (name, slug) values (%s,%s) on conflict (slug) do nothing",
                    cat_rows,
                )
                cur.execute("select slug, id from categories where slug = any(%s)", (list(need_cat_slugs),))
                for s, i in cur.fetchall():
                    cats[s] = i

            # 2) new businesses
            if new_biz:
                cur.executemany(
                    """insert into businesses (slug, name, normalized_name, category_id,
                                               trust_score, has_website, website_url)
                       values (%s,%s,%s,%s,%s,%s,%s)""",
                    [(b["slug"], b["name"], b["norm"], cats.get(b["cat_slug"]),
                      b["trust"], b["has_website"], b["website"]) for b in new_biz],
                )
                cur.execute(
                    "select slug, id from businesses where slug = any(%s)",
                    ([b["slug"] for b in new_biz],),
                )
                slug_to_id = {s: i for s, i in cur.fetchall()}
            else:
                slug_to_id = {}

            def real_id(ref: int) -> int:
                return ref if ref >= 0 else slug_to_id[new_biz[-ref - 1]["slug"]]

            # 3) locations for new businesses
            if new_locs:
                cur.executemany(
                    """insert into locations (business_id, address_line, eircode, county, town, geom)
                       values (%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)""",
                    [(real_id(ref), addr, eir, cty, town, lng, lat)
                     for (ref, addr, eir, cty, town, lat, lng) in new_locs],
                )

            # 4) phones (new + newly-attached to matched)
            if new_phones:
                cur.executemany(
                    """insert into phone_numbers (business_id, e164, source)
                       values (%s,%s,'osm') on conflict (business_id, e164) do nothing""",
                    [(real_id(ref), e164) for (ref, e164) in new_phones],
                )

            # 5) link business_sources -> business via one UPDATE..FROM a temp table
            if links:
                cur.execute(
                    "create temp table _links (source text, srid text, bid bigint) on commit drop"
                )
                cur.executemany(
                    "insert into _links (source, srid, bid) values (%s,%s,%s)",
                    [(s, sr, real_id(ref)) for (s, sr, ref) in links],
                )
                cur.execute("create index on _links (source, srid)")
                cur.execute(
                    """update business_sources b set business_id = t.bid
                         from _links t
                        where b.source = t.source and b.source_record_id = t.srid
                          and b.business_id is null"""
                )

        conn.commit()

    print(f"Done. created={created} matched={matched}", file=sys.stderr)


if __name__ == "__main__":
    main()
