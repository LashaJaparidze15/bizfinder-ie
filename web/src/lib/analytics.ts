"use client";
import { createApiClient, type EventType } from "@bizfinder/shared";
import { PUBLIC_API } from "./api";

const client = createApiClient({ baseUrl: PUBLIC_API });

// Fire-and-forget analytics from the browser. surface = "web".
export function track(businessId: number, eventType: EventType, extra?: { dwellMs?: number }) {
  void client.trackEvent({
    businessId,
    eventType,
    surface: "web",
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
    ...extra,
  });
}
