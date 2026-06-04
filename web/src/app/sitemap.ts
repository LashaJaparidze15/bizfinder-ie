import type { MetadataRoute } from "next";
import { PUBLIC_API } from "@/lib/api";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";
const SERVER_API = process.env.API_URL ?? "http://localhost:4000";

export const revalidate = 3600; // rebuild sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let slugs: { slug: string; updatedAt: string }[] = [];
  try {
    const res = await fetch(`${SERVER_API}/api/slugs`, { next: { revalidate } });
    if (res.ok) slugs = await res.json();
  } catch {
    /* API down — emit just the homepage */
  }

  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    ...slugs.map((s) => ({
      url: `${SITE}/business/${s.slug}`,
      lastModified: s.updatedAt ? new Date(s.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
