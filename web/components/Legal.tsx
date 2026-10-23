import type { Dict, Locale } from "@/lib/i18n";
import { LEGAL_DOCS, LEGAL_META } from "@/lib/legal";
// Legal index: plain links (full page loads, so the server fills in each document) to every document.
export default function Legal({ lang }: { t: Dict; lang: Locale }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <h1 className="font-head text-3xl font-bold text-white">{lang === "he" ? "מסמכים משפטיים" : "Legal"}</h1>
      <ul className="mt-6 grid gap-3">
        {LEGAL_DOCS.map((d) => (
          <li key={d} className="card p-5"><a className="vx-link text-lg font-semibold text-white" href={`/${lang}/legal/${d}`}>{LEGAL_META[d][lang].title}</a><p className="mt-1 text-sm text-slate-300">{LEGAL_META[d][lang].desc}</p></li>
        ))}
      </ul>
    </main>
  );
}
