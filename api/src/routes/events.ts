import type { FastifyInstance } from "fastify";
import { eventInputSchema } from "@bizfinder/shared";
import { hash } from "../lib/util.js";

// Ingest analytics events from web + app. Append-only into listing_events.
// Tagged with `surface`; IP/UA are hashed, never stored raw (GDPR).
export async function eventRoutes(app: FastifyInstance) {
  app.post("/api/events", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });

    const parsed = eventInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid event" });
    }
    const e = parsed.data;

    await app.db.query(
      `insert into listing_events
         (business_id, event_type, surface, session_id, dwell_ms, referrer, ip_hash, user_agent_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        e.businessId,
        e.eventType,
        e.surface,
        e.sessionId ?? null,
        e.dwellMs ?? null,
        e.referrer ?? null,
        hash(req.ip),
        hash(req.headers["user-agent"]),
      ],
    );

    return reply.code(202).send({ ok: true });
  });
}
