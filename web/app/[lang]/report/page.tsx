import { dict, isLocale, type Locale } from "@/lib/i18n";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ReportView from "@/components/ReportView";

export default async function Report({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang);
  return (<><div className="hero-bg text-white"><Nav t={t} lang={lang} path="/report" /></div><ReportView t={t} lang={lang} /><Footer t={t} lang={lang} /></>);
}
