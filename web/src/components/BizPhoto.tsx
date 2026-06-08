"use client";
import { useState } from "react";

// Real photo if we have one (og:image etc.); otherwise a deterministic, category-themed
// placeholder so a listing is never blank. Falls back to the placeholder if the image 404s.
function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${((h % 360) + 360) % 360}, 42%, 52%)`;
}

function emojiFor(category: string | null): string {
  const c = (category || "").toLowerCase();
  if (/pub|bar/.test(c)) return "🍺";
  if (/cafe|coffee/.test(c)) return "☕";
  if (/restaurant|fast|food|takeaway/.test(c)) return "🍽️";
  if (/hotel|guest|hostel|lodg/.test(c)) return "🏨";
  if (/fuel|petrol/.test(c)) return "⛽";
  if (/bank/.test(c)) return "🏦";
  if (/pharmac|chemist/.test(c)) return "💊";
  if (/supermarket|convenience|grocer/.test(c)) return "🛒";
  if (/hair|beauty|salon/.test(c)) return "💇";
  if (/bakery/.test(c)) return "🥐";
  if (/car|garage|repair|tyre/.test(c)) return "🚗";
  if (/doctor|dentist|clinic|vet|health/.test(c)) return "🩺";
  if (/book|library/.test(c)) return "📚";
  return "🏢";
}

export function BizPhoto({
  photoUrl,
  name,
  category,
  height = 160,
  rounded = 12,
}: {
  photoUrl: string | null;
  name: string;
  category: string | null;
  height?: number;
  rounded?: number;
}) {
  const [failed, setFailed] = useState(false);
  const base = { width: "100%", height, borderRadius: rounded, overflow: "hidden", flex: "none" } as const;

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ ...base, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div
      style={{
        ...base,
        background: colorFromString(category || name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(height / 3, 28),
      }}
      aria-label={`${category || "business"} placeholder`}
    >
      {emojiFor(category)}
    </div>
  );
}
