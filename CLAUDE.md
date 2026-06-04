# bizfinder-ie — Project Instructions (shared, committed)

> This file is the **shared ground truth** for every Claude Code session on this repo (both devs).
> It is committed to git, distinct from each dev's personal `~/.claude` memory. Two separate
> Claude Code sessions do not share context live — they sync through this repo. Keep this file and
> `TASKS.md` current; that's how we stay aligned.

## What this is
A national Irish B2B business directory (web + mobile app). Real revenue = analytics sold to
businesses (impressions, clicks, calls, dwell). Upsell = building basic websites. Full plan in
`docs/PLAN.md` — read it before starting work.

## Architecture (API-first)
- **One Node API** (`api/`) serves both clients. No business logic in the clients.
- **Web** (`web/`, Next.js) — SSR listing pages for SEO + app-install deep links.
- **App** (`app/`, React Native / Expo) — main usage surface + precise tap-to-call tracking.
- **Scrapers** (`scrapers/`, Python) — weekly OSM + CRO ingest into `business_sources`.
- **DB** — Postgres (Supabase) with `postgis`, `pg_trgm`, `vector`. Migrations in `db/migrations/`.
- **Shared** (`packages/shared/`) — TS types, zod validation, API client used by web + app.

## Hard rules
- **Never scrape directly into `businesses`.** Scrape into `business_sources`; the entity-resolution
  job merges into canonical `businesses`. Dedup integrity depends on this.
- **Normalize phones to E.164 at write time** (libphonenumber). Enables reverse lookup + dedup.
- **Serve analytics from `analytics_daily` rollups**, never from raw `listing_events`.
- **Tag every analytics event with `surface`** (`web|ios|android`).
- **GDPR guardrail:** honor `takedown_requests`; flag `phone_numbers.is_commercial_verified`. Any
  "X% less engagement" sales figure must come from real measured data, never a made-up number.
- **Free data only for now:** OSM + CRO. No paid Google Places until there's revenue.
- Be a polite scraper: respect robots.txt, rate-limit, set the bot User-Agent, cache.

## Conventions
- Language: TypeScript across api/web/app/shared; Python for scrapers.
- Branch per task: `feat/<area>-<short-task>` (e.g. `feat/api-search`). PRs to `main`.
- Secrets in `.env` (gitignored); update `.env.example` when adding a var.
- Before starting work: pull, read `TASKS.md`, claim a task (set owner + in-progress, commit).
