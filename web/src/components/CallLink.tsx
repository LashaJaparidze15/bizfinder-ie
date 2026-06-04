"use client";
import { track } from "@/lib/analytics";

// Tel link that records a `call` event before dialing. This is the metric businesses pay for.
export function CallLink({ businessId, e164 }: { businessId: number; e164: string }) {
  return (
    <a
      href={`tel:${e164}`}
      onClick={() => track(businessId, "call")}
      className="badge"
      style={{ background: "#0b6", color: "#fff", fontSize: 14, padding: "6px 12px" }}
    >
      📞 Call {e164}
    </a>
  );
}
