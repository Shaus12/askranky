import { dict, isLocale, type Locale } from "@/lib/i18n";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Login from "@/components/Login";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang);
  return (<><div className="hero-bg min-h-screen text-white"><Nav t={t} lang={lang} path="/login" /><Login t={t} lang={lang} /></div><Footer t={t} lang={lang} /></>);
}
