"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
// Language switcher. Public pages carry no language cookie (the URL decides, so they stay cacheable); the ranky_lang cookie is
// written only here, when the visitor explicitly switches, so "/" and short links can remember the choice.
// `hard` = plain <a> (full page load) for pages the server fills in per request (legal docs).
export default function LangLink({ to, hrefTo, hard, className, children }: { to: Locale; hrefTo: string; hard?: boolean; className?: string; children: ReactNode }) {
  const remember = () => { document.cookie = `ranky_lang=${to}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`; };
  return hard ? <a href={hrefTo} hrefLang={to} className={className} onClick={remember}>{children}</a> : <Link href={hrefTo} hrefLang={to} className={className} onClick={remember}>{children}</Link>;
}
