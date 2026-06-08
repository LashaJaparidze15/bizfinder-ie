import type { FastifyInstance } from "fastify";

// Powers the SEO landing pages: county hubs, category×county listings, and the
// category/county indexes used for internal linking.
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function directoryRoutes(app: FastifyInstance) {
  // Counties that have businesses, with counts.
  app.get("/api/counties", async (_req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const { rows } = await app.db.query(
      `select l.county, count(distinct b.id)::int as count
         from locations l join businesses b on b.id = l.business_id
        where l.county is not null
        group by l.county
        order by count desc`,
    );
    return rows.map((r) => ({ county: r.county, slug: slugify(r.county), count: r.count }));
  });

  // Categories with counts, optionally scoped to a county.
  app.get<{ Querystring: { county?: string } }>("/api/categories", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    const params: unknown[] = [];
    let join = "join businesses b on b.category_id = c.id";
    let where = "";
    if (req.query.county) {
      join += " join locations l on l.business_id = b.id";
      where = "where l.county ilike $1";
      params.push(req.query.county);
    }
    const { rows } = await app.db.query(
      `select c.slug, c.name, count(distinct b.id)::int as count
         from categories c ${join} ${where}
        group by c.slug, c.name
        order by count desc`,
      params,
    );
    return rows;
  });

  // Paginated businesses filtered by category and/or county. Returns total for pagination.
  app.get<{ Querystring: { category?: string; county?: string; limit?: string; offset?: string } }>(
    "/api/listings",
    async (req, reply) => {
      if (!app.db) return reply.code(503).send({ error: "database not configured" });
      const limit = Math.min(Math.max(Number(req.query.limit ?? 24), 1), 50);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);

      const where: string[] = [];
      const params: unknown[] = [];
      const p = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };
      const joins =
        "left join locations l on l.business_id = b.id left join categories c on c.id = b.category_id";
      if (req.query.category) where.push(`c.slug = ${p(req.query.category)}`);
      if (req.query.county) where.push(`l.county ilike ${p(req.query.county)}`);
      const whereSql = where.length ? "where " + where.join(" and ") : "";

      const totalRes = await app.db.query(
        `select count(distinct b.id)::int as total from businesses b ${joins} ${whereSql}`,
        params,
      );
      const total = totalRes.rows[0].total;

      const items = await app.db.query(
        `select b.id, b.slug, b.name, b.has_website, c.name as category, l.town, l.county,
                ra.cnt as review_count, ra.avg as avg_rating
           from businesses b ${joins}
           left join (select business_id, count(*)::int cnt, avg(rating)::float avg
                        from reviews group by business_id) ra on ra.business_id = b.id
          ${whereSql}
          order by b.trust_score desc, b.name asc
          limit ${p(limit)} offset ${p(offset)}`,
        params,
      );

      return {
        total,
        items: items.rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          hasWebsite: r.has_website,
          category: r.category,
          town: r.town,
          county: r.county,
          avgRating: r.avg_rating != null ? Math.round(r.avg_rating * 10) / 10 : null,
          reviewCount: r.review_count ?? 0,
        })),
      };
    },
  );
}
