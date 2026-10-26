"use client";
// Email + password sign-in, sign-up, reset, email confirmation and account settings (v2-auth). Hebrew RTL first; black + #2563eb.
// Every server answer about an email is generic (no account enumeration); passwords are only ever sent to /api/auth/* over POST.
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api, errMessage, getConfig, getMe, refreshMe, type Me } from "@/lib/api";
import { authText, authErr, type AuthText } from "@/lib/i18n-auth";
import Turnstile from "./Turnstile";
import "./auth.css";

const nextParam = () => { try { const n = new URLSearchParams(location.search).get("next") || ""; return /^\/(he|en)(\/|$)/.test(n) && !n.includes("//") ? n : ""; } catch { return ""; } };
function useCfg() { const [c, setC] = useState<{ siteKey: string | null; google: boolean; noEmail: boolean }>({ siteKey: null, google: false, noEmail: false });
  useEffect(() => { getConfig().then((x) => setC({ siteKey: x.turnstileSiteKey, google: !!(x as { googleAuth?: boolean }).googleAuth, noEmail: !!x.emailMock })); }, []); return c; }
const Shell = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <main className="rk-auth"><div className="rk-auth-card">
    <h1 className="rk-auth-h">{title}</h1>{sub && <p className="rk-auth-sub">{sub}</p>}{children}
  </div></main>);
function Pw({ a, name, label, auto, hint }: { a: AuthText; name: string; label: string; auto: string; hint?: boolean }) {
  const [show, setShow] = useState(false);
  return (<label className="rk-field"><span className="rk-field-l">{label}</span>
    <span className="rk-pw"><input name={name} type={show ? "text" : "password"} required minLength={hint ? 10 : undefined} maxLength={256} dir="ltr" autoComplete={auto} className="rk-input" aria-describedby={hint ? `${name}-hint` : undefined} />
      <button type="button" className="rk-pw-t" onClick={() => setShow(!show)} aria-pressed={show}>{show ? a.hide : a.show}</button></span>
    {hint && <span id={`${name}-hint`} className="rk-hint">{a.pwHint}</span>}</label>);
}
const Email = ({ a }: { a: AuthText }) => (<label className="rk-field"><span className="rk-field-l">{a.email}</span><input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="you@business.com" className="rk-input" /></label>);
const Err = ({ m }: { m: string }) => (m ? <p role="alert" className="rk-err">{m}</p> : null);
const Ok = ({ m }: { m: string }) => <p role="status" className="rk-ok">✓ {m}</p>;
const GoogleBtn = ({ a, lang }: { a: AuthText; lang: Locale }) => (
  <a className="rk-google" href={`/auth/google?lang=${lang}${nextParam() ? `&next=${encodeURIComponent(nextParam())}` : ""}`}>
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
    {a.google}</a>);
const Or = ({ a }: { a: AuthText }) => <div className="rk-or"><span>{a.or}</span></div>;
const tok = (fd: FormData) => String(fd.get("cf-turnstile-response") || "") || undefined;

export function LoginView({ t, lang }: { t: Dict; lang: Locale }) {
  const a = authText[lang]; const c = useCfg(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [rk, setRk] = useState(0); const [magic, setMagic] = useState("");
  useEffect(() => { const e = new URLSearchParams(location.search).get("error"); if (e) setErr(e === "google_unverified" ? a.errGoogleUnverified : a.errGoogle); }, [a]);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); if (c.siteKey && !tok(fd)) return setErr(t.form.captcha); setBusy(true); setErr("");
    try { const j = await api<{ next: string }>("/api/auth/login", { body: { email: fd.get("email"), password: fd.get("password"), lang, next: nextParam() || undefined, "cf-turnstile-response": tok(fd) } }); location.href = j.next; }
    catch (x: any) { setErr(authErr(a, x) || errMessage(x, t)); setRk((n) => n + 1); setBusy(false); }
  }
  async function sendMagic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); if (c.siteKey && !tok(fd)) return setErr(t.form.captcha); setBusy(true); setErr("");
    try { await api("/api/login", { body: { email: fd.get("email"), lang, "cf-turnstile-response": tok(fd) } }); setMagic(c.noEmail ? t.demo.loginSent : t.login.sent); } catch (x: any) { setErr(errMessage(x, t)); setRk((n) => n + 1); } finally { setBusy(false); }
  }
  return (<Shell title={a.loginTitle} sub={a.loginSub}>
    {c.google && <><GoogleBtn a={a} lang={lang} /><Or a={a} /></>}
    <form onSubmit={login} className="rk-form" noValidate={false}>
      <Email a={a} /><Pw a={a} name="password" label={a.password} auto="current-password" />
      <div className="rk-row"><a className="rk-link" href={`/${lang}/reset`}>{a.forgot}</a></div>
      <Turnstile siteKey={c.siteKey} lang={lang} resetKey={rk} /><Err m={err} />
      <button disabled={busy} className="rk-btn">{a.signIn}</button>
    </form>
    <p className="rk-alt">{a.noAccount} <a className="rk-link" href={`/${lang}/signup${nextParam() ? `?next=${encodeURIComponent(nextParam())}` : ""}`}>{a.createOne}</a></p>
    <details className="rk-magic"><summary>{a.magicTitle}</summary><p className="rk-auth-sub">{a.magicSub}</p>
      {magic ? <Ok m={magic} /> : <form onSubmit={sendMagic} className="rk-form"><Email a={a} /><button disabled={busy} className="rk-btn rk-btn-2">{a.magicSend}</button></form>}
    </details>
  </Shell>);
}

export function SignupView({ t, lang }: { t: Dict; lang: Locale }) {
  const a = authText[lang]; const c = useCfg(); const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [rk, setRk] = useState(0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); if (c.siteKey && !tok(fd)) return setErr(t.form.captcha); setBusy(true); setErr("");
    try { await api("/api/auth/signup", { body: { email: fd.get("email"), password: fd.get("password"), lang, "cf-turnstile-response": tok(fd) } }); setDone(true); }
    catch (x: any) { setErr(authErr(a, x) || errMessage(x, t)); setRk((n) => n + 1); } finally { setBusy(false); }
  }
  return (<Shell title={a.signupTitle} sub={a.signupSub}>
    {done ? <Ok m={c.noEmail ? t.demo.loginSent : a.checkEmail} /> : <>
      {c.google && <><GoogleBtn a={a} lang={lang} /><Or a={a} /></>}
      <form onSubmit={submit} className="rk-form"><Email a={a} /><Pw a={a} name="password" label={a.password} auto="new-password" hint />
        <Turnstile siteKey={c.siteKey} lang={lang} resetKey={rk} /><Err m={err} /><button disabled={busy} className="rk-btn">{a.create}</button></form></>}
    <p className="rk-alt">{a.haveAccount} <a className="rk-link" href={`/${lang}/login`}>{a.signInLink}</a></p>
  </Shell>);
}

const linkParams = () => { const q = new URLSearchParams(location.search); return { a: q.get("a") || "", t: q.get("t") || "" }; };
// Keep the token out of history/Referer once read.
const scrubUrl = () => { try { history.replaceState(null, "", location.pathname); } catch {} };

export function ResetView({ t, lang }: { t: Dict; lang: Locale }) {
  const a = authText[lang]; const c = useCfg(); const [p, setP] = useState<{ a: string; t: string } | null>(null); const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [rk, setRk] = useState(0);
  useEffect(() => { const x = linkParams(); setP(x); if (x.t) scrubUrl(); }, []);
  async function request(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); if (c.siteKey && !tok(fd)) return setErr(t.form.captcha); setBusy(true); setErr("");
    try { await api("/api/auth/reset-request", { body: { email: fd.get("email"), lang, "cf-turnstile-response": tok(fd) } }); setDone(true); } catch (x: any) { setErr(authErr(a, x) || errMessage(x, t)); setRk((n) => n + 1); } finally { setBusy(false); }
  }
  async function setNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); setBusy(true); setErr("");
    try { const j = await api<{ next: string }>("/api/auth/reset", { body: { ...p, password: fd.get("password"), lang } }); await refreshMe(); location.href = j.next; } catch (x: any) { setErr(authErr(a, x) || a.generic); setBusy(false); }
  }
  if (p?.t) return (<Shell title={a.setTitle} sub={a.setSub}><form onSubmit={setNew} className="rk-form"><Pw a={a} name="password" label={a.newPassword} auto="new-password" hint /><Err m={err} /><button disabled={busy} className="rk-btn">{a.setSave}</button></form></Shell>);
  return (<Shell title={a.resetTitle} sub={a.resetSub}>{done ? <Ok m={c.noEmail ? t.demo.loginSent : a.checkEmail} /> : <form onSubmit={request} className="rk-form"><Email a={a} /><Turnstile siteKey={c.siteKey} lang={lang} resetKey={rk} /><Err m={err} /><button disabled={busy} className="rk-btn">{a.resetSend}</button></form>}
    <p className="rk-alt"><a className="rk-link" href={`/${lang}/login`}>{a.signInLink}</a></p></Shell>);
}

// The emailed link opens this page; confirming is an explicit POST so mail scanners that prefetch links can't burn the token.
export function VerifyView({ lang }: { t: Dict; lang: Locale }) {
  const a = authText[lang]; const [p, setP] = useState<{ a: string; t: string } | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const x = linkParams(); setP(x); if (x.t) scrubUrl(); }, []);
  async function go() { setBusy(true); setErr(""); try { const j = await api<{ next: string }>("/api/auth/verify", { body: { ...p, lang } }); await refreshMe(); location.href = j.next; } catch (x: any) { setErr(authErr(a, x) || a.generic); setBusy(false); } }
  return (<Shell title={a.verifyTitle}>{p && !p.t ? <Err m={a.linkInvalid} /> : <><Err m={err} /><button disabled={busy || !p} onClick={go} className="rk-btn">{busy ? a.verifying : a.verifyBtn}</button></>}</Shell>);
}

export function AccountView({ lang }: { t: Dict; lang: Locale }) {
  const a = authText[lang]; const [me, setMe] = useState<Me | null>(null); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { getMe().then(setMe); }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f); setBusy(true); setErr(""); setOk("");
    try { await api("/api/auth/password", { body: { current: fd.get("current") || undefined, password: fd.get("password") } }); f.reset(); setMe(await refreshMe()); setOk(a.saved); } catch (x: any) { setErr(authErr(a, x) || a.generic); } finally { setBusy(false); }
  }
  async function out() { await api("/api/auth/logout", { body: {} }).catch(() => {}); await refreshMe(); location.href = `/${lang}`; }
  if (!me) return <Shell title={a.accountTitle}><p className="rk-auth-sub">…</p></Shell>;
  if (!me.signedIn || !me.account) return <Shell title={a.accountTitle} sub={a.notSignedIn}><a className="rk-btn" href={`/${lang}/login?next=${encodeURIComponent(`/${lang}/account`)}`}>{a.signIn}</a></Shell>;
  const has = me.account.hasPassword;
  return (<Shell title={a.accountTitle} sub={`${a.signedInAs} ${me.account.email}`}>
    <a className="rk-btn rk-btn-2" href={`/${lang}/dashboard`}>{a.dashboard}</a>
    {me.account.googleLinked && <p className="rk-auth-sub">✓ {a.googleLinked}</p>}
    <h2 className="rk-auth-h2">{has ? a.changePwTitle : a.setPwTitle}</h2>{!has && <p className="rk-auth-sub">{a.setPwSub}</p>}
    <form onSubmit={save} className="rk-form">{has && <Pw a={a} name="current" label={a.currentPassword} auto="current-password" />}<Pw a={a} name="password" label={a.newPassword} auto="new-password" hint />
      <Err m={err} />{ok && <Ok m={ok} />}<button disabled={busy} className="rk-btn">{a.setSave}</button></form>
    <button onClick={out} className="rk-btn rk-btn-ghost">{a.signOut}</button>
  </Shell>);
}
