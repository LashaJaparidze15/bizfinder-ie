// Verification-code delivery. Stubbed for now: logs the code. Wire a real
// email provider (Resend / SES / Postmark) or SMS (Twilio) here later.
export const isDev = process.env.NODE_ENV !== "production";

export async function sendCode(to: string, code: string, purpose: string): Promise<void> {
  console.log(`[notify] ${purpose} code for ${to}: ${code}`);
  // TODO: integrate email/SMS provider. Until then, dev surfaces the code in the
  // API response so the flow is testable end-to-end without a provider.
}

// j***@domain.ie — for telling a claimant where the code went without leaking it.
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}
