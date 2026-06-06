# bizfinder.ie

A national **Irish B2B business directory + analytics platform**. Users search businesses by name,
type, location, or reverse phone lookup, on the web and a mobile app. The revenue product is
**analytics sold back to businesses** (search impressions, click-throughs, calls generated, time on
listing), with a website-build upsell for businesses that lack one.

> Working name `bizfinder-ie` — rename when the brand is chosen. Two-developer project.

---

## Table of contents
- [How it works (the strategy)](#how-it-works-the-strategy)
- [Architecture](#architecture)
- [Repo layout](#repo-layout)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Running each piece](#running-each-piece)
- [Data pipeline (scrape → resolve)](#data-pipeline-scrape--resolve)
- [API reference](#api-reference)
- [Stripe billing](#stripe-billing)
- [Mobile app (Expo)](#mobile-app-expo)
- [SEO landing pages](#seo-landing-pages)
- [What's been built (changelog)](#whats-been-built-changelog)
- [Working together](#working-together)
- [Roadmap / open items](#roadmap--open-items)

---

## How it works (the strategy)
1. **SEO is the acquisition flywheel.** Server-rendered listing + category/county pages rank for
   long-tail searches ("plumbers in Galway") and pull organic traffic. That traffic *generates* the
   impression/click/call data.
2. **The app is where engagement + the richest data live** (precise tap-to-call tracking).
3. **Analytics monetizes the captured attention** — businesses pay to see their metrics.
4. **Website upsell** to businesses with no site (highest-need segment).

Two surfaces feed one API and one event pipeline, tagged by `surface` (`web` | `ios` | `android`).

## Architecture
```
Python scrapers ──weekly──> business_sources (raw, append-only, per-source provenance)
                                   │
                          entity-resolution (resolve.py)  ← dedup/merge, the hard core
                                   ▼
                            businesses (canonical)
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                               ▼
            Node/Fastify API ─────────────> Next.js web (SSR, SEO, listings + landing pages)
            (search, analytics, billing) ──> React Native / Expo app (search, listing, tap-to-call)
                    ▲                               │  events tagged surface=web|ios|android
                    │                               ▼
                    └──────────────────── listing_events (append-only)
                                              │ nightly rollup (rollup.mjs)
                                              ▼
                                       analytics_daily ──> paid dashboard (Stripe-gated)
```
**The hard core is entity resolution.** The same business appears across sources with different
names/addresses. Scrapers write to `business_sources`; `resolve.py` collapses them into canonical
`businesses`. **Never write directly to `businesses`.**

## Repo layout
```
api/                Node + Fastify API (TypeScript)
web/                Next.js 14 web app (App Router, SSR)
app/                React Native / Expo app (SDK 54) — ISOLATED install (see app/README.md)
packages/shared/    Shared TS types, zod schemas, typed API client (used by web + app)
scrapers/           Python scrapers + entity resolution (OSM Overpass, CRO)
db/                 SQL migrations + migration/rollup runners
docs/PLAN.md        The approved product/build plan
CLAUDE.md           Shared conventions (loaded by Claude Code sessions)
TASKS.md            Work board (who's doing what)
```

## Tech stack
- **API:** Node + **Fastify** + `pg`, TypeScript (run with `tsx`).
- **Web:** **Next.js 14** (App Router, SSR) + schema.org structured data.
- **App:** **React Native / Expo SDK 54** (expo-router), TypeScript.
- **Shared:** TypeScript types + **zod** validation + a typed fetch client.
- **DB:** **Supabase Postgres** with `postgis` (geo), `pg_trgm` (fuzzy name), `vector` (pgvector, for
  future semantic search).
- **Scrapers:** Python (requests, psycopg, phonenumbers).
- **Payments:** **Stripe** (Checkout + webhooks).

## Quick start
```bash
# 1. Clone + install (root installs api/web/shared via npm workspaces)
git clone https://github.com/LashaJaparidze15/bizfinder-ie.git
cd bizfinder-ie
npm install

# 2. Env: copy the example and fill in (see below)
cp .env.example .env

# 3. Create the DB schema (needs DATABASE_URL set)
node db/migrate.mjs

# 4. Run API + web (two terminals)
npm run api      # Fastify on :4000
npm run web      # Next.js on :3000
```

### Environment variables (`.env`, gitignored)
| Var | What | Needed for |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres (session pooler URI) | everything |
| `API_PORT` | API port (default 4000) | API |
| `OVERPASS_URL`, `SCRAPER_USER_AGENT`, `DEV_COUNTY` | scraper config | scrapers |
| `CRO_API_EMAIL`, `CRO_API_KEY` | CRO Open Services (free, register at services.cro.ie) | CRO ingest |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | Stripe | billing |

## Running each piece
| Component | Command | Notes |
|---|---|---|
| API | `npm run api` | Fastify on `:4000`; works without DB (routes 503) |
| Web | `npm run web` | Next.js on `:3000` |
| Migrations | `node db/migrate.mjs` | runs `db/migrations/*.sql` in order |
| Analytics rollup | `node db/rollup.mjs` | `listing_events` → `analytics_daily` (cron nightly) |
| OSM scraper | `cd scrapers && .venv/Scripts/python osm_overpass.py --county Galway --write` | dry-run without `--write` |
| Entity resolution | `cd scrapers && .venv/Scripts/python resolve.py` | merges sources → businesses |
| Mobile app | `cd app && npx expo start` | see [Mobile app](#mobile-app-expo) |

Python setup: `cd scrapers && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt`.

## Data pipeline (scrape → resolve)
1. **Scrape** → `osm_overpass.py` (live, national-capable; stamps county) and `cro_ingest.py`
   (CRO company search — implemented, needs an API key). Both write RAW rows to `business_sources`.
2. **Resolve** → `resolve.py` takes the latest unmatched source rows and either matches an existing
   business (by E.164 phone, or normalized name + PostGIS proximity ≤150 m) or creates a new
   canonical `businesses` row (+ `locations`, `phone_numbers`, auto-created `categories`). Idempotent.
3. Phones normalized to **E.164** at write time (enables reverse lookup + dedup).

## API reference
| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | health + DB status |
| GET | `/api/search?q=&category=&county=&lat=&lng=&phone=` | search (trgm name, PostGIS closest, E.164 reverse lookup) |
| GET | `/api/businesses/:slug` | single listing payload |
| GET | `/api/slugs` | all slugs (sitemap) |
| GET | `/api/counties` · `/api/categories?county=` · `/api/listings?category=&county=&limit=&offset=` | directory / SEO pages |
| POST | `/api/events` | ingest impression/click/call/dwell (tagged `surface`, IP/UA hashed) |
| GET | `/api/analytics/:businessId?days=` | dashboard data (totals + web-vs-app + daily). **402** if billing on and not subscribed |
| POST | `/api/claims` · `/api/takedowns` | claim a listing · GDPR objection (un-verifies a phone) |
| POST | `/api/billing/checkout` · `/api/billing/webhook` · GET `/api/billing/status` | Stripe subscription flow |

## Stripe billing
- Test-mode keys in `.env`. Subscription unlocks `/api/analytics`; the web dashboard shows a paywall
  (`SubscribeButton`) until active.
- Flow: web `Subscribe` → `/api/billing/checkout` (Stripe Checkout session, also links a `claim`) →
  pay → `checkout.session.completed` webhook → `subscriptions` row `active` → dashboard unlocks.
- Local webhooks: `stripe listen --forward-to localhost:4000/api/billing/webhook` (gives the `whsec_`).
- Test card `4242 4242 4242 4242`, any future expiry/CVC.
- Billing **degrades gracefully** without keys (checkout 503, analytics open) — same pattern as the DB.

## Mobile app (Expo)
**Install inside `app/`** (it's intentionally NOT a root workspace — see `app/README.md`):
```bash
cd app
npm install
npx expo start          # scan the QR with Expo Go (iOS Camera app / inside Expo Go on Android)
```
- `app.json` → `extra.apiUrl` must be the PC's **LAN IP** (e.g. `http://192.168.x.x:4000`) so a
  physical phone can reach the API — `localhost` won't work from the device. Update if your IP changes.
- Same network for phone + PC, and allow inbound on ports **8081** (Metro) and **4000** (API) through
  the firewall, or use `npx expo start --tunnel`.

## What's been built (changelog)
**Phase 0 — foundations**
- Monorepo + coordination files; Supabase schema (11 tables) with PostGIS/pg_trgm/pgvector.
- OSM Overpass scraper (live-verified) + CRO ingest (implemented, needs key).
- Entity resolution v1 (`resolve.py`) — dedup verified idempotent.

**Phase 1 — directory across both surfaces**
- Fastify API: search (name/geo/reverse-phone), listings, events, claims, takedowns.
- Next.js web: SSR listing pages with schema.org `LocalBusiness`, sitemap, analytics beacons,
  reverse-phone search, "no website" upsell banner, app-install deep link.
- Expo app: search + listing + tap-to-call (fires `call` events).
- **SEO landing pages:** `/[county]` hubs + `/[county]/[category]` listings with `ItemList` +
  `BreadcrumbList` schema, pagination, internal linking, sitemap.

**Phase 2 — monetization**
- Nightly rollup (`rollup.mjs`) → `analytics_daily` (per surface).
- `/api/analytics/:id` dashboard data + web dashboard UI.
- Stripe billing: checkout + webhook + subscription gate + web subscribe CTA (verified end-to-end
  with a real test payment).

**Verified end-to-end (2026-06-06):** scraper → dedup → API → web directory + SEO pages → mobile app
on-device → analytics → live Stripe payment.

## Working together
- **`CLAUDE.md`** — shared conventions; read it before starting.
- **`docs/PLAN.md`** — the product/build plan.
- **`TASKS.md`** — the work board. Claim a task (set owner + status), commit, push, to avoid collisions.
- **Branches:** one per task `feat/<area>-<task>`; PRs to `main`.
- **Hard rules:** never scrape into `businesses` (use `business_sources` + resolve); normalize phones
  to E.164; serve analytics from `analytics_daily`, not raw events; tag events with `surface`; honor
  takedowns; free data only for now (OSM + CRO, no paid Google).

## Roadmap / open items
- **CRO ingest** — code ready; waiting on API key activation (signed T&C to crosupportservices@cro.ie).
  Unlocks official company data, cross-source dedup, and town-level pages.
- **Scale the scrape** beyond Galway to more counties.
- **First-party reviews** (owned data + display + rating into search).
- **Photo enrichment** — legit layered pipeline (og:image → logo → Mapillary storefront → category
  fallback; Google Street View/Places on-demand). No scraping of Google.
- **pgvector semantic search / AI recommendations** (column exists, unused).
- **Deploy** (Supabase + Vercel for web + a small VPS for API/scrapers; EAS for app store builds).
