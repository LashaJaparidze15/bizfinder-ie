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
  photoUrl: string | null;
  photoSource: string | null; // og | logo | mapillary | places | category | manual
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

export interface Review {
  id: number;
  rating: number; // 1..5
  authorName: string | null;
  body: string | null;
  createdAt: string;
}

export interface BusinessListing extends Business {
  location: Location | null;
  phones: PhoneNumber[];
  avgRating: number | null; // null when no reviews yet
  reviewCount: number;
  reviews?: Review[]; // populated on the single-business endpoint
  distanceMeters?: number; // present when searched by location
}

export type Surface = "web" | "ios" | "android";
export type EventType = "impression" | "click" | "call" | "dwell";

// Directory / SEO landing pages
export interface DirectoryItem {
  id: number;
  slug: string;
  name: string;
  hasWebsite: boolean;
  category: string | null;
  town: string | null;
  county: string | null;
  avgRating: number | null;
  reviewCount: number;
  photoUrl: string | null;
}
export interface ListingsResponse {
  total: number;
  items: DirectoryItem[];
}
export interface CategoryCount {
  slug: string;
  name: string;
  count: number;
}
export interface CountyCount {
  county: string;
  slug: string;
  count: number;
}

export interface SurfaceCounts {
  impressions: number;
  clicks: number;
  calls: number;
}
export interface AnalyticsResponse {
  businessId: number;
  days: number;
  totals: SurfaceCounts;
  bySurface: Record<string, SurfaceCounts>;
  daily: Array<{
    date: string;
    surface: string;
    impressions: number;
    clicks: number;
    calls: number;
    avgDwellMs: number;
  }>;
}

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

// First-party review submission.
export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  authorName: z.string().trim().max(80).optional(),
  body: z.string().trim().max(2000).optional(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

// Claim a listing (business owner). Creates/links an account by email.
export const claimInputSchema = z.object({
  businessId: z.number().int().positive(),
  email: z.string().email(),
});
export type ClaimInput = z.infer<typeof claimInputSchema>;

// GDPR objection / takedown — against a business or a specific phone number.
export const takedownInputSchema = z
  .object({
    businessId: z.number().int().positive().optional(),
    phoneNumberId: z.number().int().positive().optional(),
    reason: z.string().max(1000).optional(),
  })
  .refine((v) => v.businessId || v.phoneNumberId, {
    message: "Provide businessId or phoneNumberId.",
  });
export type TakedownInput = z.infer<typeof takedownInputSchema>;

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

    async listBusinesses(params: {
      category?: string;
      county?: string;
      limit?: number;
      offset?: number;
    }): Promise<ListingsResponse> {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) qs.set(k, String(v));
      });
      const res = await f(url(`/api/listings?${qs.toString()}`));
      if (!res.ok) throw new Error(`listBusinesses failed: ${res.status}`);
      return (await res.json()) as ListingsResponse;
    },

    async getCategories(county?: string): Promise<CategoryCount[]> {
      const res = await f(url(`/api/categories${county ? `?county=${encodeURIComponent(county)}` : ""}`));
      if (!res.ok) throw new Error(`getCategories failed: ${res.status}`);
      return (await res.json()) as CategoryCount[];
    },

    async getCounties(): Promise<CountyCount[]> {
      const res = await f(url(`/api/counties`));
      if (!res.ok) throw new Error(`getCounties failed: ${res.status}`);
      return (await res.json()) as CountyCount[];
    },

    async getSimilar(slug: string, limit = 6): Promise<DirectoryItem[]> {
      const res = await f(url(`/api/businesses/${encodeURIComponent(slug)}/similar?limit=${limit}`));
      if (!res.ok) throw new Error(`getSimilar failed: ${res.status}`);
      return (await res.json()) as DirectoryItem[];
    },

    async createReview(slug: string, input: ReviewInput): Promise<Review> {
      const res = await f(url(`/api/businesses/${encodeURIComponent(slug)}/reviews`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createReview failed: ${res.status}`);
      return (await res.json()) as Review;
    },

    async getAnalytics(businessId: number, days = 30): Promise<AnalyticsResponse> {
      // Personal + real-time — never cache (Next would otherwise serve stale data).
      const res = await f(url(`/api/analytics/${businessId}?days=${days}`), { cache: "no-store" } as RequestInit);
      if (!res.ok) throw new Error(`getAnalytics failed: ${res.status}`);
      return (await res.json()) as AnalyticsResponse;
    },

    async getBillingStatus(businessId: number): Promise<{ active: boolean; billingEnabled: boolean }> {
      const res = await f(url(`/api/billing/status?businessId=${businessId}`), { cache: "no-store" } as RequestInit);
      if (!res.ok) throw new Error(`getBillingStatus failed: ${res.status}`);
      return (await res.json()) as { active: boolean; billingEnabled: boolean };
    },

    async createCheckout(input: { businessId: number; email: string }): Promise<{ url: string | null }> {
      const res = await f(url(`/api/billing/checkout`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createCheckout failed: ${res.status}`);
      return (await res.json()) as { url: string | null };
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
