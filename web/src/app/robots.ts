import type { MetadataRoute } from "next";

const raw = process.env.SITE_URL || "http://localhost:3000";
const SITE = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/"], // private per-business analytics
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
