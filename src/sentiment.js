import { clean, norm, sameBusiness } from './extract.js';
import { nameVariants, domainStem } from './names.js';
// Sentiment of the sentences an engine wrote ABOUT the business (English + Hebrew). Rule-based on purpose: no extra engine call,
// no cost, deterministic, and every label comes with the exact phrase and the cue words that produced it, so the owner sees why.
// Tones: positive · neutral · mixed · negative. Only answers that mention the business get a sentiment.

const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])'; // Unicode word edges (JS \b ignores Hebrew)
const HP = '[הובלמשכ]?'; // Hebrew one-letter prefixes glued to a word
const re = (words, he = false) => new RegExp(`${B}${he ? HP : ''}(?:${words.join('|')})${E}`, 'giu');
const POS_EN = ['highly recommended', 'recommended', 'recommend', 'highly rated', 'top[- ]rated', 'well[- ]reviewed', 'well[- ]known', 'excellent', 'outstanding', 'great', 'trusted', 'reliable',
  'friendly', 'professional', 'popular', 'favou?rite', 'known for (?:good|great|excellent|friendly|fast)', '5[- ]star', 'five[- ]star', 'good reviews', 'positive reviews', 'fast service', 'fair prices?', 'affordable', 'standout', 'praised'];
const NEG_EN = ['complaints?', 'complain(?:ed|s)?', 'negative reviews?', 'mixed reviews?', 'poor', 'bad reviews?', 'rude', 'slow', 'overpriced', 'expensive', 'unreliable', 'avoid', 'scam',
  'long waits?', 'long wait times', 'critici[sz]ed', 'lawsuits?', 'unprofessional', 'low[- ]rated', 'one[- ]star', '1[- ]star', 'issues with', 'problems with', 'hit or miss', 'inconsistent'];
const POS_HE = ['מומלץ', 'מומלצת', 'מומלצים', 'מצוין', 'מצוינת', 'מעולה', 'מעולים', 'איכותי', 'איכותית', 'אמין', 'אמינה', 'מקצועי', 'מקצועית', 'מקצועיים', 'אדיב', 'אדיבה', 'אדיבים',
  'ביקורות טובות', 'ביקורות חיוביות', 'ביקורות מצוינות', 'פופולרי', 'פופולרית', 'מוביל', 'מובילה', 'שירות מהיר', 'מחירים הוגנים', 'ידוע בשירות', 'ידועים בשירות', 'שבחים'];
const NEG_HE = ['תלונות', 'תלונה', 'ביקורות שליליות', 'ביקורות מעורבות', 'יקר', 'יקרה', 'יקרים', 'איטי', 'איטית', 'גס', 'גסה', 'לא אמין', 'לא אמינה', 'לא מקצועי', 'לא מקצועית',
  'בעיות', 'בעייתי', 'להימנע', 'זמני המתנה ארוכים', 'המתנה ארוכה', 'עקיצה', 'רמאות', 'ביקורת שלילית'];
const POS = [re(POS_EN), re(POS_HE, true)], NEG = [re(NEG_EN), re(NEG_HE, true)];
// "not recommended", "לא מומלץ": a negator right before a positive cue flips it. "no complaints" / "אין תלונות" flips a negative.
const NEGATOR = /(?:^|[\s(])(?:not|never|isn'?t|aren'?t|wasn'?t|hardly|לא|אינו|אינה|אין|בלי)\s+(?:\S+\s+)?$/iu;
const NO_NEG = /(?:^|[\s(])(?:no|without|few|אין|בלי|ללא)\s+(?:\S+\s+)?$/iu;

function cues(sentence) {
  const pos = [], neg = [];
  for (const [list, out, flipTo, flipRe] of [[POS, pos, neg, NEGATOR], [NEG, neg, pos, NO_NEG]]) for (const rx of list) for (const m of sentence.matchAll(rx)) {
    const before = sentence.slice(Math.max(0, m.index - 24), m.index);
    (flipRe.test(before) ? flipTo : out).push(flipRe.test(before) ? `${before.trim().split(/\s+/).pop()} ${m[0]}` : m[0]);
  }
  return { pos: [...new Set(pos)], neg: [...new Set(neg)] };
}
const toneOf = (p, n) => p && n ? 'mixed' : p ? 'positive' : n ? 'negative' : 'neutral';

// Sentences (list lines count as one sentence) that name the business: by list entity, by the main name / multi-word aliases in prose, or by the domain stem.
export function aboutSentences(text, business) {
  const targets = nameVariants(business); const prose = targets.filter((t, i) => i === 0 || t.includes(' ')); const stem = domainStem(business.website);
  const out = [];
  for (const line of clean(text).split('\n')) {
    const parts = /^\s*(?:\d+[.)]|[-*•]|[א-ת][.)])\s/u.test(line) ? [line] : line.split(/(?<=[.!?])\s+(?=\S)/u);
    for (const s of parts) {
      const bold = [...s.matchAll(/\*\*([^*]{2,60})\*\*/g)].map(m => m[1]);
      const n = norm(s);
      const hit = bold.some(b => sameBusiness(b, targets)) || prose.some(t => t && n.includes(t)) || (!!stem && n.replace(/ /g, '').includes(stem));
      if (hit) out.push(s.replace(/\*\*/g, '').replace(/^\s*(?:\d+[.)]|[-*•]|[א-ת][.)])\s*/u, '').trim());
    }
  }
  return out.filter(Boolean);
}
const clip = s => (s.length > 220 ? s.slice(0, 219) + '…' : s);

/** Sentiment for one answer. Returns null when the answer does not mention the business. */
export function sentimentFor(text, business, mentioned) {
  if (!mentioned) return null;
  const phrases = aboutSentences(text, business).map(s => { const c = cues(s); return { text: clip(s), tone: toneOf(c.pos.length, c.neg.length), cues: [...c.pos, ...c.neg].slice(0, 4) }; });
  const p = phrases.some(x => x.tone === 'positive' || x.tone === 'mixed'), n = phrases.some(x => x.tone === 'negative' || x.tone === 'mixed');
  return { tone: toneOf(p, n), phrases: phrases.slice(0, 3) };
}

const TONES = ['positive', 'neutral', 'mixed', 'negative'];
const zero = () => Object.fromEntries(TONES.map(t => [t, 0]));
/** Scan-level roll-up: counts overall and per engine, a net score (-100..100) and up to 4 example phrases (worst first). */
export function summarizeSentiment(results, engines) {
  const ok = results.filter(r => !r.error && r.sentiment); if (!ok.length) return null;
  const counts = zero(), byEngine = Object.fromEntries(engines.map(e => [e, zero()]));
  for (const r of ok) { counts[r.sentiment.tone]++; if (byEngine[r.engine]) byEngine[r.engine][r.sentiment.tone]++; }
  const net = Math.round(100 * (counts.positive - counts.negative - 0.5 * counts.mixed) / ok.length);
  const rank = { negative: 0, mixed: 1, positive: 2, neutral: 3 };
  const examples = ok.flatMap(r => r.sentiment.phrases.filter(p => p.tone !== 'neutral').map(p => ({ ...p, engine: r.engine, question: r.question })))
    .sort((a, b) => rank[a.tone] - rank[b.tone]).filter((x, i, a) => a.findIndex(y => y.text === x.text) === i).slice(0, 4);
  return { answers: ok.length, counts, byEngine, net, examples };
}
