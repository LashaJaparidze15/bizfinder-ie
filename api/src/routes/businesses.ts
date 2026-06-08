import type { FastifyInstance } from "fastify";
import type { BusinessListing } from "@bizfinder/shared";
import { reviewInputSchema } from "@bizfinder/shared";

// Single business by slug (the canonical listing-page payload for web + app).
export async function businessRoutes(app: FastifyInstance) {
  // Lightweight slug list for the web sitemap.
  app.get("/api/slugs", async (_req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const { rows } = await app.db.query(
      `select slug, updated_at from businesses order by id limit 50000`,
    );
    return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
  });

  app.get<{ Params: { slug: string } }>("/api/businesses/:slug", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });

    const { rows } = await app.db.query(
      `select b.id, b.slug, b.name, b.category_id, b.description, b.trust_score,
              b.has_website, b.website_url, b.photo_url, b.photo_source,
              l.address_line, l.eircode, l.county, l.town,
              ST_Y(l.geom::geometry) as lat, ST_X(l.geom::geometry) as lng
         from businesses b
         left join locations l on l.business_id = b.id
        where b.slug = $1
        limit 1`,
      [req.params.slug],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "not found" });
    const r = rows[0];

    const phones = await app.db.query(
      `select e164, is_commercial_verified from phone_numbers where business_id = $1`,
      [r.id],
    );

    const agg = await app.db.query(
      `select count(*)::int as cnt, avg(rating)::float as avg from reviews where business_id = $1`,
      [r.id],
    );
    const reviewsRes = await app.db.query(
      `select id, rating, author_name, body, created_at
         from reviews where business_id = $1 order by created_at desc limit 50`,
      [r.id],
    );

    const listing: BusinessListing = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      categoryId: r.category_id,
      description: r.description,
      trustScore: Number(r.trust_score),
      hasWebsite: r.has_website,
      websiteUrl: r.website_url,
      photoUrl: r.photo_url,
      photoSource: r.photo_source,
      location: r.county || r.address_line
        ? { addressLine: r.address_line, eircode: r.eircode, county: r.county, town: r.town, lat: r.lat, lng: r.lng }
        : null,
      phones: phones.rows.map((ph) => ({ e164: ph.e164, isCommercialVerified: ph.is_commercial_verified })),
      avgRating: agg.rows[0].avg != null ? Math.round(agg.rows[0].avg * 10) / 10 : null,
      reviewCount: agg.rows[0].cnt,
      reviews: reviewsRes.rows.map((rv) => ({
        id: rv.id,
        rating: rv.rating,
        authorName: rv.author_name,
        body: rv.body,
        createdAt: rv.created_at,
      })),
    };
    return listing;
  });

  // Submit a first-party review for a business.
  app.post<{ Params: { slug: string } }>("/api/businesses/:slug/reviews", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const parsed = reviewInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid review" });
    }
    const biz = await app.db.query(`select id from businesses where slug = $1`, [req.params.slug]);
    if (biz.rows.length === 0) return reply.code(404).send({ error: "not found" });

    const { rating, authorName, body } = parsed.data;
    const ins = await app.db.query(
      `insert into reviews (business_id, rating, author_name, body)
       values ($1,$2,$3,$4)
       returning id, rating, author_name, body, created_at`,
      [biz.rows[0].id, rating, authorName ?? null, body ?? null],
    );
    const rv = ins.rows[0];
    return reply.code(201).send({
      id: rv.id, rating: rv.rating, authorName: rv.author_name, body: rv.body, createdAt: rv.created_at,
    });
  });
}
