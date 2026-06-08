"use client";
import { useState } from "react";
import { createApiClient } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";

const client = createApiClient({ baseUrl: PUBLIC_API });

export function ClaimForm({ businessId }: { businessId: number }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setErr("Enter your email.");
    setBusy(true);
    setErr(null);
    try {
      await client.createClaim({ businessId, email });
      setDone(true);
    } catch {
      setErr("Couldn’t submit — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="muted">
        Claim submitted — we’ll verify it, then you can manage this listing and see its analytics.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="search-form" style={{ marginTop: 8 }}>
      <input
        type="email"
        placeholder="you@business.ie"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={busy}>
        {busy ? "…" : "Claim it"}
      </button>
      {err && <p className="muted">{err}</p>}
    </form>
  );
}
