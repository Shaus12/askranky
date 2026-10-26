import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { homeFor } from "@/lib/home";
import EngineRotator from "@/components/EngineRotator";
import "./home.css";

/** Stage-2 hero (Profound-inspired): chip → headline with rotating live engines → lede → CTAs → app-window illustration.
 *  Server-rendered text. No 100svh: height follows content, so the sticky header never pushes the CTA below the fold. */
export default function Hero({ t, lang }: { t: Dict; lang: Locale }) {
  const h = t.hero; const m = homeFor(lang); const base = `/${lang}`;
  return (
    <div className="vx-hero hm-hero text-white">
      <section className="hm-hero-in">
        <a href="#data" className="hm-chip hm-in">{m.chip} <span aria-hidden="true" className="rtl:rotate-180 inline-block">→</span></a>
        <h1 className="hm-h1 hm-in hm-d2">{m.h1a} <EngineRotator names={["ChatGPT", "Gemini"]} />.<br />{m.h1b}</h1>
        <p className="hm-lede hm-in hm-d3">{m.lede}</p>
        <div className="hm-acts hm-in hm-d4">
          <Link href={`${base}/scan`} className="btn-cta hm-btn-lg" data-cta="hero">{h.cta} <span aria-hidden="true" className="rtl:rotate-180">→</span></Link>
          <a href="#how" className="hm-btn-d hm-btn-lg">{m.how}</a>
        </div>
        <p className="hm-xs hm-in hm-d4 hm-note">{h.note}</p>

        <figure className="hm-win hm-in hm-d4" aria-labelledby="hm-cap">
          <div className="hm-tb"><span className="hm-dots" aria-hidden="true"><i /><i /><i /></span><span aria-hidden="true">{m.win}</span><span className="hm-illus">{m.illus}</span></div>
          <div className="hm-app" aria-hidden="true">
            <aside className="hm-side">
              <div className="hm-ws">◧ {m.biz}</div>
              <div className="hm-seg"><span className="on">{m.tabs[0]}</span><span>{m.tabs[1]}</span></div>
              {m.side.map((s, i) => <span key={s} className={i === 0 ? "hm-si on" : "hm-si"}>{s}</span>)}
              <div className="hm-lbl">{m.engines}</div><span className="hm-si"><b className="hm-b3">●</b> ChatGPT</span><span className="hm-si"><b className="hm-b3">●</b> Gemini</span>
              <div className="hm-lbl">{m.recent}</div>{m.recentQ.map((q) => <span key={q} className="hm-si">{q}</span>)}
            </aside>
            <div className="hm-chat">
              <div className="hm-bub">{m.q}</div>
              <div className="hm-xs">{m.meta}</div>
              <div className="hm-ans">{m.a1}<mark>{m.ca}</mark>{m.a2}<small className="hm-cite">{m.cite1}</small>{m.a3}<mark>{m.cb}</mark>{m.a4}<small className="hm-cite">{m.cite2}</small>{m.a5}<mark>{m.cc}</mark>{m.a6}</div>
              <div className="hm-card"><div className="hm-row0"><span className="hm-w">{m.miss}</span><span className="hm-chipb">{m.fix}</span></div><div className="hm-xs hm-mt6">{m.fixT}</div></div>
              <div className="hm-inp"><span>{m.ask}</span><span>↑</span></div>
            </div>
            <div className="hm-panel">
              <div className="hm-card"><span className="hm-ex">{m.ex}</span><div className="hm-xs">{m.score}</div>
                <div className="hm-score"><svg className="hm-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="33" stroke="#242426" strokeWidth="7" fill="none" /><circle cx="40" cy="40" r="33" stroke="#3b82f6" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="207" strokeDashoffset="135" transform="rotate(-90 40 40)" /><text x="40" y="46" textAnchor="middle" fill="#fff" fontSize="20" fontFamily="Inter">35</text></svg>
                  <div className="hm-bars">ChatGPT<div className="hm-bar"><i className="w40" /></div>Gemini<div className="hm-bar"><i className="w28" /></div></div></div></div>
              <div className="hm-card"><span className="hm-ex">{m.ex}</span><div className="hm-xs">{m.trend}</div>
                <svg viewBox="0 0 280 90" className="hm-trend"><g stroke="#1f1f22"><line x1="0" y1="22" x2="280" y2="22" /><line x1="0" y1="45" x2="280" y2="45" /><line x1="0" y1="68" x2="280" y2="68" /></g><path className="hm-ln" d="M280 75 L235 70 L190 62 L145 64 L100 48 L55 40 L10 30" stroke="#3b82f6" strokeWidth="2" fill="none" /><path d="M280 80 L235 78 L190 72 L145 70 L100 66 L55 58 L10 52" stroke="#636366" strokeWidth="1.5" fill="none" strokeDasharray="3 3" /></svg>
                <div className="hm-xs hm-legend"><span><b className="hm-b3">━</b> {m.you}</span><span>┄ {m.avg}</span></div></div>
              <div className="hm-card"><span className="hm-ex">{m.ex}</span><div className="hm-xs">{m.picked}</div>
                <div className="hm-r"><span>{lang === "he" ? "מרפאה א׳" : "Clinic A"}</span><span className="hm-chipn">7/20</span></div><div className="hm-r"><span>{lang === "he" ? "מרפאה ב׳" : "Clinic B"}</span><span className="hm-chipn">5/20</span></div><div className="hm-r"><span className="hm-b3">{m.youRow}</span><span className="hm-chipb">3/20</span></div></div>
            </div>
          </div>
          <div className="hm-fade" aria-hidden="true" />
          <figcaption id="hm-cap" className="hm-caption">{m.caption}</figcaption>
        </figure>
      </section>
    </div>
  );
}
