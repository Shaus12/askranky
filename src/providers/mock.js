import { businessLang } from '../questions.js'; import { citySlug, ISRAELI_CITIES } from '../cities.js';
// Deterministic fake answers so the whole pipeline can be tested with no API keys.
const LABELS = { chatgpt: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity' };
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const PREFIX = ['Summit', 'Bright', 'Lone Star', 'Capital', 'Elite', 'Family', 'Precision', 'Blue Sky', 'Prime', 'Hometown'];
const PREFIX_HE = ['פסגה', 'אור', 'הכרמל', 'מרכז', 'עילית', 'משפחת כהן', 'דיוק', 'כחול לבן', 'פריים', 'השכונה'];
const SITES_HE = ['zap.co.il', 'easy.co.il', 'midrag.co.il', 'b144.co.il', 'facebook.com', 'google.com', 'ynet.co.il'];
const SITES = ['yelp.com', 'reddit.com', 'bbb.org', 'expertise.com', 'angi.com', 'threebestrated.com', 'nextdoor.com'];

export function mockProvider(engine) {
  return {
    id: engine, label: LABELS[engine], mock: true,
    async ask(question, ctx) {
      const h = hash(engine + '|' + question + '|' + ctx.business.name + (process.env.MOCK_SEED ? '|' + process.env.MOCK_SEED : '')); // MOCK_SEED: vary demo rounds (scripts/demo-dashboard.js); unset in tests
      const cat = ctx.business.category; const he = businessLang(ctx.business) === 'he';
      const names = [0, 1, 2, 3].map(i => he ? `${cat} ${PREFIX_HE[(h >>> (i * 3)) % PREFIX_HE.length]}${i === 3 ? ' בע"מ' : ''}` : `${PREFIX[(h >>> (i * 3)) % PREFIX.length]} ${cat}${i === 3 ? ' Co.' : ''}`);
      const uniq = [...new Set(names)];
      // The business's own line varies (deterministically) so sentiment and fact check have something to show in mock mode.
      const other = ISRAELI_CITIES[h % ISRAELI_CITIES.length]; const k = (h >>> 7) % 6;
      const ownNote = isHe => [isHe ? 'יש ביקורות מעורבות על זמני המתנה ארוכים.' : 'some reviews mention long wait times.',
        isHe ? `ממוקמים ב${other.he}, פתוח עד השעה 20:00.` : `located in ${['Round Rock', 'Cedar Park', 'Pflugerville', 'Georgetown'][h % 4]}, open until 8 pm.`][k] || (isHe ? 'ידועים בשירות מהיר וביקורות טובות.' : 'known for good reviews and fast service.');
      const includeTarget = (h % 3) !== 0;
      if (includeTarget) uniq.splice(h % (uniq.length + 1), 0, ctx.business.name);
      const list = uniq.slice(0, 4);
      // Hebrew answers mimic real engine output: RTL marks around list items, Hebrew prose, mixed LTR brand names.
      const text = he
        ? `\u200fהנה כמה אפשרויות עם ביקורות טובות עבור "${question}":\n` + list.map((n, i) => `\u200f${i + 1}. **${n}** – ${n === ctx.business.name ? ownNote(true) : 'ידועים בשירות מהיר וביקורות טובות.'}`).join('\n') + `\nמומלץ לבדוק ביקורות עדכניות לפני שמזמינים.`
        : `Here are some well-reviewed options for "${question}":\n` + list.map((n, i) => `${i + 1}. **${n}** – ${n === ctx.business.name ? ownNote(false) : 'known for good reviews and fast service.'}`).join('\n') + `\nAlways check recent reviews before booking.`;
      const sites = he ? SITES_HE : SITES; const slug = `${he ? 'service' : cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${citySlug(ctx.business.city)}`;
      const citations = [0, 1, 2].map(i => `https://www.${sites[(h >>> (i * 2)) % sites.length]}/${slug}`);
      if (includeTarget && ctx.business.website && h % 2) citations.push(ctx.business.website);
      return { text, citations: [...new Set(citations)], searches: 1, usage: { input: 9000, output: 500 } };
    },
  };
}
