import type { AnalyticsResponse } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ManageListing } from "@/components/ManageListing";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card" style={{ flex: "1 1 140px", textAlign: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: "#0b6" }}>{value.toLocaleString()}</div>
      <div className="muted">{label}</div>
      {hint && <div className="muted" style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

function SurfaceRow({ name, counts, max }: { name: string; counts: { impressions: number; calls: number }; max: number }) {
  const pct = max ? Math.round((counts.impressions / max) * 100) : 0;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong style={{ textTransform: "capitalize" }}>{name === "web" ? "Web" : name}</strong>
        <span className="muted">{counts.impressions} views · {counts.calls} calls</span>
      </div>
      <div style={{ background: "#eee", borderRadius: 6, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: "#0b6", height: "100%" }} />
      </div>
    </div>
  );
}

function AnalyticsSection({ data }: { data: AnalyticsResponse }) {
  const appImpressions = (data.bySurface.ios?.impressions ?? 0) + (data.bySurface.android?.impressions ?? 0);
  const maxSurface = Math.max(data.bySurface.web?.impressions ?? 0, appImpressions, 1);
  return (
    <>
      <p className="muted">Last {data.days} days · business #{data.businessId}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
        <Stat label="Impressions" value={data.totals.impressions} />
        <Stat label="Clicks" value={data.totals.clicks} />
        <Stat label="Calls generated" value={data.totals.calls} hint="the metric that matters" />
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Where your engagement comes from</h3>
        <SurfaceRow name="web" counts={{ impressions: data.bySurface.web?.impressions ?? 0, calls: data.bySurface.web?.calls ?? 0 }} max={maxSurface} />
        <SurfaceRow name="app" counts={{ impressions: appImpressions, calls: (data.bySurface.ios?.calls ?? 0) + (data.bySurface.android?.calls ?? 0) }} max={maxSurface} />
      </div>
    </>
  );
}

export default async function DashboardPage({ params }: { params: { businessId: string } }) {
  const businessId = Number(params.businessId);

  const billing = await api
    .getBillingStatus(businessId)
    .catch(() => ({ active: false, billingEnabled: false }));
  const locked = billing.billingEnabled && !billing.active;

  let data: AnalyticsResponse | null = null;
  let error: string | null = null;
  if (!locked) {
    try {
      data = await api.getAnalytics(businessId, 30);
    } catch (e) {
      error = e instanceof Error ? e.message : "failed to load";
    }
  }

  return (
    <main className="container">
      <h1>Your listing</h1>

      {/* Free for the owner: edit details (self-gates by owner session) */}
      <ManageListing businessId={businessId} />

      <section className="section">
        <div className="section__head"><h2>Listing analytics</h2></div>
        {locked ? (
          <div className="notice notice-warn">
            <strong>Unlock your analytics</strong>
            <p className="muted">
              See impressions, click-throughs, calls generated, and the web-vs-app split for your
              listing. Subscribe to get full access.
            </p>
            <SubscribeButton businessId={businessId} />
          </div>
        ) : error || !data ? (
          <p className="muted">Couldn’t load analytics ({error}).</p>
        ) : (
          <AnalyticsSection data={data} />
        )}
      </section>
    </main>
  );
}
