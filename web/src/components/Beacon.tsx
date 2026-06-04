"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Fires an `impression` on mount and a `dwell` (with elapsed ms) on unmount/leave.
export function Beacon({ businessId }: { businessId: number }) {
  useEffect(() => {
    track(businessId, "impression");
    const start = Date.now();
    return () => track(businessId, "dwell", { dwellMs: Date.now() - start });
  }, [businessId]);
  return null;
}
