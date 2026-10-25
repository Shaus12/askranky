"use client";
import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { paidLoginText } from "@/lib/i18n-free";
// Calm notice for POST /api/scan 401 login_required. Nothing was created, scanned or charged. After the magic link, the dashboard of a
// paid account shows a "Back to the scan form" link (no extra storage), and the scan then carries the tab's session.
export default function LoginRequiredNotice({ lang, loginUrl, onOther }: { lang: Locale; loginUrl?: string; onOther: () => void }) {
  const f = paidLoginText[lang]; const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  const href = loginUrl && /^\/(he|en)\/login$/.test(loginUrl) ? loginUrl : `/${lang}/login`;
  return (
    <main className="mx-auto max-w-xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <section role="alert" aria-live="assertive" data-login-required className="card p-6 text-start md:p-8">
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full border border-sky-300/30 bg-sky-300/10 text-xl text-sky-100">→</span>
        <h1 ref={head} tabIndex={-1} className="font-head mt-4 text-2xl font-bold outline-none md:text-3xl">{f.title}</h1>
        <p className="mt-3 text-slate-300">{f.body}</p>
        <a data-login-link href={href} className="btn-cta mt-6 w-full">{f.login} <span aria-hidden className="rtl:rotate-180">→</span></a>
        <p className="mt-3 text-sm text-slate-400">{f.back}</p>
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onOther} className="min-h-11 rounded-full px-4 text-sm text-slate-300 underline underline-offset-4 hover:text-white">{f.other}</button>
        </div>
      </section>
    </main>
  );
}
