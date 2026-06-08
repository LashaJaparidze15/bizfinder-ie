import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { Beacon } from "@/components/Beacon";
import { CallLink } from "@/components/CallLink";
import { ReviewForm } from "@/components/ReviewForm";
import { BizPhoto } from "@/components/BizPhoto";
import { ClaimForm } from "@/components/ClaimForm";

async function getBusiness(slug: string): Promise<BusinessListing | null> {
  try {
    return await api.getBusiness(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const b = await getBusiness(params.slug);
  if (!b) return { title: "Business not found" };
  const where = [b.location?.town, b.location?.county].filter(Boolean).join(", ");
  return {
    title: where ? `${b.name} — ${where}` : b.name,
    description: b.description ?? `${b.name}${where ? ` in ${where}` : ""}. Contact details and info.`,
    alternates: { canonical: `/business/${b.slug}` },
  };
}

export default async function BusinessPage({ params }: { params: { slug: string } }) {
  const b = await getBusiness(params.slug);
  if (!b) notFound();
  const similar = await api.getSimilar(b.slug, 6).catch(() => []);

  const where = [b.location?.addressLine, b.location?.town, b.location?.county, b.location?.eircode]
    .filter(Boolean)
    .join(", ");

  // schema.org LocalBusiness — this is what gets us into Google's rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    ...(b.websiteUrl ? { url: b.websiteUrl } : {}),
    ...(b.phones[0] ? { telephone: b.phones[0].e164 } : {}),
    ...(where
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: b.location?.addressLine ?? undefined,
            addressLocality: b.location?.town ?? undefined,
            addressRegion: b.location?.county ?? undefined,
            postalCode: b.location?.eircode ?? undefined,
            addressCountry: "IE",
          },
        }
      : {}),
    ...(b.location?.lat && b.location?.lng
      ? { geo: { "@type": "GeoCoordinates", latitude: b.location.lat, longitude: b.location.lng } }
      : {}),
    ...(b.avgRating != null && b.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: b.avgRating, reviewCount: b.reviewCount } }
      : {}),
    ...(b.reviews && b.reviews.length
      ? {
          review: b.reviews.slice(0, 10).map((rv) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: rv.rating },
            author: { "@type": "Person", name: rv.authorName || "Anonymous" },
            ...(rv.body ? { reviewBody: rv.body } : {}),
          })),
        }
      : {}),
  };

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Beacon businessId={b.id} />

      <div style={{ margin: "4px 0 12px" }}>
        <BizPhoto photoUrl={b.photoUrl} name={b.name} category={null} height={200} />
      </div>
      <h1 style={{ marginBottom: 4 }}>{b.name}</h1>
      {where && <p className="muted" style={{ marginTop: 0, marginBottom: 4 }}>{where}</p>}
      {b.avgRating != null ? (
        <p style={{ marginTop: 0 }}>
          <span style={{ color: "#e8a200" }}>
            {"★".repeat(Math.round(b.avgRating))}
            {"☆".repeat(5 - Math.round(b.avgRating))}
          </span>{" "}
          <strong>{b.avgRating}</strong>{" "}
          <span className="muted">· {b.reviewCount} review{b.reviewCount === 1 ? "" : "s"}</span>
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>No reviews yet</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {b.phones.map((p) => (
          <CallLink key={p.e164} businessId={b.id} e164={p.e164} />
        ))}
        {b.websiteUrl && (
          <a href={b.websiteUrl} target="_blank" rel="noopener" className="badge" style={{ padding: "6px 12px" }}>
            🌐 Website
          </a>
        )}
      </div>

      {!b.hasWebsite && (
        <div className="card" style={{ background: "#fffbe6", borderColor: "#f5e08c" }}>
          <strong>No website yet?</strong>{" "}
          <span className="muted">
            Businesses with a website get noticeably more engagement. We can build you a basic one.
          </span>
        </div>
      )}

      {/* App-install deep link (CTA into the mobile app, the main usage surface) */}
      <div className="card">
        <a href={`bizfinderie://business/${b.slug}`}>📱 Open in the bizfinder app</a>
        <div className="muted">Get directions, save, and call faster in the app.</div>
      </div>

      <div className="card" style={{ background: "#f3faf6", borderColor: "#bfe6d2" }}>
        <strong>Is this your business?</strong>{" "}
        <span className="muted">Claim it to manage the listing and see its analytics.</span>
        <ClaimForm businessId={b.id} />
      </div>

      {similar.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18 }}>Similar businesses</h2>
          {similar.map((s) => (
            <div className="card" key={s.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 56, flex: "none" }}>
                <BizPhoto photoUrl={s.photoUrl} name={s.name} category={s.category} height={56} rounded={8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/business/${s.slug}`} style={{ fontWeight: 600 }}>{s.name}</Link>
                <div className="muted">
                  {[s.town, s.county].filter(Boolean).join(", ")}
                  {s.avgRating != null ? ` · ★ ${s.avgRating} (${s.reviewCount})` : ""}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 18 }}>Reviews</h2>
        {b.reviews && b.reviews.length > 0 ? (
          b.reviews.map((rv) => (
            <div className="card" key={rv.id}>
              <div>
                <span style={{ color: "#e8a200" }}>{"★".repeat(rv.rating)}</span>{" "}
                <strong>{rv.authorName || "Anonymous"}</strong>
              </div>
              {rv.body && <div className="muted" style={{ marginTop: 4 }}>{rv.body}</div>}
            </div>
          ))
        ) : (
          <p className="muted">Be the first to review {b.name}.</p>
        )}
        <ReviewForm slug={b.slug} />
      </section>
    </main>
  );
}
