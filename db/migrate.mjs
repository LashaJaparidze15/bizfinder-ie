// Minimal migration runner (no local psql needed).
// Runs every db/migrations/*.sql in filename order via node-postgres.
//   node db/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env (simple parser; does not override already-set vars).
try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* no .env — rely on ambient env */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const dir = join(root, "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const f of files) {
    process.stdout.write(`applying ${f} ... `);
    await client.query(readFileSync(join(dir, f), "utf8"));
    console.log("ok");
  }
} finally {
  await client.end();
}
console.log("migrations complete");
