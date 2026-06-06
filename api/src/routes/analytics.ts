import type { FastifyInstance } from "fastify";
import { billingEnabled } from "../lib/stripe.js";
import { hasActiveSubscription } from "./billing.js";

// Dashboard data for a business: totals + per-surface (web vs app) breakdown +
// daily series, from the analytics_daily rollup. Gated behind an active
// subscription once billing is configured (open in dev until then).
export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{ Params: { businessId: string }; Querystring: { days?: string } }>(
    "/api/analytics/:businessId",
    async (req, reply) => {
      if (!app.db) return reply.code(503).send({ error: "database not configured" });

      const businessId = Number(req.params.businessId);
      if (!Number.isInteger(businessId) || businessId <= 0) {
        return reply.code(400).send({ error: "invalid businessId" });
      }
      const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);

      // Paywall: enforced only once Stripe is configured.
      if (billingEnabled() && !(await hasActiveSubscription(app, businessId))) {
        return reply.code(402).send({ error: "subscription required", businessId });
      }

      const { rows } = await app.db.query(
        `select date, surface, impressions, clicks, calls, avg_dwell_ms
           from analytics_daily
          where business_id = $1 and date >= current_date - ($2::int - 1)
          order by date desc, surface`,
        [businessId, days],
      );

      const blank = () => ({ impressions: 0, clicks: 0, calls: 0 });
      const totals = blank();
      const bySurface: Record<string, { impressions: number; clicks: number; calls: number }> = {
        web: blank(),
        ios: blank(),
        android: blank(),
      };
      for (const r of rows) {
        for (const k of ["impressions", "clicks", "calls"] as const) {
          totals[k] += r[k];
          if (bySurface[r.surface]) bySurface[r.surface][k] += r[k];
        }
      }

      return {
        businessId,
        days,
        totals,
        bySurface,
        daily: rows.map((r) => ({
          date: r.date,
          surface: r.surface,
          impressions: r.impressions,
          clicks: r.clicks,
          calls: r.calls,
          avgDwellMs: r.avg_dwell_ms,
        })),
      };
    },
  );
}
