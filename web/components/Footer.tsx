import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
export default function Footer({ t, lang = "en" }: { t: Dict; lang?: Locale }) {
  const base = `/${lang}`;
  const L = (doc: string, label: string) => <a href={`${base}/legal/${doc}`} className="vx-link hover:text-white">{label}</a>;
  return (
    <footer className="relative bg-[var(--navy)] px-5 pb-10 pt-14 text-sm text-slate-400">
      <span className="hairline absolute inset-x-0 top-0 block" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
        <Link href={base} className="vx-link font-head text-2xl font-bold tracking-tight text-white">{t.brand}</Link>
        <nav aria-label="footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-slate-300">
          <Link className="vx-link hover:text-white" href={`${base}#how`}>{t.nav.how}</Link><Link className="vx-link hover:text-white" href={`${base}#sample`}>{t.nav.sample}</Link>
          <Link className="vx-link hover:text-white" href={`${base}#pricing`}>{t.nav.pricing}</Link><Link className="vx-link hover:text-white" href={`${base}#faq`}>{t.nav.faq}</Link>
          <Link className="vx-link hover:text-white" href={`${base}/login`}>{t.login.nav}</Link>
        </nav>
        <span className="hairline block w-full max-w-md" />
        <p className="max-w-xl text-slate-400">{t.footer.disclaimer}</p>
        <p className="max-w-2xl text-xs text-slate-500" data-seller>{t.footer.seller}</p>
        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">© 2026 {t.brand} · <span dir="ltr">askranky.com</span> · {L("terms", t.footer.terms)} · {L("privacy", t.footer.privacy)} · {L("refunds", t.footer.refunds)} · {L("disclaimer", t.footer.aiDisclaimer)} · {L("accessibility", t.footer.accessibility)}</p>
      </div>
    </footer>
  );
}
