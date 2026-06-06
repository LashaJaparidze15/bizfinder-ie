import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

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
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <nav className="muted" style={{ fontSize: 14 }}>
        <Link href="/">Home</Link> › {county.county}
      </nav>
      <h1>Businesses in {county.county}</h1>
      <p className="muted">{county.count} listed · browse by category</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
        {categories.map((c) => (
          <Link key={c.slug} href={`/${county.slug}/${c.slug}`} className="card" style={{ display: "block" }}>
            <span style={{ fontWeight: 600 }}>{c.name}</span>{" "}
            <span className="muted">({c.count})</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
