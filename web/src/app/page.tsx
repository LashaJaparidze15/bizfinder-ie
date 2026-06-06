import Link from "next/link";
import { api } from "@/lib/api";

export const revalidate = 3600;

export default async function HomePage() {
  const counties = await api.getCounties().catch(() => []);

  return (
    <main className="container">
      <h1>Find any Irish business</h1>
      <p className="muted">Search by name, type, town, or phone number.</p>

      <form className="search-form" action="/search" method="get">
        <input name="q" placeholder="e.g. hotel, plumber, cafe" aria-label="Search term" />
        <input name="county" placeholder="County (optional)" aria-label="County" />
        <button type="submit">Search</button>
      </form>

      <form className="search-form" action="/search" method="get" style={{ marginTop: 4 }}>
        <input name="phone" placeholder="Reverse lookup: phone number" aria-label="Phone number" />
        <button type="submit">Look up</button>
      </form>

      {counties.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>Browse by county</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {counties.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} className="badge" style={{ padding: "6px 12px" }}>
                {c.county} ({c.count})
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
