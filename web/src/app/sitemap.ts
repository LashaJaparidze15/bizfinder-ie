import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";
const SERVER_API = process.env.API_URL ?? "http://localhost:4000";

export const revalidate = 3600; // rebuild sitemap hourly

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getJson<{ slug: string; updatedAt: string }[]>("/api/slugs", []);
  const counties = await getJson<{ county: string; slug: string }[]>("/api/counties", []);

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
  ];

  // County hubs + category×county landing pages (the SEO long-tail).
  for (const c of counties) {
    entries.push({ url: `${SITE}/${c.slug}`, changeFrequency: "weekly", priority: 0.8 });
    const cats = await getJson<{ slug: string }[]>(`/api/categories?county=${encodeURIComponent(c.county)}`, []);
    for (const cat of cats) {
      entries.push({ url: `${SITE}/${c.slug}/${cat.slug}`, changeFrequency: "weekly", priority: 0.7 });
    }
  }

  // Individual business listings.
  for (const s of slugs) {
    entries.push({
      url: `${SITE}/business/${s.slug}`,
      lastModified: s.updatedAt ? new Date(s.updatedAt) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
