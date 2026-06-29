import type { FastifyInstance } from "fastify";
import { editBusinessSchema } from "@bizfinder/shared";
import { accountFromRequest } from "../lib/auth.js";

// Owner-only listing management (load + edit). Gated by session == claimed_by.
export async function manageRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/businesses/:id/manage", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const accountId = await accountFromRequest(app, req);
    if (!accountId) return reply.code(401).send({ error: "sign in as the owner" });
    const id = Number(req.params.id);
    const r = await app.db.query(
      `select id, slug, name, description, email, phone, website_url, photo_url, claimed_by
         from businesses where id = $1`,
      [id],
    );
    const b = r.rows[0];
    if (!b) return reply.code(404).send({ error: "not found" });
    if (Number(b.claimed_by) !== Number(accountId)) return reply.code(403).send({ error: "not your listing" });
    return reply.send({
      id: b.id, slug: b.slug, name: b.name, description: b.description,
      email: b.email, phone: b.phone, website: b.website_url, photoUrl: b.photo_url,
    });
  });

  app.patch<{ Params: { id: string } }>("/api/businesses/:id", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const accountId = await accountFromRequest(app, req);
    if (!accountId) return reply.code(401).send({ error: "sign in as the owner" });
    const id = Number(req.params.id);
    const own = await app.db.query(`select claimed_by from businesses where id = $1`, [id]);
    if (!own.rows[0]) return reply.code(404).send({ error: "not found" });
    if (Number(own.rows[0].claimed_by) !== Number(accountId)) return reply.code(403).send({ error: "not your listing" });

    const parsed = editBusinessSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const p = parsed.data;

    const cols: Record<string, string> = {
      name: "name", description: "description", email: "email", phone: "phone",
      website: "website_url", photoUrl: "photo_url",
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(cols)) {
      const v = (p as Record<string, unknown>)[key];
      if (v !== undefined) { sets.push(`${col} = $${i++}`); vals.push(v); }
    }
    if (p.website !== undefined) { sets.push(`has_website = $${i++}`); vals.push(!!p.website); }
    if (p.photoUrl !== undefined) { sets.push(`photo_source = $${i++}`); vals.push("owner"); }
    sets.push(`updated_at = now()`);
    vals.push(id);
    await app.db.query(`update businesses set ${sets.join(", ")} where id = $${i}`, vals);
    return reply.send({ ok: true });
  });
}
