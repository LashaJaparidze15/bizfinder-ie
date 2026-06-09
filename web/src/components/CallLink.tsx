"use client";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/Icon";

// Tel link that records a `call` event before dialing. This is the metric businesses pay for.
export function CallLink({ businessId, e164 }: { businessId: number; e164: string }) {
  return (
    <a href={`tel:${e164}`} onClick={() => track(businessId, "call")} className="btn">
      <Icon name="phone" size={16} /> Call {e164}
    </a>
  );
}
