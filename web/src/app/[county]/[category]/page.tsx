import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export const revalidate = 3600;

const SITE = process.env.SITE_URL ?? "http://localhost:3000";
const PAGE_SIZE = 24;

async function resolve(countySlug: string, categorySlug: string) {
  const counties = await api.getCounties().catch(() => []);
  const county = counties.find((c) => c.slug === countySlug);
  if (!county) return null;
  const categories = await api.getCategories(county.county);
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) return null;
  return { county, category };
}

export async function generateMetadata({
  params,
}: {
  params: { county: string; category: string };
}): Promise<Metadata> {
  const r = await resolve(params.county, params.category);
  if (!r) return { title: "Not found" };
  return {
    title: `${r.category.name} in ${r.county.county}`,
    description: `${r.category.count} ${r.category.name.toLowerCase()} listings in ${r.county.county}, Ireland — phone numbers, addresses and contact details on bizfinder.ie.`,
    alternates: { canonical: `/${r.county.slug}/${r.category.slug}` },
  };
}

export default async function CategoryCountyPage({
  params,
  searchParams,
}: {
  params: { county: string; category: string };
  searchParams: { page?: string };
}) {
  const r = await resolve(params.county, params.category);
  if (!r) notFound();
  const { county, category } = r;

  const page = Math.max(Number(searchParams.page ?? 1), 1);
  const { total, items } = await api.listBusinesses({
    category: category.slug,
    county: county.county,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} in ${county.county}`,
    numberOfItems: total,
    itemListElement: items.map((b, i) => ({
      "@type": "ListItem",
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: `${SITE}/business/${b.slug}`,
      name: b.name,
    })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: county.county, item: `${SITE}/${county.slug}` },
      { "@type": "ListItem", position: 3, name: category.name, item: `${SITE}/${county.slug}/${category.slug}` },
    ],
  };

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <nav className="muted" style={{ fontSize: 14 }}>
        <Link href="/">Home</Link> › <Link href={`/${county.slug}`}>{county.county}</Link> › {category.name}
      </nav>
      <h1>
        {category.name} in {county.county}
      </h1>
      <p className="muted">
        {total} {total === 1 ? "listing" : "listings"}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>

      {items.map((b) => (
        <div className="card" key={b.id}>
          <Link href={`/business/${b.slug}`} style={{ fontWeight: 600, fontSize: 18 }}>
            {b.name}
          </Link>
          <div className="muted">{[b.town, b.county].filter(Boolean).join(", ")}</div>
          {!b.hasWebsite && <span className="badge">No website</span>}
        </div>
      ))}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          {page > 1 ? (
            <Link href={`/${county.slug}/${category.slug}?page=${page - 1}`}>‹ Previous</Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link href={`/${county.slug}/${category.slug}?page=${page + 1}`}>Next ›</Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
