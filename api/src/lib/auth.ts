import crypto from "crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

export function genCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
export function genToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const CODE_TTL_MIN = 10;
export const SESSION_TTL_DAYS = 30;

// Resolve the account from a `Authorization: Bearer <token>` session. Null if none/expired.
export async function accountFromRequest(
  app: FastifyInstance,
  req: FastifyRequest,
): Promise<number | null> {
  if (!app.db) return null;
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const r = await app.db.query(
    `select account_id from sessions where token_hash = $1 and expires_at > now() limit 1`,
    [sha256(auth.slice(7))],
  );
  return r.rows[0]?.account_id ?? null;
}

// Issue a new session token for an account (returns the raw token; only its hash is stored).
export async function createSession(app: FastifyInstance, accountId: number): Promise<string> {
  const token = genToken();
  await app.db!.query(
    `insert into sessions (token_hash, account_id, expires_at)
     values ($1,$2, now() + ($3 || ' days')::interval)`,
    [sha256(token), accountId, String(SESSION_TTL_DAYS)],
  );
  return token;
}
