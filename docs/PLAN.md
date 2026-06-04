# Plan: Irish B2B Business Directory + Analytics Platform

## Context

Two-developer greenfield product: a national Irish business directory (search by name, type,
location, and reverse phone lookup) whose real revenue is **analytics sold back to businesses**
(search impressions, click-throughs, calls generated, dwell time), plus an upsell to build basic
websites for businesses that lack one. Weekly scrapers pull public business data and reconcile it
against the canonical DB. No hard deadline. Infra budget is shoestring ("cloud credits" turned out
to mean the Claude Code subscription, not AWS/GCP credits).

**Two realities that shape the whole plan:**
1. **The flywheel is SEO, not analytics.** Nobody pays for analytics on a listing with 3 views/mo.
   The asset is organic search traffic to server-rendered listing pages; that traffic *generates*
   the impression/click/call data you then sell. Build the traffic engine first; analytics monetizes
   on top of it. Analytics tracking must run from day one so real data accrues before you sell.
2. **GDPR is low-but-nonzero risk, concentrated on sole traders.** "Publicly available" does NOT
   exempt aggregation under EU law. Company data (name, trading address, landline, category) is
   largely fine; risk concentrates where a "business number" is a personal mobile. Mitigation is
   cheap: a takedown/objection path + a `is_commercial_verified` flag. Reverse lookup stays IN scope
   with these guardrails. The "businesses without a website get ~50% less engagement" sales claim
   must be backed by **real measured data from our own platform**, never a fabricated figure.

## Decisions locked (from user)

- **Stack: Greenfield, API-first.** ONE Node API (NestJS/Express) serves both clients:
  Next.js (web/SEO directory) + **React Native (Expo) mobile app**. Python scrapers
  (Scrapy/Playwright) + Postgres (PostGIS + pgvector + pg_trgm) + Redis/BullMQ + Stripe.
  One TypeScript skillset across web + app + API (shared types, validation, API client, logic).
- **Mobile app is first-class** — most session volume + the richest analytics (precise tap-to-call
  tracking) are expected in-app. Web stays essential for SEO acquisition + as the app-install/
  deep-link target. See "Two surfaces" below.
- **Coverage: national from launch, every category the data supports.** Region-narrowing is a dev
  convenience only, never a launch strategy. Backbone sources (CRO, OSM) are national by nature.
- **Reverse phone lookup: in scope**, with takedown path + commercial-number flag.
- **Budget: shoestring.** Free national data only (OSM + CRO); no paid Google Places until revenue.

## Two surfaces (web vs app) — they're complementary, not competing

- **Acquisition is web/SEO.** Strangers Google "[trade] near me"; they don't search an app they
  haven't installed. Indexable Next.js listing pages are the top of the funnel + the install surface
  (deep-link "Open in app" CTAs) — essential regardless of where usage ends up.
- **Engagement + session volume is the app.** Repeat browsing, search, and especially **calls**
  happen in-app, where tap-to-call can be intercepted and tracked precisely. The richest data you
  sell originates here.
- Net: **web = acquisition/SEO/deep-link target; app = engagement + premium analytics.** Both feed
  the same API and the same event pipeline, tagged by `surface`.

## Hosting (cost-conscious, ~€5–15/mo to start)

- **DB:** Supabase free tier — Postgres with PostGIS, pgvector, pg_trgm all available.
- **Web frontend:** Vercel free tier (Next.js SSR/SSG).
- **Mobile app:** React Native via **Expo** — EAS Build (free tier) for app binaries; OTA updates.
  One-time Apple ($99/yr) + Google Play ($25) developer accounts are the only fixed app costs.
- **API + scrapers + Redis:** one small VPS (Hetzner ~€4–5/mo) running all three until traffic
  justifies splitting workers out.
- **Payments:** Stripe (free until you transact).

## Architecture

```
Python scrapers ──weekly──> business_sources (raw, append-only, per-source provenance)
                                   │
                          entity-resolution job (dedup/merge)
                                   │
                                   ▼
                            businesses (canonical)
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                               ▼
            Node API (one backend) ───────> Next.js web (SSR, SEO, install CTA)
            trust_score + pgvector  ───────> React Native app (Expo) — main usage
            AI recs (PostGIS+vec)            │
                    ▲                         │ events tagged surface=web|ios|android
                    │                         ▼
                    └──────────────── listing_events (append-only)
                                              │ nightly rollup
                                              ▼
                                       analytics_daily ──> paid dashboards (web + app)
```

**The hard core is entity resolution**, not the UI. Same pub appears in CRO, OSM, Golden Pages with
different names/addresses. Scrape into `business_sources`, then a matching job collapses sources into
one `businesses` row. Never scrape directly into the canonical table.

## Data schema (Postgres)

Enable extensions: `postgis`, `pg_trgm`, `vector`. Core tables:

```
businesses        id, slug, name, normalized_name, category_id, description,
                  trust_score, claimed_by(FK accounts null), has_website, website_url, timestamps
business_sources  id, business_id(null until matched), source(cro|osm|goldenpages|manual),
                  source_record_id, raw_payload(jsonb), scraped_at, confidence   -- raw, append-only
locations         id, business_id, address_line, eircode, county, town, geom(geography(Point,4326))
phone_numbers     id, business_id, e164(normalized), is_commercial_verified, source, last_seen_at
categories        id, parent_id, name, slug, embedding(vector)   -- hierarchical + semantic
listing_events    id, business_id, event_type(impression|click|call|dwell),
                  surface(web|ios|android), session_id, dwell_ms, referrer, ts,
                  ip_hash, user_agent_hash   -- append-only, biggest table
analytics_daily   business_id, date, surface, impressions, clicks, calls, avg_dwell_ms  -- nightly rollup
accounts          id, email, ...                                   -- paying businesses
subscriptions     id, account_id, plan, status, stripe_customer_id
claims            id, business_id, account_id, status, verified_at -- claim-your-listing flow
takedown_requests id, phone_number_id|business_id, reason, status  -- GDPR objection path
```

Schema rules: keep `businesses` separate from `business_sources` (dedup integrity); normalize phones
to E.164 at write time (libphonenumber) — enables both reverse lookup and dedup; serve dashboards
from `analytics_daily`, never raw events; hash IPs/user-agents in events (GDPR-cleaner + still unique
counts). Only move events to ClickHouse if/when raw rows hit hundreds of millions — not before.

## Scraping strategy

Free national sources first; paid/hostile sources only later.

| Source | Yields | Notes |
|---|---|---|
| **CRO** | registered company name/number/address/status | Official, national. Trust backbone. |
| **OSM Overpass** | POI name, category, geo, sometimes phone/website | Free, national, geo-rich. Seed for "closest". |
| **Eircode geocoding** | address → coordinates | Needed for PostGIS distance. |
| **Golden Pages / sector dirs** | phone, hours, category | Check ToS; scrape politely, low volume. |
| **Google Places API** | reviews/ratings | DEFER — costs money, scraping Maps violates ToS. |

Mechanics: Python (Scrapy for static, Playwright for JS-heavy). Weekly cron → enqueue jobs
(BullMQ/Redis) → workers write to `business_sources`. Each run diffs against existing sources
(new / changed phone / closed) and stores every version — never overwrite blindly. Respect
robots.txt, rate-limit, identify the bot, cache — legal hygiene + avoids blocks.

## AI recommendation layer (keep it simple — no model training)

"Most reliable, closest, matches need" = one weighted SQL query, not an ML pipeline:
- **closest** → PostGIS distance on `locations.geom`.
- **reliable** → `trust_score` computed from data completeness + CRO-verified + recency + claimed.
- **matches need** → embed the user query + category/business text with pgvector, rank by cosine.

Ships in days, feels like AI. Add an LLM for natural-language query parsing later, once basics work.

## Two-developer coordination (keeps both Claude Code sessions in sync)

No live link exists between two separate Claude Code sessions — they sync through **shared git
artifacts**. Stand this up in Phase 0:

- **`CLAUDE.md`** (repo root, committed) — shared conventions + architecture so both sessions load
  the same ground truth every time. Distinct from each dev's personal `~/.claude` memory.
- **`docs/PLAN.md`** — this plan, committed into the repo (the source version lives in
  `~/.claude/plans/`, which is personal/not shared).
- **`TASKS.md`** — a simple board both Claudes read + update (task, owner, status). Marking a task
  in-progress and committing it is how the two sessions avoid collisions on `git pull`.
- **Branch + PR convention** — one branch per task (`feat/<area>-<task>`), PRs for review/merge;
  git is the actual sync layer. Optionally GitHub Issues instead of `TASKS.md` if you prefer.
- Within one machine, either dev's session can still parallelize via subagents / git worktrees.

## Build phases

Two devs: split as dev A = pipeline + API, dev B = web + app clients (shared TS API client/types).

**Phase 0 — Foundations (dev against one region for speed, pipeline national-capable):**
- Monorepo scaffold: `api/` (Node), `web/` (Next.js), `app/` (Expo RN), `scrapers/` (Python),
  `db/` (migrations), `packages/shared/` (TS types, validation, API client used by web + app).
- Coordination files committed at root: `CLAUDE.md`, `docs/PLAN.md`, `TASKS.md` + branch/PR
  convention (see "Two-developer coordination").
- Supabase project + extensions + schema migrations.
- OSM Overpass + CRO scrapers writing to `business_sources`.
- Entity-resolution v1 (name-normalize + geo-proximity + phone match → merge to `businesses`).
- API-first: define the Node API + shared client before either frontend.

**Phase 1 — Directory across both surfaces:**
- Next.js SSR listing pages: schema.org `LocalBusiness` markup, sitemaps, clean slugs, app-install
  deep-link CTAs. (The SEO acquisition engine — starts ripening immediately.)
- Expo app: search + listing + tap-to-call screens, consuming the same API/shared client.
- Search (both surfaces): name (pg_trgm fuzzy), category, location (PostGIS closest), reverse phone
  (E.164 exact).
- **Analytics tracking live from day one on both surfaces** — impression/click/call/dwell →
  `listing_events`, tagged `surface`. In-app tap-to-call intercepted for precise call counts.
- Claim-your-listing flow + takedown/objection endpoint.
- Launch national, all categories the data supports, web + app together.

**Phase 2 — Monetization (only after real traffic accrues):**
- Nightly rollup `listing_events` → `analytics_daily` (per `surface`).
- Paid analytics dashboard (Stripe subscription) showing web-vs-app breakdown.
- Cold outreach using REAL per-listing numbers ("340 impressions, 40 app calls last month").

**Phase 3 — Website upsell:** start as a productized manual service (template/Carrd) before any
builder software. Highest-margin tier.

## Go-to-market

The sequence IS the strategy: (1) become the best-ranked directory nationally via clean data + SSR +
schema markup, winning long-tail "[trade] in [town]" searches → free user traffic; (2) convert that
web traffic into **app installs** via deep-link CTAs — the app is where repeat usage + the richest
(call/dwell) data live; (3) analytics accrue silently on every listing across both surfaces;
(4) cold outreach with verifiable per-surface numbers as the trust wedge; (5) funnel: free listing
(SEO bait) → app engagement → paid analytics → website build. You're not selling analytics — you're
selling attention you already captured, which only works if the directory genuinely ranks first.

## Risks (ranked)

1. **Entity resolution / dedup** — deceptively hard technical core; budget real time.
2. **Chicken-and-egg** — analytics worthless without traffic → SEO-first, track from day one.
3. **GDPR** — narrow (sole-trader mobiles); mitigated by takedown path + commercial flag + privacy policy.
4. **Sales-claim truthfulness** — every quoted stat must be from our own measured data.

## Verification (end-to-end, per phase)

- **Phase 0:** run OSM+CRO scrapers for one county → confirm rows land in `business_sources`; run
  entity-resolution → confirm known duplicates (same business across CRO+OSM) collapse to one
  `businesses` row; spot-check phone normalization to E.164.
- **Phase 1 (web):** load a listing page → view source confirms SSR HTML + valid schema.org JSON-LD
  (Google Rich Results test); run each search type and confirm fuzzy/geo/phone results; trigger
  impression/click/call/dwell and confirm rows in `listing_events` with `surface=web`; submit a
  takedown → confirm it records and suppresses the number.
- **Phase 1 (app):** run the Expo app on a device/simulator → same search types return matching
  results from the same API; tap-to-call fires a `call` event with `surface=ios|android`; confirm
  deep link from a web listing opens the app to the right business.
- **Phase 2:** run nightly rollup → confirm `analytics_daily` matches raw event counts per `surface`
  for a sample business; complete a Stripe test-mode subscription → confirm dashboard unlocks and
  shows the web-vs-app breakdown.
