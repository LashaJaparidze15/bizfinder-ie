"use client";
import { useState } from "react";
import { createApiClient } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";

const client = createApiClient({ baseUrl: PUBLIC_API });

// Starts Stripe Checkout and redirects to the hosted payment page.
export function SubscribeButton({ businessId }: { businessId: number }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function subscribe() {
    if (!email) return setErr("Enter your email.");
    setBusy(true);
    setErr(null);
    try {
      const { url } = await client.createCheckout({ businessId, email });
      if (url) window.location.href = url;
      else setErr("Could not start checkout.");
    } catch {
      setErr("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="search-form" style={{ marginTop: 8 }}>
        <input
          type="email"
          placeholder="you@business.ie"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={subscribe} disabled={busy}>
          {busy ? "…" : "Subscribe"}
        </button>
      </div>
      {err && <p className="muted">{err}</p>}
    </div>
  );
}
