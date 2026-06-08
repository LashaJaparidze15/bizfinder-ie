import Link from "next/link";
import type { SearchQuery, BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { BizPhoto } from "@/components/BizPhoto";

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
    <main className="container">
      <form className="search-form" action="/search" method="get">
        <input name="q" defaultValue={q} placeholder="e.g. hotel, plumber, cafe" />
        <input name="county" defaultValue={county} placeholder="County (optional)" />
        <button type="submit">Search</button>
      </form>

      {!hasQuery && <p className="muted">Enter a search above.</p>}
      {error && <p className="muted">Couldn’t complete the search ({error}).</p>}
      {hasQuery && !error && (
        <p className="muted">
          {results.length} result{results.length === 1 ? "" : "s"}
          {phone ? ` for ${phone}` : q ? ` for “${q}”` : ""}
        </p>
      )}

      {results.map((b) => (
        <div className="card" key={b.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 72, flex: "none" }}>
            <BizPhoto photoUrl={b.photoUrl} name={b.name} category={null} height={72} rounded={10} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/business/${b.slug}`} style={{ fontWeight: 600, fontSize: 18 }}>
              {b.name}
            </Link>
            <div className="muted">
              {[b.location?.town, b.location?.county].filter(Boolean).join(", ")}
              {b.distanceMeters != null ? ` · ${Math.round(b.distanceMeters)} m away` : ""}
              {b.avgRating != null ? ` · ★ ${b.avgRating} (${b.reviewCount})` : ""}
            </div>
            {!b.hasWebsite && <span className="badge">No website</span>}
          </div>
        </div>
      ))}
    </main>
  );
}
