import type { FastifyInstance } from "fastify";
import pg from "pg";

// Decorates fastify with a pg Pool (`app.db`). If DATABASE_URL is unset we still
// start (so /health works during early dev) but DB-backed routes return 503.
declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool | null;
  }
}

export async function registerDb(app: FastifyInstance) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    app.log.warn("DATABASE_URL not set — DB routes will return 503 until configured.");
    app.decorate("db", null);
    return;
  }

  const pool = new pg.Pool({
    connectionString: url,
    // Supabase requires SSL; allow self-signed in dev.
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 10,
  });

  // Fail fast if credentials are wrong.
  const client = await pool.connect();
  await client.query("select 1");
  client.release();

  app.decorate("db", pool);
  app.addHook("onClose", async () => {
    await pool.end();
  });
  app.log.info("Postgres connected.");
}
