"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createApiClient, type CategoryCount } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";
import { Button } from "@/components/ui/button";

const client = createApiClient({ baseUrl: PUBLIC_API });
const slugify = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");

type State = "idle" | "locating" | "done" | "error";

// "Explore your area": asks for location, finds the user's county from nearby
// businesses, then shows that area's most popular categories to explore.
export function ExploreArea() {
  const [state, setState] = useState<State>("idle");
  const [county, setCounty] = useState<string | null>(null);
  const [cats, setCats] = useState<CategoryCount[]>([]);
  const [err, setErr] = useState<string>("");

  function explore() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Location isn’t available in this browser.");
      setState("error");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const nearby = await client.search({ lat, lng, limit: 25, offset: 0 });
          const c = nearby.find((b) => b.location?.county)?.location?.county ?? null;
          if (!c) {
            setErr("Couldn’t find listings near you yet.");
            setState("error");
            return;
          }
          const categories = await client.getCategories(c);
          setCounty(c);
          setCats(categories.slice(0, 12));
          setState("done");
        } catch {
          setErr("Something went wrong finding your area.");
          setState("error");
        }
      },
      () => {
        setErr("Location permission denied.");
        setState("error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  if (state === "done" && county) {
    return (
      <div className="w-full max-w-2xl">
        <p className="mb-3 text-sm text-foreground/70">
          Popular near you in <strong className="text-foreground">{county}</strong>
        </p>
        <div className="chip-wrap" style={{ justifyContent: "center" }}>
          {cats.map((c) => (
            <Link key={c.slug} href={`/${slugify(county)}/${c.slug}`} className="chip">
              {c.name} <span className="chip__count">{c.count}</span>
            </Link>
          ))}
        </div>
        <Link href={`/${slugify(county)}`} className="mt-3 inline-block text-sm font-semibold text-primary">
          See everything in {county} →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="solid" size="lg" onClick={explore} disabled={state === "locating"} className="group">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {state === "locating" ? "Finding your area…" : "Explore your area"}
      </Button>
      {state === "error" && (
        <p className="text-sm text-foreground/60">
          {err}{" "}
          <Link href="/#counties" className="font-semibold text-primary">
            Browse by county instead →
          </Link>
        </p>
      )}
      {state === "idle" && (
        <p className="text-xs text-foreground/45">We’ll ask for your location to show what’s popular nearby.</p>
      )}
    </div>
  );
}
