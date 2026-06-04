import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerDb } from "./plugins/db.js";
import { healthRoutes } from "./routes/health.js";
import { searchRoutes } from "./routes/search.js";
import { businessRoutes } from "./routes/businesses.js";
import { eventRoutes } from "./routes/events.js";

async function main() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, { origin: true });
  await registerDb(app);

  await app.register(healthRoutes);
  await app.register(searchRoutes);
  await app.register(businessRoutes);
  await app.register(eventRoutes);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
