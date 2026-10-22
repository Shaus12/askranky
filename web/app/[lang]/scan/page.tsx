import { dict, isLocale, type Locale } from "@/lib/i18n";
import Nav from "@/components/Nav";
import ScanProgress from "@/components/ScanProgress";

export default async function Scan({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang);
  return (
    <div className="vx-page">
      <Nav t={t} lang={lang} path="/scan" />
      <ScanProgress t={t} lang={lang} />
    </div>
  );
}
