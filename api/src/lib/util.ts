import { createHash } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Normalize any Irish phone input to E.164 (default country IE). Returns null if invalid.
export function normalizePhoneIE(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, "IE");
  return parsed && parsed.isValid() ? parsed.number : null;
}

// One-way hash for IP / user-agent so we never store raw PII (GDPR).
export function hash(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
