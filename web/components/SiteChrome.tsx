"use client";
import { useEffect } from "react";
import "./site-chrome.css";
import type { Locale } from "@/lib/i18n";
import A11yWidget from "./A11yWidget";
import ConsentBanner from "./ConsentBanner";
import { applyA11y, loadA11y } from "@/lib/a11y";
// Mounted once from app/[lang]/layout.tsx, as the FIRST child of <body>: cookie notice + accessibility menu (both position: fixed).
// Being first matters: this effect runs before the page's own effects, so the saved accessibility classes (for example "Stop animations")
// are already on <html> when GSAP / Lenis / the canvas decide whether to animate.
export default function SiteChrome({ lang }: { lang: Locale }) {
  useEffect(() => { applyA11y(loadA11y()); }, []);
  return <><ConsentBanner lang={lang} /><A11yWidget lang={lang} /></>;
}
