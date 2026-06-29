import type { FastifyInstance } from "fastify";
import { registerBusinessSchema } from "@bizfinder/shared";
import { accountFromRequest } from "../lib/auth.js";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "business";
const normalizeName = (s: string) =>
  s.toLowerCase().replace(/\b(ltd|limited|plc|teoranta|teo)\b/gi, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function registerRoutes(app: FastifyInstance) {
  // Owner-submitted new business. Requires a session (Bearer token). Creates the
  // business + location, marks it owner-submitted, and links a verified claim.
  app.post("/api/businesses/register", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const accountId = await accountFromRequest(app, req);
    if (!accountId) return reply.code(401).send({ error: "sign in first" });
    const parsed = registerBusinessSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const p = parsed.data;

    // category (get or create)
    const catSlug = slugify(p.category);
    let cat = await app.db.query(`select id from categories where slug = $1`, [catSlug]);
    let categoryId: number | null = cat.rows[0]?.id ?? null;
    if (!categoryId) {
      const ins = await app.db.query(
        `insert into categories (name, slug) values ($1,$2)
           on conflict (slug) do update set slug = excluded.slug returning id`,
        [titleCase(p.category), catSlug],
      );
      categoryId = ins.rows[0].id;
    }

    // unique slug
    const base = slugify(p.name);
    let slug = base;
    for (let i = 2; (await app.db.query(`select 1 from businesses where slug = $1`, [slug])).rows.length; i++) {
      slug = `${base}-${i}`;
    }

    const biz = await app.db.query(
      `insert into businesses
         (slug, name, normalized_name, category_id, description, email, phone,
          has_website, website_url, claimed_by, is_owner_submitted, trust_score)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,40)
       returning id, slug`,
      [
        slug, p.name, normalizeName(p.name), categoryId, p.description ?? null,
        p.email.toLowerCase(), p.phone ?? null, !!p.website, p.website ?? null, accountId,
      ],
    );
    const bizId = biz.rows[0].id;

    // primary location (geo if provided)
    if (p.lat != null && p.lng != null) {
      await app.db.query(
        `insert into locations (business_id, address_line, eircode, county, town, geom)
         values ($1,$2,$3,$4,$5, ST_SetSRID(ST_MakePoint($6,$7),4326)::geography)`,
        [bizId, p.addressLine ?? null, p.eircode ?? null, p.county, p.town ?? null, p.lng, p.lat],
      );
    } else {
      await app.db.query(
        `insert into locations (business_id, address_line, eircode, county, town)
         values ($1,$2,$3,$4,$5)`,
        [bizId, p.addressLine ?? null, p.eircode ?? null, p.county, p.town ?? null],
      );
    }

    await app.db.query(
      `insert into claims (business_id, account_id, status, verified_at)
       values ($1,$2,'verified', now())`,
      [bizId, accountId],
    ).catch(() => {});

    return reply.code(201).send({ id: bizId, slug: biz.rows[0].slug });
  });
}
