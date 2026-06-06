import type { AnalyticsResponse } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { SubscribeButton } from "@/components/SubscribeButton";

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

export default async function DashboardPage({ params }: { params: { businessId: string } }) {
  const businessId = Number(params.businessId);

  // Paywall: if billing is live and this owner hasn't subscribed, show the CTA.
  const billing = await api
    .getBillingStatus(businessId)
    .catch(() => ({ active: false, billingEnabled: false }));
  if (billing.billingEnabled && !billing.active) {
    return (
      <main className="container">
        <h1>Listing analytics</h1>
        <div className="card" style={{ background: "#fffbe6", borderColor: "#f5e08c" }}>
          <strong>Unlock your analytics</strong>
          <p className="muted">
            See impressions, click-throughs, calls generated, and the web-vs-app split for your
            listing. Subscribe to get full access.
          </p>
          <SubscribeButton businessId={businessId} />
        </div>
      </main>
    );
  }

  let data: AnalyticsResponse | null = null;
  let error: string | null = null;
  try {
    data = await api.getAnalytics(businessId, 30);
  } catch (e) {
    error = e instanceof Error ? e.message : "failed to load";
  }

  if (error || !data) {
    return (
      <main className="container">
        <h1>Listing analytics</h1>
        <p className="muted">Couldn’t load analytics ({error}).</p>
      </main>
    );
  }

  const appImpressions = (data.bySurface.ios?.impressions ?? 0) + (data.bySurface.android?.impressions ?? 0);
  const maxSurface = Math.max(
    data.bySurface.web?.impressions ?? 0,
    appImpressions,
    1,
  );

  return (
    <main className="container">
      <h1>Listing analytics</h1>
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

      <div className="card" style={{ background: "#f3faf6", borderColor: "#bfe6d2" }}>
        <strong>This is the paid view.</strong>{" "}
        <span className="muted">
          Subscription gating is wired: once Stripe keys are set, only a claimed owner with an
          active plan reaches this data — others get the subscribe screen.
        </span>
      </div>
    </main>
  );
}
