import Link from "next/link";
import type { SearchQuery, BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { BizPhoto } from "@/components/BizPhoto";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic"; // search results are always fresh

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = one(searchParams.q);
  const county = one(searchParams.county);
  const phone = one(searchParams.phone);
  const lat = one(searchParams.lat);
  const lng = one(searchParams.lng);

  const hasQuery = q || county || phone || (lat && lng);

  let results: BusinessListing[] = [];
  let error: string | null = null;

  if (hasQuery) {
    const params = {
      ...(q ? { q } : {}),
      ...(county ? { county } : {}),
      ...(phone ? { phone } : {}),
      ...(lat && lng ? { lat: Number(lat), lng: Number(lng) } : {}),
      limit: 20,
      offset: 0,
    } as SearchQuery;
    try {
      results = await api.search(params);
    } catch (e) {
      error = e instanceof Error ? e.message : "search failed";
    }
  }

  return (
    <main className="container rise rise-1">
      <h1 style={{ fontSize: "1.9rem" }}>Search</h1>
      <div className="search-shell" style={{ margin: "16px 0 8px", boxShadow: "var(--shadow-md)" }}>
        <form className="search-form" action="/search" method="get">
          <span className="field">
            <span className="ico"><Icon name="search" /></span>
            <input name="q" defaultValue={q} placeholder="e.g. hotel, plumber, café" />
          </span>
          <span className="field" style={{ flexBasis: 180 }}>
            <span className="ico"><Icon name="pin" /></span>
            <input name="county" defaultValue={county} placeholder="County (optional)" />
          </span>
          <button type="submit">Search</button>
        </form>
      </div>

      {!hasQuery && <p className="muted">Enter a search above to find Irish businesses.</p>}
      {error && <p className="muted">Couldn’t complete the search ({error}).</p>}
      {hasQuery && !error && (
        <p className="muted" style={{ marginTop: 18 }}>
          <strong style={{ color: "var(--ink)" }}>{results.length}</strong> result{results.length === 1 ? "" : "s"}
          {phone ? ` for ${phone}` : q ? ` for “${q}”` : ""}
        </p>
      )}

      {results.map((b) => (
        <div className="row" key={b.id}>
          <div style={{ width: 76, flex: "none" }}>
            <BizPhoto photoUrl={b.photoUrl} name={b.name} category={null} height={76} rounded={10} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/business/${b.slug}`} className="row__title">{b.name}</Link>
            <div className="row__meta">
              {[b.location?.town, b.location?.county].filter(Boolean).join(", ")}
              {b.distanceMeters != null ? ` · ${Math.round(b.distanceMeters)} m away` : ""}
              {b.avgRating != null ? <> · <span className="stars">★</span> {b.avgRating} ({b.reviewCount})</> : ""}
            </div>
            {!b.hasWebsite && <span className="badge badge-neutral" style={{ marginTop: 8 }}>No website</span>}
          </div>
        </div>
      ))}
    </main>
  );
}
