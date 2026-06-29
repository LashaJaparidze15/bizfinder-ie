import type { FastifyInstance } from "fastify";
import { claimInputSchema, takedownInputSchema, claimRequestSchema, claimVerifySchema } from "@bizfinder/shared";
import { genCode, sha256, createSession, CODE_TTL_MIN } from "../lib/auth.js";
import { sendCode, isDev, maskEmail } from "../lib/notify.js";

export async function claimRoutes(app: FastifyInstance) {
  // Start a claim: send a code to the business's on-file email (proves ownership).
  app.post("/api/claims/request", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = claimRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { businessId } = parsed.data;
    const b = await app.db.query(`select email from businesses where id = $1`, [businessId]);
    const email: string | null = b.rows[0]?.email ?? null;
    if (!email) {
      return reply.code(400).send({
        error: "We don't have an email on file for this business yet, so we can't verify ownership this way.",
        code: "no_email_on_file",
      });
    }
    const code = genCode();
    await app.db.query(
      `insert into verification_codes (email, code_hash, purpose, business_id, expires_at)
       values ($1,$2,'claim',$3, now() + ($4 || ' minutes')::interval)`,
      [email.toLowerCase(), sha256(code), businessId, String(CODE_TTL_MIN)],
    );
    await sendCode(email, code, "claim");
    return reply.send({ sentTo: maskEmail(email), ...(isDev ? { devCode: code } : {}) });
  });

  // Finish a claim: verify the code, take ownership, return a session token.
  app.post("/api/claims/verify", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = claimVerifySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { businessId, code } = parsed.data;
    const b = await app.db.query(`select email, slug from businesses where id = $1`, [businessId]);
    const email: string | null = b.rows[0]?.email ?? null;
    if (!email) return reply.code(400).send({ error: "no email on file" });
    const lc = email.toLowerCase();

    const r = await app.db.query(
      `select id, code_hash, attempts from verification_codes
        where email=$1 and purpose='claim' and business_id=$2 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [lc, businessId],
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
    await app.db.query(`update businesses set claimed_by = $1 where id = $2`, [accountId, businessId]);
    await app.db.query(
      `insert into claims (business_id, account_id, status, verified_at)
       values ($1,$2,'verified', now())`,
      [businessId, accountId],
    ).catch(() => {});
    const token = await createSession(app, accountId);
    return reply.send({ token, slug: b.rows[0].slug });
  });

  // Claim a listing: upsert an account by email, create a pending claim.
  app.post("/api/claims", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = claimInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid claim" });
    }
    const { businessId, email } = parsed.data;

    const account = await app.db.query(
      `insert into accounts (email) values ($1)
         on conflict (email) do update set email = excluded.email
       returning id`,
      [email],
    );
    const accountId = account.rows[0].id;

    const claim = await app.db.query(
      `insert into claims (business_id, account_id) values ($1,$2) returning id, status`,
      [businessId, accountId],
    );
    return reply.code(201).send({ id: claim.rows[0].id, status: claim.rows[0].status });
  });

  // GDPR takedown/objection. If a phone is named, suppress it immediately
  // (un-verify) and log the request for review.
  app.post("/api/takedowns", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = takedownInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid request" });
    }
    const { businessId, phoneNumberId, reason } = parsed.data;

    const row = await app.db.query(
      `insert into takedown_requests (business_id, phone_number_id, reason)
       values ($1,$2,$3) returning id, status`,
      [businessId ?? null, phoneNumberId ?? null, reason ?? null],
    );

    if (phoneNumberId) {
      await app.db.query(
        `update phone_numbers set is_commercial_verified = false where id = $1`,
        [phoneNumberId],
      );
    }
    return reply.code(201).send({ id: row.rows[0].id, status: row.rows[0].status });
  });
}
