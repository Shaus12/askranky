"use client";
import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { freeText } from "@/lib/i18n-free";
// Calm notice shown when POST /api/scan answers 409 free_scan_used: the email already used its one free scan for another business.
// While pre-launch the upgrade action leads to the waitlist (checkout page); otherwise to checkout. Never starts a payment itself.
export default function FreeLimitNotice({ lang, reportId, prelaunch, onOther }: { lang: Locale; reportId?: string; prelaunch: boolean; onOther: () => void }) {
  const f = freeText[lang]; const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  return (
    <main className="mx-auto max-w-xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <section role="alert" aria-live="assertive" data-free-limit className="card p-6 text-start md:p-8">
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full border border-sky-300/30 bg-sky-300/10 text-xl text-sky-100">1</span>
        <h1 ref={head} tabIndex={-1} className="font-head mt-4 text-2xl font-bold outline-none md:text-3xl">{f.title}</h1>
        <p className="mt-3 text-slate-300">{f.body}</p>
        {reportId && <a data-free-report href={`/${lang}/r/${encodeURIComponent(reportId)}`} className="btn-cta mt-6 w-full">{f.view} <span aria-hidden className="rtl:rotate-180">→</span></a>}
        <div className="mt-8 border-t border-white/10 pt-6">
          <h2 className="font-head text-lg font-semibold">{f.upgradeTitle}</h2>
          <p className="mt-2 text-sm text-slate-400" data-free-upgrade-note>{prelaunch ? f.upgradeSoon : f.upgradeLive}</p>
          <div className="mt-4 flex flex-col items-stretch gap-3">
            <a data-free-upgrade href={`/${lang}/checkout?plan=starter`} className="btn-ghost min-h-11 w-full text-center">{prelaunch ? f.notify : f.upgrade}</a>
            <button type="button" onClick={onOther} className="min-h-11 self-center rounded-full px-4 text-sm text-slate-300 underline underline-offset-4 hover:text-white">{f.other}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
