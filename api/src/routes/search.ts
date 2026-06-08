import type { FastifyInstance } from "fastify";
import { searchQuerySchema, type BusinessListing } from "@bizfinder/shared";
import { normalizePhoneIE } from "../lib/util.js";

// Search businesses by any combination of: free-text name (trgm fuzzy), category,
// county, reverse phone (E.164 exact), and/or location (PostGIS closest).
export async function searchRoutes(app: FastifyInstance) {
  app.get("/api/search", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });

    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid query" });
    }
    const { q, category, county, lat, lng, phone, limit, offset } = parsed.data;

    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    const joins: string[] = [
      "left join locations l on l.business_id = b.id",
      "left join categories c on c.id = b.category_id",
    ];

    if (q) {
      const n = q.toLowerCase();
      where.push(`(b.normalized_name ILIKE '%' || ${p(n)} || '%' OR similarity(b.normalized_name, ${p(n)}) > 0.3)`);
    }
    if (category) {
      where.push(`(c.slug = ${p(category)} OR c.name ILIKE '%' || ${p(category)} || '%')`);
    }
    if (county) {
      where.push(`l.county ILIKE '%' || ${p(county)} || '%'`);
    }
    if (phone) {
      const e164 = normalizePhoneIE(phone);
      if (!e164) return reply.code(400).send({ error: "could not parse phone number" });
      joins.push("join phone_numbers pn on pn.business_id = b.id");
      where.push(`pn.e164 = ${p(e164)}`);
    }

    // Distance + ordering
    let distanceSelect = "null::float as distance_meters";
    let orderBy = "b.trust_score desc";
    if (lat != null && lng != null) {
      const point = `ST_SetSRID(ST_MakePoint(${p(lng)}, ${p(lat)}), 4326)::geography`;
      distanceSelect = `ST_Distance(l.geom, ${point}) as distance_meters`;
      orderBy = "distance_meters asc nulls last";
    } else if (q) {
      orderBy = `similarity(b.normalized_name, ${p(q.toLowerCase())}) desc`;
    }

    const sql = `
      select b.id, b.slug, b.name, b.category_id, b.description, b.trust_score,
             b.has_website, b.website_url,
             l.address_line, l.eircode, l.county, l.town,
             ST_Y(l.geom::geometry) as lat, ST_X(l.geom::geometry) as lng,
             ${distanceSelect}
      from businesses b
      ${joins.join("\n      ")}
      ${where.length ? "where " + where.join(" and ") : ""}
      order by ${orderBy}
      limit ${p(limit)} offset ${p(offset)}
    `;

    const { rows } = await app.db.query(sql, params);
    if (rows.length === 0) return [];

    // Fetch phones for the result set in one query.
    const ids = rows.map((r) => r.id);
    const phones = await app.db.query(
      `select business_id, e164, is_commercial_verified
         from phone_numbers where business_id = any($1)`,
      [ids],
    );
    const phonesByBiz = new Map<number, { e164: string; isCommercialVerified: boolean }[]>();
    for (const ph of phones.rows) {
      const list = phonesByBiz.get(ph.business_id) ?? [];
      list.push({ e164: ph.e164, isCommercialVerified: ph.is_commercial_verified });
      phonesByBiz.set(ph.business_id, list);
    }

    const reviewAgg = await app.db.query(
      `select business_id, count(*)::int as cnt, avg(rating)::float as avg
         from reviews where business_id = any($1) group by business_id`,
      [ids],
    );
    const ratingByBiz = new Map<number, { avg: number | null; cnt: number }>();
    for (const rv of reviewAgg.rows) ratingByBiz.set(rv.business_id, { avg: rv.avg, cnt: rv.cnt });

    const results: BusinessListing[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      categoryId: r.category_id,
      description: r.description,
      trustScore: Number(r.trust_score),
      hasWebsite: r.has_website,
      websiteUrl: r.website_url,
      location: r.county || r.address_line
        ? {
            addressLine: r.address_line,
            eircode: r.eircode,
            county: r.county,
            town: r.town,
            lat: r.lat,
            lng: r.lng,
          }
        : null,
      phones: phonesByBiz.get(r.id) ?? [],
      avgRating:
        ratingByBiz.get(r.id)?.avg != null
          ? Math.round((ratingByBiz.get(r.id)!.avg as number) * 10) / 10
          : null,
      reviewCount: ratingByBiz.get(r.id)?.cnt ?? 0,
      ...(r.distance_meters != null ? { distanceMeters: Number(r.distance_meters) } : {}),
    }));

    return results;
  });
}
