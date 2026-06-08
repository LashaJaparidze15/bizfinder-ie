"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createApiClient } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";

const client = createApiClient({ baseUrl: PUBLIC_API });

export function ReviewForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await client.createReview(slug, {
        rating,
        authorName: authorName || undefined,
        body: body || undefined,
      });
      setDone(true);
      router.refresh(); // re-fetch the server component so the new review + avg show
    } catch {
      setErr("Could not submit your review.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="muted">Thanks — your review was posted.</p>;

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 8 }}>
      <strong>Leave a review</strong>
      <label className="muted">
        Rating:{" "}
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n})
            </option>
          ))}
        </select>
      </label>
      <input
        placeholder="Your name (optional)"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
      />
      <textarea
        placeholder="Your review (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
      />
      <button type="submit" disabled={busy} style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "#0b6", color: "#fff", justifySelf: "start" }}>
        {busy ? "…" : "Submit review"}
      </button>
      {err && <p className="muted">{err}</p>}
    </form>
  );
}
