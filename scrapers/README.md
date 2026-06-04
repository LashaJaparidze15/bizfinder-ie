# Scrapers

Python scrapers that pull public Irish business data into `business_sources` (raw, append-only).
The entity-resolution job (`db/` + a future `resolve.py`) merges sources into canonical `businesses`.
**Never write directly to `businesses`.**

## Setup
```bash
cd scrapers
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
```
Set `DATABASE_URL` (and optionally `OVERPASS_URL`, `SCRAPER_USER_AGENT`) in the repo-root `.env`.

## OSM Overpass — `osm_overpass.py` (working)
National POI data: name, category, geo, sometimes phone/website.
```bash
python osm_overpass.py --county Galway --limit 50     # dry-run (prints sample, no DB)
python osm_overpass.py --county Galway --write         # persist to business_sources
```

## CRO — `cro_ingest.py` (stub)
Official company registry: registered name, number, address, status. The trust backbone.
Needs a free API key from https://services.cro.ie/ before `fetch()` can be implemented.

## Etiquette
Respect robots.txt, rate-limit, set the bot User-Agent, cache. Overpass is shared infra — keep
limits modest and run weekly, not in tight loops.
