import "../globals.css";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { dir, isLocale, locales } from "@/lib/i18n";
import SmoothScroll from "@/components/SmoothScroll";
import { metaFor } from "@/lib/seo";
import DemoBanner from "@/components/DemoBanner";

export const generateStaticParams = () => locales.map((lang) => ({ lang }));
export const generateMetadata = metaFor("");
export const viewport: Viewport = { themeColor: "#01061a", width: "device-width", initialScale: 1 };

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} dir={dir(lang)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Rubik:wght@500;700;800&family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><DemoBanner lang={lang} /><SmoothScroll />{children}</body>
    </html>
  );
}
