-- bizfinder-ie :: initial schema
-- Postgres (Supabase). Run with: psql "$DATABASE_URL" -f db/migrations/0001_init.sql
--
-- Design notes (see CLAUDE.md / docs/PLAN.md):
--  * Scrapers write to business_sources (raw, append-only, full history). The entity-resolution
--    job merges sources into canonical `businesses`. NEVER scrape straight into businesses.
--  * Phones normalized to E.164 at write time -> enables reverse lookup + dedup.
--  * Analytics served from analytics_daily rollups, not raw listing_events.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;     -- geo: "closest business"
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy name search
CREATE EXTENSION IF NOT EXISTS vector;      -- semantic "matches what the user needs"

-- updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Categories (hierarchical + semantic embedding)
-- NOTE: vector(384) assumes a 384-dim embedding model (e.g. all-MiniLM-L6-v2,
-- which is free/local — fits the shoestring budget). If you switch embedding
-- models, this dimension MUST match. Change here + reindex.
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id   bigint REFERENCES categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  embedding   vector(384)
);
CREATE INDEX categories_parent_idx ON categories(parent_id);
-- ANN index for semantic match (build after data is loaded; ivfflat needs rows to train)
-- CREATE INDEX categories_embedding_idx ON categories
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- Accounts (paying businesses) + canonical businesses
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE businesses (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  normalized_name  text NOT NULL,                 -- lowercased/stripped, for trgm + dedup
  category_id      bigint REFERENCES categories(id) ON DELETE SET NULL,
  description      text,
  trust_score      numeric(5,2) NOT NULL DEFAULT 0,  -- computed: completeness + verified + recency
  claimed_by       bigint REFERENCES accounts(id) ON DELETE SET NULL,
  has_website      boolean NOT NULL DEFAULT false,
  website_url      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_name_trgm_idx ON businesses USING gin (normalized_name gin_trgm_ops);
CREATE INDEX businesses_category_idx  ON businesses(category_id);
CREATE TRIGGER businesses_updated BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- business_sources :: RAW scraped records, append-only, full history.
-- business_id is NULL until the entity-resolution job links it to a canonical row.
-- We keep every version (no unique on source_record_id) so we can see changes over time.
-- ---------------------------------------------------------------------------
CREATE TABLE business_sources (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id      bigint REFERENCES businesses(id) ON DELETE SET NULL,
  source           text NOT NULL,            -- cro | osm | goldenpages | manual
  source_record_id text,                     -- stable id within that source (e.g. OSM node id)
  raw_payload      jsonb NOT NULL,
  scraped_at       timestamptz NOT NULL DEFAULT now(),
  confidence       numeric(5,2)              -- match confidence once resolved
);
CREATE INDEX business_sources_lookup_idx ON business_sources(source, source_record_id, scraped_at DESC);
CREATE INDEX business_sources_business_idx ON business_sources(business_id);
CREATE INDEX business_sources_unmatched_idx ON business_sources(business_id) WHERE business_id IS NULL;

-- ---------------------------------------------------------------------------
-- Locations (PostGIS) — one per business for now
-- ---------------------------------------------------------------------------
CREATE TABLE locations (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id   bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  address_line  text,
  eircode       text,
  county        text,
  town          text,
  geom          geography(Point, 4326)
);
CREATE INDEX locations_geom_idx     ON locations USING gist (geom);
CREATE INDEX locations_business_idx ON locations(business_id);
CREATE INDEX locations_county_idx   ON locations(county);

-- ---------------------------------------------------------------------------
-- Phone numbers (normalized E.164) — supports reverse lookup
-- ---------------------------------------------------------------------------
CREATE TABLE phone_numbers (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id            bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  e164                   text NOT NULL,        -- e.g. +35391123456
  is_commercial_verified boolean NOT NULL DEFAULT false,  -- GDPR guardrail for sole-trader mobiles
  source                 text,
  last_seen_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, e164)
);
CREATE INDEX phone_numbers_e164_idx ON phone_numbers(e164);   -- reverse lookup

-- ---------------------------------------------------------------------------
-- Analytics: raw events (append-only, biggest table) + nightly rollup
-- ---------------------------------------------------------------------------
CREATE TABLE listing_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      text NOT NULL,                 -- impression | click | call | dwell
  surface         text NOT NULL,                 -- web | ios | android
  session_id      text,
  dwell_ms        integer,
  referrer        text,
  ts              timestamptz NOT NULL DEFAULT now(),
  ip_hash         text,                          -- hashed, not raw (GDPR)
  user_agent_hash text
);
CREATE INDEX listing_events_business_ts_idx ON listing_events(business_id, ts);
CREATE INDEX listing_events_type_idx        ON listing_events(event_type);

CREATE TABLE analytics_daily (
  business_id    bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date           date NOT NULL,
  surface        text NOT NULL,                  -- web | ios | android
  impressions    integer NOT NULL DEFAULT 0,
  clicks         integer NOT NULL DEFAULT 0,
  calls          integer NOT NULL DEFAULT 0,
  avg_dwell_ms   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, date, surface)
);

-- ---------------------------------------------------------------------------
-- Monetization + lifecycle
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id         bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan               text NOT NULL,
  status             text NOT NULL,              -- active | past_due | canceled
  stripe_customer_id text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE claims (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id   bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',  -- pending | verified | rejected
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claims_business_idx ON claims(business_id);

-- GDPR objection / takedown path (references a business or a specific phone)
CREATE TABLE takedown_requests (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     bigint REFERENCES businesses(id) ON DELETE SET NULL,
  phone_number_id bigint REFERENCES phone_numbers(id) ON DELETE SET NULL,
  reason          text,
  status          text NOT NULL DEFAULT 'open',  -- open | actioned | rejected
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX takedown_status_idx ON takedown_requests(status);
