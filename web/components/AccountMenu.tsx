"use client";
// Nav sign-in link, or (signed in via session) an account menu: dashboard, account / set password, sign out.
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api, getMe, refreshMe, type Me } from "@/lib/api";
import { authText } from "@/lib/i18n-auth";
import "./auth.css";
export default function AccountMenu({ lang, label, mobile }: { lang: Locale; label: string; mobile?: boolean }) {
  const a = authText[lang]; const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { getMe().then(setMe); }, []);
  async function out() { await api("/api/auth/logout", { body: {} }).catch(() => {}); await refreshMe(); location.href = `/${lang}`; }
  if (!me?.signedIn) return <a href={`/${lang}/login`} className={mobile ? undefined : "rk-navlink rk-desk"}>{label}</a>;
  if (mobile) return (<><a href={`/${lang}/dashboard`}>{a.dashboard}</a><a href={`/${lang}/account`}>{a.account}</a><button type="button" className="rk-mobile-out" onClick={out}>{a.signOut}</button></>);
  return (<details data-rk-menu className="rk-mi rk-desk rk-acct"><summary aria-label={a.account}><span className="rk-avatar" aria-hidden="true">{(me.account?.email || "?").slice(0, 1).toUpperCase()}</span><span>{a.account}</span></summary>
    <div className="rk-acct-menu"><p className="rk-acct-who" dir="ltr">{me.account?.email}</p>
      <a className="rk-mlink" href={`/${lang}/dashboard`}><b>{a.dashboard}</b></a>
      <a className="rk-mlink" href={`/${lang}/account`}><b>{me.account?.hasPassword ? a.account : a.setPwTitle}</b></a>
      <button type="button" className="rk-mlink rk-acct-out" onClick={out}><b>{a.signOut}</b></button></div></details>);
}
