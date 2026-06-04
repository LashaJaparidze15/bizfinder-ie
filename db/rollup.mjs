// Nightly analytics rollup: listing_events -> analytics_daily.
// Idempotent — recomputes per (business_id, date, surface) and upserts.
// Run on a schedule (cron / GitHub Actions):  node db/rollup.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const res = await client.query(`
  insert into analytics_daily (business_id, date, surface, impressions, clicks, calls, avg_dwell_ms)
  select
    business_id,
    (ts at time zone 'UTC')::date as date,
    surface,
    count(*) filter (where event_type = 'impression') as impressions,
    count(*) filter (where event_type = 'click')      as clicks,
    count(*) filter (where event_type = 'call')       as calls,
    coalesce(round(avg(dwell_ms) filter (where event_type = 'dwell')), 0) as avg_dwell_ms
  from listing_events
  group by business_id, date, surface
  on conflict (business_id, date, surface) do update set
    impressions  = excluded.impressions,
    clicks       = excluded.clicks,
    calls        = excluded.calls,
    avg_dwell_ms = excluded.avg_dwell_ms
`);

await client.end();
console.log(`rollup complete: ${res.rowCount} (business, date, surface) rows upserted`);
