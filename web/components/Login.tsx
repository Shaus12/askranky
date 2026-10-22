"use client";
import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import Reveal from "./Reveal";
import MaskHeading from "./MaskHeading";

// Magic-link sign-in: POST /api/login always answers the same way (no account enumeration).
export default function Login({ t }: { t: Dict; lang: Locale }) {
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const email = String(new FormData(e.currentTarget).get("email") || "").trim(); if (!email) return;
    setBusy(true); setErr("");
    try { await api("/api/login", { body: { email } }); setMsg(t.login.sent); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main><Reveal className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)]">
      <MaskHeading as="h1" className="vx-h3" text={t.login.title} />
      <span data-hair className="hairline mx-auto mt-6 block w-40" />
      <p data-reveal className="vx-lede mt-6 text-center">{t.login.sub}</p>
      {msg ? <p role="status" data-reveal className="card mt-8 p-6 text-center text-emerald-200">✓ {msg}</p> : (
        <form onSubmit={submit} data-reveal className="card mt-8 space-y-4 p-6">
          <label className="vx-label">{t.login.email}
            <input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="you@business.com" className="vx-input" /></label>
          {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
          <button disabled={busy} className="btn-cta w-full disabled:opacity-60">{t.login.send}</button>
        </form>)}
    </Reveal></main>
  );
}
