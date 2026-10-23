import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { dict, isLocale, locales, type Locale } from "@/lib/i18n";
import { LEGAL_DOCS, isLegalDoc } from "@/lib/legal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LegalDocView from "@/components/LegalDoc";

export const dynamicParams = false;
export const generateStaticParams = () => locales.flatMap((lang) => LEGAL_DOCS.map((doc) => ({ lang, doc })));
export async function generateMetadata({ params }: { params: Promise<{ lang: string; doc: string }> }) {
  const { lang, doc } = await params; if (!isLegalDoc(doc)) return {}; return pageMeta(lang === "he" ? "he" : "en", `/legal/${doc}`);
}
export default async function Page({ params }: { params: Promise<{ lang: string; doc: string }> }) {
  const { lang: l, doc } = await params; if (!isLocale(l) || !isLegalDoc(doc)) notFound();
  const lang = l as Locale; const t = dict(lang);
  return (<><div className="vx-page"><Nav t={t} lang={lang} path={`/legal/${doc}`} /><LegalDocView t={t} lang={lang} doc={doc} /></div><Footer t={t} lang={lang} /></>);
}
