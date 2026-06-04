import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    let db = "not-configured";
    if (app.db) {
      try {
        await app.db.query("select 1");
        db = "ok";
      } catch {
        db = "error";
      }
    }
    return { status: "ok", db, ts: new Date().toISOString() };
  });
}
