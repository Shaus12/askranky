"use client";
import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
// Magic-link sign-in: POST /api/login always answers the same way (no account enumeration).
export default function Login({ t }: { t: Dict; lang: Locale }) {
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const email = String(new FormData(e.currentTarget).get("email") || "").trim(); if (!email) return;
    setBusy(true); setErr("");
    try { await api("/api/login", { body: { email } }); setMsg(t.login.sent); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-extrabold md:text-4xl">{t.login.title}</h1>
      <p className="mt-3 text-center text-slate-400">{t.login.sub}</p>
      {msg ? <p role="status" className="glass mt-8 p-6 text-center text-emerald-200">✓ {msg}</p> : (
        <form onSubmit={submit} className="glass mt-8 space-y-4 p-6">
          <label className="block text-sm text-slate-300">{t.login.email}
            <input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="you@business.com" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-slate-500 focus:border-brand-400 focus:outline-none" /></label>
          {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
          <button disabled={busy} className="btn-cta w-full disabled:opacity-60">{t.login.send}</button>
        </form>)}
    </main>
  );
}
