# TASKS — bizfinder-ie

> Shared work board for both devs. To avoid collisions: claim a task (put your name in **Owner**,
> set status to **WIP**), commit, push. On `git pull` the other session sees who's on what.
> Statuses: `TODO` · `WIP` · `BLOCKED` · `DONE`.

## Phase 0 — Foundations

| # | Task | Owner | Status |
|---|------|-------|--------|
| 0.1 | Init monorepo structure + root config | — | DONE |
| 0.2 | Coordination files (CLAUDE.md, PLAN.md, TASKS.md) | — | DONE |
| 0.3 | DB schema migration (extensions + tables + indexes) | — | DONE |
| 0.4 | Supabase project + run migrations | — | DONE (eu-west-1; 11 tables + 3 extensions verified) |
| 0.5 | `packages/shared` — types + zod + API client | — | DONE |
| 0.6 | `api/` skeleton — health + DB conn + search stub | — | DONE (boots; verified /health + 503 fallback) |
| 0.7 | OSM Overpass scraper (one county) → business_sources | — | DONE (verified live: 30 Galway POIs in dry-run) |
| 0.8 | CRO ingest → business_sources | — | IMPLEMENTED (free CWS company-search API; needs CRO_API_EMAIL+KEY to run) |
| 0.9 | Entity-resolution v1 (merge sources → businesses) | — | DONE (`resolve.py`; 300 rows→150 biz, dedup verified idempotent) |

**Phase 0 COMPLETE & verified** (2026-06-04): 150 Galway businesses live; API name/geo/reverse-phone
search + event ingest all working against Supabase. Next up: CRO API access, then Phase 1.

## Phase 1 — Directory (web + app)
| # | Task | Owner | Status |
|---|------|-------|--------|
| 1.1 | Next.js SSR listing pages + schema.org + sitemaps | — | DONE (verified: SSR HTML + JSON-LD + 150-url sitemap) |
| 1.2 | Expo app — search + listing + tap-to-call | — | CODE DONE + typechecks; Metro bundle needs monorepo install fix (see app/README) |
| 1.3 | Search: name/category/location/reverse-phone | — | DONE (API + web; app pending) |
| 1.4 | Analytics events (both surfaces) → listing_events | — | DONE web (beacon/call/dwell); app pending |
| 1.5 | Claim-listing flow + takedown endpoint | — | DONE (API verified: claim pending, takedown un-verifies phone) |

## Phase 2 — Monetization
| # | Task | Owner | Status |
|---|------|-------|--------|
| 2.1 | Nightly rollup → analytics_daily (per surface) | — | DONE (`db/rollup.mjs`; verified vs raw counts) |
| 2.2 | Analytics API (dashboard data, web-vs-app) | — | DONE (`/api/analytics/:id`; verified) |
| 2.3 | Stripe billing + subscription gate | — | IMPLEMENTED (checkout/webhook/status + 402 gate + web subscribe CTA; degrades gracefully; needs STRIPE_SECRET_KEY/PRICE_ID/WEBHOOK_SECRET to activate) |
| 2.4 | Dashboard UI (web) consuming /api/analytics | — | DONE (`/dashboard/[id]`; verified SSR shows totals + web-vs-app) |

## Notes / decisions
- Working repo name `bizfinder-ie` — rename when brand is chosen.
