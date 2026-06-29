import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { BusinessOnboarding } from "@/components/BusinessOnboarding";

export const metadata: Metadata = {
  title: "For business owners — claim your listing & see your analytics",
  description:
    "Claim your business on bizfinder.ie to manage your listing and see real analytics — how many people view, click, and call you. Free to list; analytics by subscription.",
  alternates: { canonical: "/for-business" },
};

const valueProps = [
  {
    icon: "health" as const,
    title: "Real demand analytics",
    body: "See exactly how many people view your listing, tap your number, and visit your website — measured, not guessed.",
  },
  {
    icon: "building" as const,
    title: "Own your listing",
    body: "Claim your business to keep details accurate, respond to reviews, and stand out across the directory.",
  },
  {
    icon: "phone" as const,
    title: "Turn searches into calls",
    body: "Every impression, click and call is tracked by day and surface — know what’s working and grow.",
  },
];

export default function ForBusinessPage() {
  return (
    <main className="container-narrow">
      <span className="eyebrow"><span className="dot" />For business owners</span>
      <h1 style={{ marginTop: 14 }}>See who’s finding your business</h1>
      <p className="muted" style={{ fontSize: "1.05rem", maxWidth: "52ch" }}>
        Claim your listing to manage it and unlock your analytics dashboard — impressions, clicks and
        calls, broken down by day. Listing is free; analytics are a simple subscription.
      </p>

      {/* Interactive: search → claim if found / register if not → verify → dashboard */}
      <div style={{ margin: "22px 0 8px" }}>
        <BusinessOnboarding />
      </div>

      <section className="section">
        <div className="grid-cats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {valueProps.map((v) => (
            <div className="card" key={v.title}>
              <span className="cat-card__ico" style={{ marginBottom: 10 }}><Icon name={v.icon} size={20} /></span>
              <h3 style={{ margin: "0 0 6px" }}>{v.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="notice notice-brand" style={{ marginTop: 28 }}>
        <strong>How it works</strong>
        <ol className="muted" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Find your business above and open its listing.</li>
          <li>Claim it with your business email — we verify ownership.</li>
          <li>Subscribe to unlock your analytics dashboard and manage the listing.</li>
        </ol>
      </div>
    </main>
  );
}
