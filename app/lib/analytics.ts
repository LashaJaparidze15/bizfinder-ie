import { Platform } from "react-native";
import type { EventType } from "@bizfinder/shared";
import { api } from "./api";

// surface = ios | android (native only). Fire-and-forget.
export function track(businessId: number, eventType: EventType, extra?: { dwellMs?: number }) {
  const surface = Platform.OS === "ios" ? "ios" : "android";
  void api.trackEvent({ businessId, eventType, surface, ...extra });
}
