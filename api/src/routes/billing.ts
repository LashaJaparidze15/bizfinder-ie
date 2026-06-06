import type { FastifyInstance, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe, billingEnabled, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET } from "../lib/stripe.js";

const checkoutSchema = z.object({
  businessId: z.number().int().positive(),
  email: z.string().email(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// True if an account that has claimed this business holds an active subscription.
export async function hasActiveSubscription(app: FastifyInstance, businessId: number): Promise<boolean> {
  if (!app.db) return false;
  const { rows } = await app.db.query(
    `select 1
       from claims c
       join subscriptions s on s.account_id = c.account_id
      where c.business_id = $1 and s.status = 'active'
      limit 1`,
    [businessId],
  );
  return rows.length > 0;
}

export async function billingRoutes(app: FastifyInstance) {
  // Start a subscription: creates a Stripe Checkout session, returns its URL.
  app.post("/api/billing/checkout", async (req, reply) => {
    if (!app.db) return reply.code(503).send({ error: "database not configured" });
    if (!billingEnabled() || !stripe) return reply.code(503).send({ error: "billing not configured" });

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { businessId, email, successUrl, cancelUrl } = parsed.data;

    const account = await app.db.query(
      `insert into accounts (email) values ($1)
         on conflict (email) do update set email = excluded.email
       returning id`,
      [email],
    );
    const accountId = account.rows[0].id;

    // Subscribing to a listing's analytics ties this account to the business
    // (so the post-payment subscription actually unlocks its dashboard).
    await app.db.query(
      `insert into claims (business_id, account_id)
       select $1, $2
       where not exists (select 1 from claims where business_id = $1 and account_id = $2)`,
      [businessId, accountId],
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID!, quantity: 1 }],
      customer_email: email,
      success_url: successUrl ?? "http://localhost:3000/dashboard/" + businessId,
      cancel_url: cancelUrl ?? "http://localhost:3000/business",
      metadata: { businessId: String(businessId), accountId: String(accountId) },
    });

    return { url: session.url };
  });

  // Stripe webhook — keeps the subscriptions table in sync. Needs the raw body
  // for signature verification (see the content-type parser in server.ts).
  app.post("/api/billing/webhook", async (req: FastifyRequest, reply) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return reply.code(503).send({ error: "billing not configured" });
    const sig = req.headers["stripe-signature"];
    const raw = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!sig || !raw) return reply.code(400).send({ error: "missing signature/body" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return reply.code(400).send({ error: `signature verification failed` });
    }

    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const accountId = Number(s.metadata?.accountId);
      if (accountId && app.db) {
        await app.db.query(
          `insert into subscriptions (account_id, plan, status, stripe_customer_id)
             values ($1, 'analytics', 'active', $2)`,
          [accountId, typeof s.customer === "string" ? s.customer : null],
        );
      }
    } else if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (app.db) {
        await app.db.query(
          `update subscriptions set status = $1
            where stripe_customer_id = $2`,
          [sub.status, typeof sub.customer === "string" ? sub.customer : null],
        );
      }
    }

    return { received: true };
  });

  // Has this business's owner got an active plan? (Used by the dashboard.)
  app.get<{ Querystring: { businessId?: string } }>("/api/billing/status", async (req, reply) => {
    const businessId = Number(req.query.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return reply.code(400).send({ error: "invalid businessId" });
    }
    return { active: await hasActiveSubscription(app, businessId), billingEnabled: billingEnabled() };
  });
}
