import type { FastifyInstance } from "fastify";
import { claimInputSchema, takedownInputSchema } from "@bizfinder/shared";

export async function claimRoutes(app: FastifyInstance) {
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
