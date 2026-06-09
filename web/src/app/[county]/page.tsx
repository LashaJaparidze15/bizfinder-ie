import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon, iconForCategory } from "@/components/Icon";

export const revalidate = 3600;

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

async function resolveCounty(slug: string) {
  const counties = await api.getCounties().catch(() => []);
  return counties.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: { county: string } }): Promise<Metadata> {
  const county = await resolveCounty(params.county);
  if (!county) return { title: "Not found" };
  return {
    title: `Businesses in ${county.county}`,
    description: `Browse ${county.count} businesses across ${county.county}, Ireland — by category. Find contact details, phone numbers and more on bizfinder.ie.`,
    alternates: { canonical: `/${county.slug}` },
  };
}

export default async function CountyHub({ params }: { params: { county: string } }) {
  const county = await resolveCounty(params.county);
  if (!county) notFound();
  const categories = await api.getCategories(county.county);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: county.county, item: `${SITE}/${county.slug}` },
    ],
  };

  return (
    <main className="container rise rise-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <nav className="crumbs">
        <Link href="/">Home</Link>
        <span className="sep">›</span>
        <span>{county.county}</span>
      </nav>
      <span className="eyebrow"><span className="dot" />County guide</span>
      <h1 style={{ marginTop: 14 }}>Businesses in {county.county}</h1>
      <p className="muted">{county.count.toLocaleString()} listed · browse by category</p>

      <div className="grid-cats" style={{ marginTop: 22 }}>
        {categories.map((c) => (
          <Link key={c.slug} href={`/${county.slug}/${c.slug}`} className="cat-card">
            <span className="cat-card__ico"><Icon name={iconForCategory(c.name)} size={20} /></span>
            <span>
              <span className="cat-card__name">{c.name}</span>
              <span className="cat-card__count" style={{ display: "block" }}>{c.count} listing{c.count === 1 ? "" : "s"}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
