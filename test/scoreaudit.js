// Regression: one-word dictionary alias must not match competitors' prose; avgRank uses the same rule as byEngine.
import assert from 'assert';
import { analyzeAnswer } from '../src/extract.js';
import { summarizeResults } from '../src/summary.js';
const biz = { name: 'דיוק ארט אוף דיזיין', aliases: ['דיוק', 'Diuk'], category: 'חיתוכי לייזר', city: 'תל אביב', website: 'https://diukart.co.il/' };
const fp = analyzeAnswer({ text: 'להלן:\n\n1. **לייזרקאט** - דירוגים גבוהים בזכות דיוק יוצא דופן.\n2. **CNC TLV** - עסק מוערך.\n3. **סטודיו גל** - שירות טוב.', citations: [] }, biz);
assert.strictEqual(fp.mentioned, false, 'dictionary word "דיוק" in a competitor description is not a mention');
const real = analyzeAnswer({ text: 'להלן:\n\n1. **WOOD STORY** - משרביות.\n2. **ORCUT** - CNC.\n3. **Diuk - ארט אוף דיזיין** - משרביות בלייזר.', citations: [] }, biz);
assert.strictEqual(real.mentioned, true); assert.strictEqual(real.rank, 3);
const r = (mentioned, rank) => ({ engine: 'chatgpt', mentioned, rank, competitors: [], citations: [] });
const s = summarizeResults([r(true, 1), r(true, null), r(false, null), r(false, null)], { plan: { competitors: 3 }, engines: ['chatgpt'] });
assert.strictEqual(s.avgRank, 3); assert.strictEqual(s.byEngine.chatgpt.avgRank, 3);
assert.strictEqual(s.score, Math.round(100 * (0.7 * 0.5 + 0.3 * 0.6)));
console.log('scoreaudit ok');
