import Link from "next/link";
import { api } from "@/lib/api";
import { HomeHero } from "@/components/HomeHero";

export const revalidate = 300; // refresh the "Browse by county" list every 5 min

export default async function HomePage() {
  const counties = await api.getCounties().catch(() => []);

  return (
    <>
      <HomeHero counties={counties} />

      {counties.length > 0 && (
        <main className="container" style={{ paddingTop: 8 }}>
          <section className="section" id="counties">
            <div className="section__head">
              <h2>Browse by county</h2>
              <span className="muted">{counties.length} counties</span>
            </div>
            <div className="chip-wrap">
              {counties.map((c) => (
                <Link key={c.slug} href={`/${c.slug}`} className="chip">
                  {c.county} <span className="chip__count">{c.count}</span>
                </Link>
              ))}
            </div>
          </section>
        </main>
      )}
    </>
  );
}
