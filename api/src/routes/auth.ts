import type { FastifyInstance } from "fastify";
import { requestCodeSchema, verifyCodeSchema } from "@bizfinder/shared";
import { genCode, sha256, createSession, CODE_TTL_MIN } from "../lib/auth.js";
import { sendCode, isDev } from "../lib/notify.js";

export async function authRoutes(app: FastifyInstance) {
  // Send a 6-digit code to an email (passwordless login / registration).
  app.post("/api/auth/request-code", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { email, purpose } = parsed.data;
    const code = genCode();
    await app.db.query(
      `insert into verification_codes (email, code_hash, purpose, expires_at)
       values ($1,$2,$3, now() + ($4 || ' minutes')::interval)`,
      [email.toLowerCase(), sha256(code), purpose, String(CODE_TTL_MIN)],
    );
    await sendCode(email, code, purpose);
    return reply.send({ ok: true, ...(isDev ? { devCode: code } : {}) });
  });

  // Verify the code → upsert account → issue a session token.
  app.post("/api/auth/verify", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { email, code, purpose } = parsed.data;
    const lc = email.toLowerCase();

    const r = await app.db.query(
      `select id, code_hash, attempts from verification_codes
        where email=$1 and purpose=$2 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [lc, purpose],
    );
    const row = r.rows[0];
    if (!row) return reply.code(400).send({ error: "code expired — request a new one" });
    if (row.attempts >= 5) return reply.code(429).send({ error: "too many attempts" });
    if (row.code_hash !== sha256(code)) {
      await app.db.query(`update verification_codes set attempts = attempts + 1 where id = $1`, [row.id]);
      return reply.code(400).send({ error: "incorrect code" });
    }
    await app.db.query(`update verification_codes set consumed_at = now() where id = $1`, [row.id]);

    const acc = await app.db.query(
      `insert into accounts (email) values ($1)
         on conflict (email) do update set email = excluded.email returning id`,
      [lc],
    );
    const accountId = acc.rows[0].id;
    const token = await createSession(app, accountId);
    return reply.send({ token, accountId });
  });
}
