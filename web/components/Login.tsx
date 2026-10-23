"use client";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api, errMessage, getConfig } from "@/lib/api";
import Turnstile from "./Turnstile";
import Reveal from "./Reveal";
import MaskHeading from "./MaskHeading";

// Magic-link sign-in: POST /api/login always answers the same way (no account enumeration).
export default function Login({ t, lang }: { t: Dict; lang: Locale }) {
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null); const [rk, setRk] = useState(0); const [noEmail, setNoEmail] = useState(false);
  useEffect(() => { getConfig().then((c) => { setSiteKey(c.turnstileSiteKey); setNoEmail(!!c.emailMock); }); }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const email = String(fd.get("email") || "").trim(); if (!email) return;
    const token = String(fd.get("cf-turnstile-response") || ""); if (siteKey && !token) return setErr(t.form.captcha);
    setBusy(true); setErr("");
    try { await api("/api/login", { body: { email, "cf-turnstile-response": token || undefined } }); setMsg(noEmail ? t.demo.loginSent : t.login.sent); } catch (x: any) { setErr(errMessage(x, t)); setRk((n) => n + 1); } finally { setBusy(false); }
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
          <Turnstile siteKey={siteKey} lang={lang} resetKey={rk} />
          {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
          <button disabled={busy} className="btn-cta w-full disabled:opacity-60">{t.login.send}</button>
        </form>)}
    </Reveal></main>
  );
}
