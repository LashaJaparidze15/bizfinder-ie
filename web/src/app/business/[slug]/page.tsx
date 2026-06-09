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
import { Icon } from "@/components/Icon";

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
    <main className="container-narrow rise rise-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Beacon businessId={b.id} />

      <nav className="crumbs">
        <Link href="/">Home</Link>
        {b.location?.county && (
          <>
            <span className="sep">›</span>
            <Link href={`/${b.location.county.toLowerCase()}`}>{b.location.county}</Link>
          </>
        )}
        <span className="sep">›</span>
        <span>{b.name}</span>
      </nav>

      {/* Hero banner with overlaid title */}
      <div className="biz-hero">
        <BizPhoto photoUrl={b.photoUrl} name={b.name} category={null} height={240} rounded={20} />
        <div style={{ position: "absolute", left: 22, right: 22, bottom: 18, zIndex: 1 }}>
          <h1 style={{ color: "#fff", marginBottom: 4, textShadow: "0 2px 14px rgba(0,0,0,0.4)" }}>{b.name}</h1>
          {where && <p style={{ color: "rgba(255,255,255,0.92)", margin: 0, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{where}</p>}
        </div>
      </div>

      {/* Rating line */}
      <div style={{ margin: "16px 0 6px" }}>
        {b.avgRating != null ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="stars" style={{ fontSize: "1.1rem" }}>
              {"★".repeat(Math.round(b.avgRating))}
              <span style={{ color: "var(--line)" }}>{"★".repeat(5 - Math.round(b.avgRating))}</span>
            </span>
            <strong>{b.avgRating}</strong>
            <span className="muted">· {b.reviewCount} review{b.reviewCount === 1 ? "" : "s"}</span>
          </span>
        ) : (
          <span className="muted">No reviews yet</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0 8px" }}>
        {b.phones.map((p) => (
          <CallLink key={p.e164} businessId={b.id} e164={p.e164} />
        ))}
        {b.websiteUrl && (
          <a href={b.websiteUrl} target="_blank" rel="noopener" className="btn btn-ghost">
            <Icon name="globe" size={16} /> Visit website
          </a>
        )}
      </div>

      {!b.hasWebsite && (
        <div className="notice notice-warn">
          <strong>No website yet?</strong>{" "}
          <span className="muted">
            Businesses with a website get noticeably more engagement. We can build you a basic one.
          </span>
        </div>
      )}

      {/* App-install deep link (CTA into the mobile app, the main usage surface) */}
      <div className="notice notice-app">
        <a href={`bizfinderie://business/${b.slug}`} style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="smartphone" size={16} /> Open in the bizfinder app
        </a>
        <div className="muted" style={{ marginTop: 2 }}>Get directions, save, and call faster in the app.</div>
      </div>

      <div className="notice notice-brand">
        <strong>Is this your business?</strong>{" "}
        <span className="muted">Claim it to manage the listing and see its analytics.</span>
        <ClaimForm businessId={b.id} />
      </div>

      {similar.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Similar businesses</h2></div>
          {similar.map((s) => (
            <div className="row" key={s.id}>
              <div style={{ width: 56, flex: "none" }}>
                <BizPhoto photoUrl={s.photoUrl} name={s.name} category={s.category} height={56} rounded={10} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/business/${s.slug}`} className="row__title" style={{ fontSize: "1rem" }}>{s.name}</Link>
                <div className="row__meta">
                  {[s.town, s.county].filter(Boolean).join(", ")}
                  {s.avgRating != null ? <> · <span className="stars">★</span> {s.avgRating} ({s.reviewCount})</> : ""}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <div className="section__head"><h2>Reviews</h2></div>
        {b.reviews && b.reviews.length > 0 ? (
          b.reviews.map((rv) => (
            <div className="card" key={rv.id} style={{ marginBottom: 12 }}>
              <div>
                <span className="stars">{"★".repeat(rv.rating)}</span>{" "}
                <strong>{rv.authorName || "Anonymous"}</strong>
              </div>
              {rv.body && <div className="muted" style={{ marginTop: 6 }}>{rv.body}</div>}
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
