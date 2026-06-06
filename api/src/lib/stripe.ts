import Stripe from "stripe";

// Initialise Stripe only if a secret key is present. Until then, billing routes
// degrade gracefully (503) and the analytics gate stays open for dev — same
// pattern as the DB plugin.
const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key) : null;
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Billing is "on" only when we can actually create a subscription.
export const billingEnabled = (): boolean => Boolean(stripe && STRIPE_PRICE_ID);
