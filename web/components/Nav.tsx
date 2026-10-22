import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";

export default function Nav({ t, lang, path = "", dark = true }: { t: Dict; lang: Locale; path?: string; dark?: boolean }) {
  const other = lang === "en" ? "he" : "en";
  const base = `/${lang}`;
  return (
    <header className={`sticky top-0 z-40 backdrop-blur ${dark ? "bg-ink/70 text-white border-b border-white/10" : "bg-white/80 text-slate-900 border-b border-slate-200"}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={base} className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-glow text-white">◆</span>{t.brand}
        </Link>
        <div className="hidden items-center gap-6 text-sm opacity-80 md:flex">
          <a href={`${base}#how`}>{t.nav.how}</a><a href={`${base}#sample`}>{t.nav.sample}</a><a href={`${base}#pricing`}>{t.nav.pricing}</a><a href={`${base}#faq`}>{t.nav.faq}</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`${base}/login`} className="hidden text-sm opacity-80 sm:inline">{t.login.nav}</Link>
          <Link href={`/${other}${path}`} className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold opacity-80">{other === "he" ? "עברית" : "English"}</Link>
          <Link href={`${base}/scan`} className="btn-cta !px-4 !py-2 text-sm">{t.nav.cta}</Link>
        </div>
      </nav>
    </header>
  );
}
