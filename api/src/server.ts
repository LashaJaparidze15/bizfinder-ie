import "./lib/env.js"; // MUST be first — loads .env before any module reads process.env
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerDb } from "./plugins/db.js";
import { healthRoutes } from "./routes/health.js";
import { searchRoutes } from "./routes/search.js";
import { businessRoutes } from "./routes/businesses.js";
import { eventRoutes } from "./routes/events.js";
import { claimRoutes } from "./routes/claims.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { billingRoutes } from "./routes/billing.js";
import { directoryRoutes } from "./routes/directory.js";
import { authRoutes } from "./routes/auth.js";
import { registerRoutes } from "./routes/register.js";
import { manageRoutes } from "./routes/manage.js";

async function main() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, { origin: true });

  // Parse JSON but also keep the raw buffer on req.rawBody — Stripe webhook
  // signature verification needs the exact bytes.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    (req as typeof req & { rawBody?: Buffer }).rawBody = body as Buffer;
    try {
      done(null, (body as Buffer).length ? JSON.parse(body.toString()) : {});
    } catch (err) {
      done(err as Error);
    }
  });

  await registerDb(app);

  await app.register(healthRoutes);
  await app.register(searchRoutes);
  await app.register(businessRoutes);
  await app.register(eventRoutes);
  await app.register(claimRoutes);
  await app.register(analyticsRoutes);
  await app.register(billingRoutes);
  await app.register(directoryRoutes);
  await app.register(authRoutes);
  await app.register(registerRoutes);
  await app.register(manageRoutes);

  // Cloud hosts inject PORT; fall back to API_PORT / 4000 for local dev.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
