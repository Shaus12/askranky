import type { Dict, Locale } from "@/lib/i18n";
export default function Footer({ t, lang = "en" }: { t: Dict; lang?: Locale }) {
  const L = (doc: string, label: string) => <a href={`/${lang}/legal?doc=${doc}`} className="hover:text-white">{label}</a>;
  return (
    <footer className="bg-ink px-4 py-10 text-sm text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:justify-between">
        <span>© 2026 {t.brand} · <span dir="ltr">askranky.com</span> · {L("terms", t.footer.terms)} · {L("privacy", t.footer.privacy)} · {L("refunds", t.footer.refunds)}</span>
        <span className="max-w-md">{t.footer.disclaimer}</span>
      </div>
    </footer>
  );
}
