import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { homeFor } from "@/lib/home";
import EngineRotator from "@/components/EngineRotator";
import AgentDemo from "@/components/AgentDemo";
import { home3For } from "@/lib/home-v3";
import "./home.css";
import "./home-v3.css";

/** Stage-2 hero (Profound-inspired): chip → headline with rotating live engines → lede → CTAs → animated agent demo (AgentDemo).
 *  Server-rendered text. No 100svh: height follows content, so the sticky header never pushes the CTA below the fold. */
// Live engines first; the rest rotate with a "soon" tag until Ranky measures them (see test/blog.js engine-honesty rule).
const ENGINES = [{ name: "ChatGPT" }, { name: "Gemini" }, { name: "Perplexity", soon: true }, { name: "Claude", soon: true }, { name: "Copilot", soon: true }];

export default function Hero({ t, lang }: { t: Dict; lang: Locale }) {
  const h = t.hero; const m = homeFor(lang); const base = `/${lang}`;
  return (
    <div className="vx-hero hm-hero text-white">
      <section className="hm-hero-in">
        <a href="#data" className="hm-chip hm-in">{m.chip} <span aria-hidden="true" className="rtl:rotate-180 inline-block">→</span></a>
        <h1 className="hm-h1 hm-in hm-d2">{m.h1a} <EngineRotator names={ENGINES} soon={lang === "he" ? "בקרוב" : "soon"} />.<br />{m.h1b}</h1>
        <p className="hm-lede hm-in hm-d3">{m.lede}</p>
        <div className="hm-acts hm-in hm-d4">
          <Link href={`${base}/scan`} className="btn-cta hm-btn-lg" data-cta="hero">{h.cta} <span aria-hidden="true" className="rtl:rotate-180">→</span></Link>
          <a href="#how" className="hm-btn-d hm-btn-lg">{m.how}</a>
        </div>
        <p className="hm-xs hm-in hm-d4 hm-note">{h.note}</p>
        <p className="hm-soon hm-in hm-d4" data-engines-soon><span>{lang === "he" ? "בקרוב:" : "Coming soon:"}</span> <span dir="ltr">Perplexity · Copilot · Claude</span></p>

        <div className="hm-in hm-d4"><AgentDemo d={home3For(lang).demo} /></div>
      </section>
    </div>
  );
}
