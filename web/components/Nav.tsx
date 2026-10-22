import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";

/** Compact sticky version of the Hero v2 masthead: sign-in · centered wordmark · language, then a hairline and the same 3 nav links + free-scan CTA. */
export default function Nav({ t, lang, path = "" }: { t: Dict; lang: Locale; path?: string; dark?: boolean }) {
  const other = lang === "en" ? "he" : "en"; const base = `/${lang}`;
  return (
    <header className="vx-mast text-white">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
        <div className="flex items-center gap-5 text-sm">
          <Link href={`${base}/login`} className="vx-link opacity-75">{t.login.nav}</Link>
          <nav aria-label="primary" className="hidden gap-5 text-slate-300 md:flex">
            <Link className="vx-link" href={`${base}#how`}>{t.nav.how}</Link><Link className="vx-link" href={`${base}#sample`}>{t.nav.sample}</Link><Link className="vx-link" href={`${base}#pricing`}>{t.nav.pricing}</Link>
          </nav>
        </div>
        <Link href={base} className="vx-link font-head text-xl font-bold tracking-tight">{t.brand}</Link>
        <div className="flex items-center justify-end gap-4 text-sm">
          <Link href={`/${other}${path}`} className="vx-link opacity-75">{other === "he" ? "עברית" : "English"}</Link>
          <Link href={`${base}/scan`} className="btn-cta !px-4 !py-1.5 text-sm">{t.nav.cta}</Link>
        </div>
      </div>
    </header>
  );
}
