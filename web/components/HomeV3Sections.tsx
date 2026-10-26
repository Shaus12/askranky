import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { Home3 } from "@/lib/home-v3";
import ScrollFx from "@/components/ScrollFx";

const Arrow = () => <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>;

/** "Built on what AI actually answers": three-card bento (question set ticker, mention-rate chart, business profile). Example data only. */
export function ContextBento({ h, lang }: { h: Home3; lang: Locale }) {
  const c = h.ctx; const base = `/${lang}`;
  const bars: [string, number, number][] = [["ChatGPT", 40, 58], ["Gemini", 30, 51]];
  return (
    <ScrollFx as="section" className="hm-sec" aria-labelledby="v3-ctx-t"><div className="hm-wrap hm-pad">
      <h2 id="v3-ctx-t" className="hm-h2" data-rise>{h.ctxT}</h2>
      <p className="hm-pl" data-rise>{h.ctxS}</p>
      <div className="v3-bento">
        <article className="v3-bc v3-bc-q" data-rise>
          <div className="v3-viz v3-ticker-w" aria-hidden="true"><ul data-ticker>{[...c.qs, ...c.qs].map((q, i) => <li key={i}><span className="v3-qi">⌕</span>{q}<b>ChatGPT · Gemini</b></li>)}</ul></div>
          <h3 className="v3-h4">{c.qT}</h3><p className="v3-p">{c.qB}</p><Link className="v3-link" href={`${base}/scan`}>{c.qLink} <Arrow /></Link>
        </article>
        <article className="v3-bc" data-rise>
          <div className="v3-viz" role="img" aria-label={`${c.vHead}: ${bars.map(([e, y, a]) => `${e} ${c.you} ${y}%, ${c.avg} ${a}%`).join("; ")}`}>
            <span className="v3-ex">{h.cc.ex}</span><div className="v3-vh">{c.vHead}</div>
            {bars.map(([e, y, a]) => (
              <div key={e} className="v3-vrow" dir="ltr"><span className="v3-vl">{e}</span>
                <div className="v3-vbars"><div className="v3-vb"><i data-grow className={`v3-you w${y}`} /></div><div className="v3-vb"><i data-grow className={`v3-avg w${a}`} /></div></div>
                <span className="v3-vn">{y}%<small>{a}%</small></span></div>))}
            <div className="v3-leg"><span><i className="v3-you" />{c.you}</span><span><i className="v3-avg" />{c.avg}</span></div>
          </div>
          <h3 className="v3-h4">{c.vT}</h3><p className="v3-p">{c.vB}</p><Link className="v3-link" href={`${base}/report`}>{c.vLink} <Arrow /></Link>
        </article>
        <article className="v3-bc" data-rise>
          <div className="v3-viz"><span className="v3-ex">{h.cc.ex}</span>
            <dl className="v3-prof">{c.prof.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
          <h3 className="v3-h4">{c.pT}</h3><p className="v3-p">{c.pB}</p><Link className="v3-link" href={`${base}/scan`}>{c.pLink} <Arrow /></Link>
        </article>
      </div>
    </div></ScrollFx>
  );
}

const FEAT_HREF: Record<string, string> = { dashboard: "/login", report: "/report", pricing: "#pricing", scan: "/scan" };
const ICONS = ["M3 17l5-5 4 4 8-8", "M5 20V10M12 20V4M19 20v-7", "M4 6h16M4 12h10M4 18h7", "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18", "M12 4v12m0 0l-4-4m4 4l4-4M4 20h16", "M4 5h7M7.5 5v2c0 4-2 7-4 8M5 11c2 2 5 3 6 3M13 20l4-9 4 9M14.5 17h5"];

/** "Every scan makes the next one smarter": six real features, each linking to where it lives. */
export function FeatureGrid({ h, lang }: { h: Home3; lang: Locale }) {
  return (
    <ScrollFx as="section" className="hm-sec" aria-labelledby="v3-feat-t"><div className="hm-wrap hm-pad">
      <h2 id="v3-feat-t" className="hm-h2" data-rise>{h.featT}</h2>
      <p className="hm-pl" data-rise>{h.featS}</p>
      <div className="v3-feats">
        {h.feats.map(([t, b, to], i) => (
          <Link key={t} href={`/${lang}${FEAT_HREF[to]}`} className="v3-feat" data-rise>
            <svg viewBox="0 0 24 24" className="v3-ic" aria-hidden="true"><path d={ICONS[i]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h3>{t}</h3><p>{b}</p><span className="v3-fa" aria-hidden="true"><Arrow /></span>
          </Link>))}
      </div>
    </div></ScrollFx>
  );
}

/** Dashboard preview ("command center"): illustration with example numbers — counters, per-engine line chart, competitor table. */
export function CommandCenter({ h, lang }: { h: Home3; lang: Locale }) {
  const c = h.cc; const he = lang === "he";
  const cols = [22, 28, 26, 33, 31, 38, 41, 39, 46, 52];
  const comps: [string, number, string][] = he ? [["מרפאה א׳", 41, "▲"], ["מרפאה ב׳", 33, "▼"], ["שן לדוגמה (אתה)", 29, "▲"], ["מרפאה ג׳", 18, "–"]] : [["Clinic A", 41, "▲"], ["Clinic B", 33, "▼"], ["Sample Dental (you)", 29, "▲"], ["Clinic C", 18, "–"]];
  return (
    <ScrollFx as="section" className="hm-sec" aria-labelledby="v3-cc-t"><div className="hm-wrap hm-pad">
      <p className="hm-mono" data-rise>{h.ccEy}</p>
      <div className="v3-cchead"><h2 id="v3-cc-t" className="hm-h2" data-rise>{h.ccT}</h2><Link className="hm-btn-d hm-btn-lg" href={`/${lang}/login`} data-rise>{h.ccLink}</Link></div>
      <p className="hm-pl" data-rise>{h.ccS}</p>
      <div className="v3-cc" data-rise>
        <span className="v3-ex">{c.ex}</span>
        <div className="v3-kpis">
          <div className="v3-kpi"><span>{c.score}</span><b dir="ltr" data-count="52">52</b><small dir="ltr">▲ 30</small></div>
          <div className="v3-kpi"><span>{c.checks}</span><b dir="ltr" data-count="1240">1,240</b></div>
          <div className="v3-kpi"><span>{c.named}</span><b dir="ltr" data-count="386">386</b></div>
        </div>
        <div className="v3-ccgrid">
          <div className="v3-ccp"><div className="v3-vh">{c.trend}</div>
            <svg viewBox="0 0 400 160" className="v3-line" role="img" aria-label={`${c.trend}: ChatGPT 18 → 52, Gemini 12 → 41`}>
              <g stroke="#1f1f22">{[30, 70, 110, 150].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} />)}</g>
              <path data-draw d="M0 140 L44 128 L88 120 L133 108 L177 112 L222 90 L266 80 L311 72 L355 58 L400 44" stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path data-draw d="M0 148 L44 144 L88 136 L133 132 L177 122 L222 118 L266 104 L311 100 L355 92 L400 80" stroke="#93c5fd" strokeWidth="2" strokeDasharray="6 4" fill="none" strokeLinecap="round" />
            </svg>
            <div className="v3-leg" dir="ltr"><span><i className="v3-you" />ChatGPT</span><span><i className="v3-avg2" />Gemini</span></div>
            <div className="v3-cols" aria-hidden="true">{cols.map((v, i) => <i key={i} data-growy className={`h${v}`} />)}</div>
          </div>
          <div className="v3-ccp"><div className="v3-vh">{c.lead}</div>
            <table className="v3-tbl"><thead><tr><th scope="col">{c.biz}</th><th scope="col">{c.men}</th><th scope="col">{c.tr}</th></tr></thead>
              <tbody>{comps.map(([n, m, t]) => <tr key={n} className={n.includes("(") ? "you" : undefined}><td>{n}</td><td dir="ltr">{m}</td><td className={t === "▲" ? "up" : t === "▼" ? "down" : ""}>{t}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </div></ScrollFx>
  );
}
