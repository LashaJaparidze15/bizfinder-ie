"""
Photo enrichment (keyless layer): pull each business website's og:image.

For businesses with a website_url and no photo yet, fetch the homepage and extract the
Open Graph image (`og:image`, or `twitter:image` fallback) — the preview image the site
owner published specifically for embedding. Stores photo_url + photo_source='og'.

Businesses with no website (or no og:image) stay null → the frontend shows a category
placeholder. Paid layers (Mapillary storefront / Google Places) can be added as further
sources later.

Usage:
    python enrich_photos.py --limit 100        # process up to 100 un-enriched sites
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from urllib.parse import urljoin

import requests
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

UA = os.getenv("SCRAPER_USER_AGENT", "bizfinder-ie/0.1")

# og:image / twitter:image meta — handle either attribute order.
META_PATTERNS = [
    re.compile(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\']', re.I),
]


def extract_og_image(html: str, base_url: str) -> str | None:
    for pat in META_PATTERNS:
        m = pat.search(html)
        if m:
            return urljoin(base_url, m.group(1).strip())
    return None


def fetch_og_image(url: str) -> str | None:
    try:
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=8, allow_redirects=True)
        if resp.status_code != 200 or "text/html" not in resp.headers.get("content-type", ""):
            return None
        return extract_og_image(resp.text[:200_000], resp.url)
    except requests.RequestException:
        return None


def main() -> None:
    import psycopg

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between requests")
    args = ap.parse_args()

    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set")

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """select id, website_url from businesses
                    where website_url is not null and photo_url is null
                    limit %s""",
                (args.limit,),
            )
            rows = cur.fetchall()
            print(f"{len(rows)} businesses to try...", file=sys.stderr)

            found = 0
            for biz_id, site in rows:
                img = fetch_og_image(site)
                if img:
                    cur.execute(
                        "update businesses set photo_url=%s, photo_source='og' where id=%s",
                        (img, biz_id),
                    )
                    found += 1
                time.sleep(args.delay)
            conn.commit()
            print(f"Done. og:image found for {found}/{len(rows)}.", file=sys.stderr)


if __name__ == "__main__":
    main()
