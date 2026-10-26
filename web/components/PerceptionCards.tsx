import type { Locale } from "@/lib/i18n";
import { perceptionFor, type Fact, type Facts, type Sentiment, type Tone } from "@/lib/perception";
import "./perception.css";

const ENG: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
const ORDER: Tone[] = ["positive", "neutral", "mixed", "negative"];
// One card per kind of wrong fact (e.g. all the wrong cities together), most frequent first.
const groups = (fs: Fact[]) => [...fs.reduce((m, f) => { const g = m.get(f.type) || { type: f.type, expected: f.expected, count: 0, engines: [] as string[], items: [] as Fact[] };
  g.count += f.count; g.items.push(f); for (const e of f.engines) if (!g.engines.includes(e)) g.engines.push(e); return m.set(f.type, g); }, new Map<Fact["type"], { type: Fact["type"]; expected?: string; count: number; engines: string[]; items: Fact[] }>()).values()];

/** Sentiment ("How AI talks about you") + fact check ("What AI gets wrong") for one scan. Used by the report and the dashboard.
 *  Every label shows the exact quote and the cue words behind it. Renders nothing for scans made before these features existed. */
export default function PerceptionCards({ sentiment, facts, lang, sample = false, id = "pc" }: { sentiment?: Sentiment | null; facts?: Facts | null; lang: Locale; sample?: boolean; id?: string }) {
  if (!sentiment && !facts) return null;
  const t = perceptionFor(lang); const total = sentiment ? ORDER.reduce((s, k) => s + sentiment.counts[k], 0) : 0;
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);
  return (
    <div className="pc" data-perception>
      <section className="card pc-card" aria-labelledby={`${id}-sent`} data-sentiment>
        {sample && <span className="pc-ex">{t.sample}</span>}
        <h3 id={`${id}-sent`} className="pc-h">{t.sentT}</h3>
        {sentiment && total ? (<>
          <p className="pc-sub">{t.sentS(sentiment.answers)}</p>
          <div className="pc-net"><b dir="ltr" className={sentiment.net > 0 ? "pc-pos" : sentiment.net < 0 ? "pc-neg" : ""}>{sentiment.net > 0 ? "+" : ""}{sentiment.net}</b><span title={t.netHelp}>{t.net}</span></div>
          <div className="pc-bar" role="img" aria-label={ORDER.map((k) => `${t.tones[k]} ${sentiment.counts[k]}`).join(", ")}>
            {ORDER.map((k) => sentiment.counts[k] > 0 && <i key={k} className={`pc-${k} pc-w${pct(sentiment.counts[k])}`} />)}
          </div>
          <ul className="pc-legend">{ORDER.map((k) => <li key={k}><i className={`pc-${k}`} aria-hidden="true" />{t.tones[k]} <b dir="ltr">{sentiment.counts[k]}</b></li>)}</ul>
          <ul className="pc-quotes">{sentiment.examples.map((e, i) => (
            <li key={i}><span className={`pc-chip pc-${e.tone}`}>{t.tones[e.tone]}</span>
              <blockquote>“{e.text}”</blockquote>
              <p className="pc-meta"><span dir="ltr">{ENG[e.engine] || e.engine}</span> · {e.question}{e.cues.length > 0 && <> · {t.because} <b>{e.cues.join(", ")}</b></>}</p></li>))}</ul>
        </>) : <p className="pc-sub">{t.none}</p>}
      </section>

      <section className="card pc-card" aria-labelledby={`${id}-fact`} data-factcheck>
        {sample && <span className="pc-ex">{t.sample}</span>}
        <h3 id={`${id}-fact`} className="pc-h">{t.factT}</h3>
        <p className="pc-sub">{t.factS}</p>
        {facts && facts.conflicts.length > 0 ? (
          <ul className="pc-facts">{groups(facts.conflicts).map((g) => (
            <li key={g.type} className="pc-conf" data-fact-conflict={g.type}>
              <div className="pc-ft"><b>{t.types[g.type]}</b><span>{t.times(g.count)} · <span dir="ltr">{g.engines.map((e) => ENG[e] || e).join(", ")}</span></span></div>
              <div className="pc-vs"><div><small>{t.aiSays}</small>{g.items.map((f) => <s key={f.said} className="pc-said">{f.said}{f.count > 1 && <em dir="ltr"> ×{f.count}</em>}</s>)}</div>{g.expected && <div><small>{t.youSaid}</small><b>{g.expected}</b></div>}</div>
              <details><summary>{t.quote}</summary>{g.items.map((f) => <blockquote key={f.said}>“{f.quote}”</blockquote>)}</details>
              {t.fixHint[g.type] && <p className="pc-hint">{t.fixHint[g.type]}</p>}
            </li>))}</ul>
        ) : <p className="pc-ok" data-fact-clean>✓ {t.clean(facts?.matches || 0)}</p>}
        {facts && facts.conflicts.length > 0 && facts.matches > 0 && <p className="pc-meta">{t.matched(facts.matches)}</p>}
        {facts && facts.checks.length > 0 && (<div className="pc-check"><h4>{t.verify}</h4><p className="pc-meta">{t.verifyS}</p>
          <ul>{facts.checks.map((f, i) => <li key={i} data-fact-check={f.type}><span>{t.types[f.type]}</span><b dir="auto">{f.said}</b></li>)}</ul></div>)}
        <p className="pc-how">{t.how}</p>
      </section>
    </div>
  );
}
