// @bizfinder/shared — types, validation, and a typed API client used by web + app.
// Keep this framework-agnostic (no Node/React imports) so both clients can use it.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Domain types (mirror db/migrations/0001_init.sql)
// ---------------------------------------------------------------------------
export interface Business {
  id: number;
  slug: string;
  name: string;
  categoryId: number | null;
  description: string | null;
  trustScore: number;
  hasWebsite: boolean;
  websiteUrl: string | null;
}

export interface Location {
  addressLine: string | null;
  eircode: string | null;
  county: string | null;
  town: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PhoneNumber {
  e164: string;
  isCommercialVerified: boolean;
}

export interface BusinessListing extends Business {
  location: Location | null;
  phones: PhoneNumber[];
  distanceMeters?: number; // present when searched by location
}

export type Surface = "web" | "ios" | "android";
export type EventType = "impression" | "click" | "call" | "dwell";

// ---------------------------------------------------------------------------
// Validation schemas (shared by API and clients)
// ---------------------------------------------------------------------------

// Search: any combination of name, category, location (closest), or reverse phone.
export const searchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(), // free-text name/keyword
    category: z.string().trim().min(1).max(80).optional(),
    county: z.string().trim().min(1).max(80).optional(),
    lat: z.coerce.number().gte(-90).lte(90).optional(),
    lng: z.coerce.number().gte(-180).lte(180).optional(),
    phone: z.string().trim().min(3).max(20).optional(), // reverse lookup (raw; normalized server-side)
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((v) => v.q || v.category || v.county || v.phone || (v.lat != null && v.lng != null), {
    message: "Provide at least one of: q, category, county, phone, or lat+lng.",
  })
  .refine((v) => (v.lat == null) === (v.lng == null), {
    message: "lat and lng must be provided together.",
  });
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Analytics event ingest from web/app.
export const eventInputSchema = z.object({
  businessId: z.number().int().positive(),
  eventType: z.enum(["impression", "click", "call", "dwell"]),
  surface: z.enum(["web", "ios", "android"]),
  sessionId: z.string().max(100).optional(),
  dwellMs: z.number().int().nonnegative().optional(),
  referrer: z.string().max(500).optional(),
});
export type EventInput = z.infer<typeof eventInputSchema>;

// ---------------------------------------------------------------------------
// Typed API client (used by web + app). Inject fetch + baseUrl.
// ---------------------------------------------------------------------------
export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export function createApiClient({ baseUrl, fetch: f = fetch }: ApiClientOptions) {
  const url = (path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;

  return {
    async search(params: SearchQuery): Promise<BusinessListing[]> {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) qs.set(k, String(v));
      });
      const res = await f(url(`/api/search?${qs.toString()}`));
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      return (await res.json()) as BusinessListing[];
    },

    async getBusiness(slug: string): Promise<BusinessListing> {
      const res = await f(url(`/api/businesses/${encodeURIComponent(slug)}`));
      if (!res.ok) throw new Error(`getBusiness failed: ${res.status}`);
      return (await res.json()) as BusinessListing;
    },

    // Fire-and-forget; never block UI on analytics.
    async trackEvent(event: EventInput): Promise<void> {
      try {
        await f(url(`/api/events`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(event),
          keepalive: true,
        });
      } catch {
        /* swallow — analytics must not break UX */
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
