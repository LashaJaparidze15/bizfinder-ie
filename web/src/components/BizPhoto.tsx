"use client";
import { useState } from "react";
import { Icon, iconForCategory } from "@/components/Icon";

// Real photo if we have one (og:image etc.); otherwise a deterministic, category-themed
// placeholder so a listing is never blank. Falls back to the placeholder if the image 404s.
function gradientFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  const hue = ((h % 360) + 360) % 360;
  return `linear-gradient(140deg, hsl(${hue}, 46%, 58%), hsl(${(hue + 32) % 360}, 52%, 42%))`;
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
        background: gradientFromString(category || name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.92)",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.22))",
      }}
      aria-label={`${category || "business"} placeholder`}
    >
      <Icon name={iconForCategory(category)} size={Math.max(Math.round(height / 2.6), 22)} strokeWidth={1.75} />
    </div>
  );
}
