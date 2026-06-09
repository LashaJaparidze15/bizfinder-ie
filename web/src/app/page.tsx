import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";

export const revalidate = 300; // refresh the "Browse by county" list every 5 min

export default async function HomePage() {
  const counties = await api.getCounties().catch(() => []);
  const totalBiz = counties.reduce((sum, c) => sum + (c.count ?? 0), 0);

  return (
    <main className="container">
      {/* ---------- Hero ---------- */}
      <section className="hero rise rise-1">
        <span className="eyebrow"><span className="dot" />Ireland&apos;s business directory</span>
        <h1 style={{ marginTop: 16 }}>
          Find any <span className="grad">Irish business</span>
        </h1>
        <p className="hero__sub">
          Search by name, type, town or phone number across all 26 counties — contact details,
          reviews and more.
        </p>

        <div className="search-shell rise rise-2">
          <form className="search-form" action="/search" method="get">
            <span className="field">
              <span className="ico"><Icon name="search" /></span>
              <input name="q" placeholder="e.g. hotel, plumber, café" aria-label="Search term" />
            </span>
            <span className="field" style={{ flexBasis: 180 }}>
              <span className="ico"><Icon name="pin" /></span>
              <input name="county" placeholder="County (optional)" aria-label="County" />
            </span>
            <button type="submit">Search</button>
          </form>

          <form className="search-form" action="/search" method="get">
            <span className="field">
              <span className="ico"><Icon name="phone" /></span>
              <input name="phone" placeholder="Reverse lookup: who owns this number?" aria-label="Phone number" />
            </span>
            <button type="submit" className="btn-ghost">Look up</button>
          </form>
        </div>

        {/* Stats strip */}
        {counties.length > 0 && (
          <div className="chip-wrap rise rise-3" style={{ justifyContent: "center", marginTop: 22, gap: 28 }}>
            <Stat value={totalBiz.toLocaleString()} label="Businesses listed" />
            <Stat value={String(counties.length)} label="Counties covered" />
            <Stat value="Free" label="To search, always" />
          </div>
        )}
      </section>

      {/* ---------- Counties ---------- */}
      {counties.length > 0 && (
        <section className="section rise rise-4" id="counties">
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
      )}
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div className="muted" style={{ fontSize: "0.82rem" }}>{label}</div>
    </div>
  );
}
