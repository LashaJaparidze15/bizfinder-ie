import { createApiClient } from "@bizfinder/shared";

// Server-side base (SSR/RSC fetches). Defaults to local API in dev.
const SERVER_API = process.env.API_URL ?? "http://localhost:4000";

// Browser-visible base (analytics beacons run client-side).
export const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = createApiClient({ baseUrl: SERVER_API });
