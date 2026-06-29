"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createApiClient, type ManagedBusiness, type EditBusinessInput } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BizPhoto } from "@/components/BizPhoto";

const client = createApiClient({ baseUrl: PUBLIC_API });
const SESSION_KEY = "bf_owner_session";

type Status = "checking" | "guest" | "owner" | "denied";

export function ManageListing({ businessId }: { businessId: number }) {
  const [status, setStatus] = useState<Status>("checking");
  const [biz, setBiz] = useState<ManagedBusiness | null>(null);
  const [form, setForm] = useState<EditBusinessInput>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (!token) { setStatus("guest"); return; }
    client
      .getManagedBusiness(businessId, token)
      .then((b) => {
        setBiz(b);
        setForm({
          name: b.name, description: b.description ?? "", email: b.email ?? "",
          phone: b.phone ?? "", website: b.website ?? "", photoUrl: b.photoUrl ?? undefined,
        });
        setStatus("owner");
      })
      .catch(() => setStatus("denied"));
  }, [businessId]);

  function set<K extends keyof EditBusinessInput>(k: K, v: EditBusinessInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return;
    setBusy(true); setErr(""); setSaved(false);
    try {
      // only send non-empty diffs; photoUrl must be a valid url or omitted
      const patch: EditBusinessInput = {};
      if (form.name) patch.name = form.name;
      patch.description = form.description ?? "";
      if (form.email) patch.email = form.email;
      patch.phone = form.phone ?? "";
      if (form.website) patch.website = form.website;
      if (form.photoUrl) patch.photoUrl = form.photoUrl;
      await client.updateBusiness(businessId, patch, token);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save.");
    } finally { setBusy(false); }
  }

  if (status === "checking") return null;

  if (status !== "owner") {
    return (
      <div className="notice notice-brand">
        <strong>Own this business?</strong>{" "}
        <span className="muted">Claim it to edit the listing and manage your details.</span>
        <div style={{ marginTop: 10 }}>
          <Link href="/for-business"><Button variant="solid" size="sm">Enter as business</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Manage your listing</h2>
      <p className="muted" style={{ marginTop: 0 }}>Edit your details — changes go live on your page right away.</p>

      <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 96, flex: "none" }}>
            <BizPhoto photoUrl={form.photoUrl ?? null} name={form.name ?? "Business"} category={null} height={72} rounded={10} />
          </div>
          <label style={{ flex: 1, display: "grid", gap: 5 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-2)" }}>Photo URL</span>
            <input className="input" value={form.photoUrl ?? ""} onChange={(e) => set("photoUrl", e.target.value || undefined)} placeholder="https://…/your-photo.jpg" />
            <span className="muted" style={{ fontSize: "0.78rem" }}>Paste an image link for now — direct upload is coming.</span>
          </label>
        </div>

        <Field label="Business name"><input className="input" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Description"><textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Tell customers what you do…" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Contact email"><input className="input" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+353…" /></Field>
        </div>
        <Field label="Website"><input className="input" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></Field>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Button type="submit" variant="solid" disabled={busy} style={{ justifySelf: "start" }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          {biz && <Link href={`/business/${biz.slug}`} className="muted" style={{ fontWeight: 600 }}>View public page →</Link>}
          {saved && <span style={{ color: "var(--brand-700)", fontWeight: 600, fontSize: "0.9rem" }}>Saved ✓</span>}
          {err && <span className="muted">{err}</span>}
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
      {children}
    </label>
  );
}
