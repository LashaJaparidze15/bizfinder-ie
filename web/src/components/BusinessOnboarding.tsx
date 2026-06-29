"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowLeft } from "lucide-react";
import { createApiClient, type BusinessListing, type CategoryCount } from "@bizfinder/shared";
import { PUBLIC_API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/Icon";

const client = createApiClient({ baseUrl: PUBLIC_API });

type Step = "search" | "register" | "claim" | "code-register" | "code-claim";

const SESSION_KEY = "bf_owner_session";

export function BusinessOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessListing[]>([]);
  const [searched, setSearched] = useState(false);

  // claim
  const [claimBiz, setClaimBiz] = useState<BusinessListing | null>(null);
  const [sentTo, setSentTo] = useState("");

  // register
  const [form, setForm] = useState({
    name: "", category: "", description: "", email: "", phone: "", website: "",
    county: "", town: "", addressLine: "", lat: undefined as number | undefined, lng: undefined as number | undefined,
  });

  // code
  const [code, setCode] = useState("");
  const [regToken, setRegToken] = useState("");

  // all categories, for the register dropdown (sorted A–Z)
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  useEffect(() => {
    client.getCategories()
      .then((cs) => setCategories([...cs].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setErr(""); setSearched(false);
    try {
      const r = await client.search({ q: query.trim(), limit: 8, offset: 0 });
      setResults(r); setSearched(true);
    } catch { setErr("Search failed, try again."); }
    finally { setBusy(false); }
  }

  // ----- claim -----
  async function startClaim(b: BusinessListing) {
    setClaimBiz(b); setErr(""); setStep("claim");
  }
  async function sendClaimCode() {
    if (!claimBiz) return;
    setBusy(true); setErr("");
    try {
      const r = await client.claimRequest(claimBiz.id);
      setSentTo(r.sentTo);
      if (r.devCode) setCode(r.devCode); // dev convenience
      setStep("code-claim");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t start the claim.");
    } finally { setBusy(false); }
  }
  async function verifyClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimBiz) return;
    setBusy(true); setErr("");
    try {
      const r = await client.claimVerify(claimBiz.id, code.trim());
      localStorage.setItem(SESSION_KEY, r.token);
      router.push(`/dashboard/${claimBiz.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t verify.");
    } finally { setBusy(false); }
  }

  // ----- register -----
  function startRegister() {
    setForm((f) => ({ ...f, name: f.name || query }));
    setErr(""); setStep("register");
  }
  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
    });
  }
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await client.requestCode({ email: form.email, purpose: "register" });
      if (r.devCode) setCode(r.devCode);
      setStep("code-register");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t send the code.");
    } finally { setBusy(false); }
  }
  async function verifyRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const v = await client.verifyCode({ email: form.email, code: code.trim(), purpose: "register" });
      const reg = await client.registerBusiness(
        {
          name: form.name, category: form.category, description: form.description || undefined,
          email: form.email, phone: form.phone || undefined, website: form.website || undefined,
          county: form.county, town: form.town || undefined, addressLine: form.addressLine || undefined,
          lat: form.lat, lng: form.lng,
        },
        v.token,
      );
      localStorage.setItem(SESSION_KEY, v.token);
      router.push(`/dashboard/${reg.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t complete registration.");
    } finally { setBusy(false); }
  }

  const back = (to: Step) => () => { setErr(""); setCode(""); setStep(to); };

  // ---------- render ----------
  if (step === "search") {
    return (
      <div>
        <form className="search-shell" onSubmit={doSearch} style={{ maxWidth: 620 }}>
          <div className="search-form">
            <span className="field">
              <span className="ico"><Icon name="search" /></span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Your business name…" aria-label="Business name" />
            </span>
            <button type="submit" disabled={busy}>{busy ? "…" : "Find it"}</button>
          </div>
        </form>

        {searched && (
          <div className="section" style={{ marginTop: 20 }}>
            {results.length > 0 ? (
              <>
                <p className="muted">Found these — claim yours:</p>
                {results.map((b) => (
                  <div className="row" key={b.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row__title">{b.name}</div>
                      <div className="row__meta">{[b.location?.town, b.location?.county].filter(Boolean).join(", ")}</div>
                    </div>
                    <Button size="sm" variant="solid" onClick={() => startClaim(b)}>Claim this</Button>
                  </div>
                ))}
                <div className="notice notice-brand" style={{ marginTop: 14 }}>
                  <strong>Not the right one?</strong>{" "}
                  <span className="muted">Add your business as a new listing.</span>
                  <div style={{ marginTop: 10 }}><Button variant="solid" onClick={startRegister}>Register my business free</Button></div>
                </div>
              </>
            ) : (
              <div className="notice notice-brand">
                <strong>No match for “{query}”.</strong>{" "}
                <span className="muted">Register it on bizfinder — it’s free.</span>
                <div style={{ marginTop: 10 }}><Button variant="solid" onClick={startRegister}>Register my business free</Button></div>
              </div>
            )}
          </div>
        )}
        {err && <p className="muted" style={{ marginTop: 10 }}>{err}</p>}
      </div>
    );
  }

  if (step === "claim") {
    return (
      <div className="container-narrow" style={{ padding: 0, maxWidth: 560 }}>
        <button className="crumbs" onClick={back("search")} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="card" style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 0 }}>Claim {claimBiz?.name}</h3>
          <p className="muted">To prove you own this business, we’ll send a verification code to the email we have on file for it.</p>
          <Button variant="solid" onClick={sendClaimCode} disabled={busy}>{busy ? "Sending…" : "Send verification code"}</Button>
          {err && <p className="muted" style={{ marginTop: 10 }}>{err}</p>}
        </div>
      </div>
    );
  }

  if (step === "code-claim" || step === "code-register") {
    const onSubmit = step === "code-claim" ? verifyClaim : verifyRegister;
    const where = step === "code-claim" ? sentTo : form.email;
    return (
      <div className="container-narrow" style={{ padding: 0, maxWidth: 480 }}>
        <button className="crumbs" onClick={back(step === "code-claim" ? "claim" : "register")} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <form className="card" onSubmit={onSubmit} style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Enter your code</h3>
          <p className="muted" style={{ margin: 0 }}>We sent a 6-digit code to <strong>{where}</strong>.</p>
          <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" style={{ letterSpacing: 6, fontSize: 20, textAlign: "center" }} />
          <Button type="submit" variant="solid" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify & continue"}</Button>
          {err && <p className="muted" style={{ margin: 0 }}>{err}</p>}
        </form>
      </div>
    );
  }

  // register form
  return (
    <div className="container-narrow" style={{ padding: 0, maxWidth: 640 }}>
      <button className="crumbs" onClick={back("search")} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
        <ArrowLeft size={15} /> Back
      </button>
      <form className="card" onSubmit={submitRegister} style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Register your business</h3>
        <Row label="Business name *"><input className="input" required value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Tara’s Café" /></Row>
        <Row label="Type / category *">
          <select className="input" required value={form.category} onChange={(e) => setField("category", e.target.value)}>
            <option value="" disabled>Select your business type…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </Row>
        <Row label="Description"><textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={3} placeholder="What you do, what makes you great…" /></Row>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Row label="Business email *"><input className="input" type="email" required value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="you@business.ie" /></Row>
          <Row label="Phone"><input className="input" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+353…" /></Row>
        </div>
        <Row label="Website"><input className="input" value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://…" /></Row>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Row label="County *"><input className="input" required value={form.county} onChange={(e) => setField("county", e.target.value)} placeholder="e.g. Galway" /></Row>
          <Row label="Town"><input className="input" value={form.town} onChange={(e) => setField("town", e.target.value)} placeholder="e.g. Salthill" /></Row>
        </div>
        <Row label="Address"><input className="input" value={form.addressLine} onChange={(e) => setField("addressLine", e.target.value)} placeholder="Street address" /></Row>
        <div>
          <button type="button" onClick={useMyLocation} className="chip" style={{ cursor: "pointer" }}>
            <MapPin size={14} /> {form.lat ? "Location pinned ✓" : "Use my current location"}
          </button>
        </div>
        <Button type="submit" variant="solid" disabled={busy} style={{ justifySelf: "start" }}>
          {busy ? "Sending code…" : "Continue — verify email"}
        </Button>
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>We’ll email a code to confirm it’s you, then your listing goes live.</p>
        {err && <p className="muted" style={{ margin: 0 }}>{err}</p>}
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
      {children}
    </label>
  );
}
