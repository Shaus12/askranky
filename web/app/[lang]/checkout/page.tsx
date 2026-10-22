import { dict, isLocale, type Locale } from "@/lib/i18n";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Checkout from "@/components/Checkout";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang);
  return (<><div className="hero-bg min-h-screen text-white"><Nav t={t} lang={lang} path="/checkout" /><Checkout t={t} lang={lang} /></div><Footer t={t} lang={lang} /></>);
}
