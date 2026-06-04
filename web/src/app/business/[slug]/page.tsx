import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { Beacon } from "@/components/Beacon";
import { CallLink } from "@/components/CallLink";

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
  };

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Beacon businessId={b.id} />

      <h1 style={{ marginBottom: 4 }}>{b.name}</h1>
      {where && <p className="muted" style={{ marginTop: 0 }}>{where}</p>}

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
    </main>
  );
}
