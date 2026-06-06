// Side-effect module: load the repo-root .env BEFORE any other module reads
// process.env. Must be the FIRST import in the entrypoint — ES module imports
// are evaluated before the importing module's body, so dotenv.config() in
// server.ts's body runs too late for modules that read env at load time
// (e.g. lib/stripe.ts).
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// env.ts lives at api/src/lib/, so the repo root is three levels up.
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
