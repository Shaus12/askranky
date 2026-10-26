// Alert detection: what changed for the worse between a business's previous scan and this one. Pure diff of two stored scans
// (no engine calls), run by runScan for every scan, so the dashboard shows alerts after a manual re-scan too.
// Types: wrong_fact (a NEW wrong city/website/"closed"), score_drop, engine_lost (an engine stopped naming you),
// competitor_overtook (named more often than you now, not before), tone_drop (net tone fell, or a new negative sentence).
import { norm } from './extract.js';
import { summarizeFacts } from './factcheck.js';

export const SCORE_DROP = 10, TONE_DROP = 20;
const ok = s => (Array.isArray(s?.results) ? s.results : []).filter(r => r && !r.error);
const factsOf = s => s?.summary?.facts || summarizeFacts(ok(s)) || { conflicts: [] };
const factKey = f => `${f.type}|${norm(f.said)}`;
const RANK = { high: 0, medium: 1 };
// Scans saved before fact checking existed carry no facts at all (no summary.facts, no per-result facts). Comparing against one
// would make every long-standing conflict look NEW, so wrong-fact alerts are skipped until there is a fact-checked baseline.
export const hasFactBaseline = s => !!s?.summary?.facts || (Array.isArray(s?.results) && s.results.some(r => r && 'facts' in r));
// Distinct questions asked. A free scan (5 questions) vs a paid one (15) is not comparable for score / competitor counts.
const questionCount = s => new Set((Array.isArray(s?.results) ? s.results : []).filter(Boolean).map(r => r.question)).size;

export function detectAlerts(prev, cur) {
  if (!prev || !cur || prev.businessId !== cur.businessId || !ok(prev).length || !ok(cur).length) return [];
  const out = [];
  // 1) New wrong facts (a "closed" claim or wrong city/website the previous scan did not have).
  const factBase = hasFactBaseline(prev);
  const seen = new Set(factBase ? factsOf(prev).conflicts.map(factKey) : []);
  // One alert per kind of fact: three new wrong cities = one "wrong city" alert listing all three.
  const byType = new Map();
  for (const f of factBase ? factsOf(cur).conflicts : []) { if (seen.has(factKey(f))) continue; const g = byType.get(f.type);
    if (!g) byType.set(f.type, { type: f.type, said: f.said, saids: [f.said], expected: f.expected, quote: f.quote, engines: [...(f.engines || [])], count: f.count || 1 });
    else { g.saids.push(f.said); g.said = g.saids.join('", "'); g.count += f.count || 1; for (const e of f.engines || []) if (!g.engines.includes(e)) g.engines.push(e); } }
  for (const fact of byType.values()) out.push({ type: 'wrong_fact', severity: 'high', fact });
  const sameQuestions = questionCount(prev) === questionCount(cur);
  // 2) Score drop (only between scans that asked the same number of questions).
  const s0 = prev.summary?.score, s1 = cur.summary?.score;
  if (sameQuestions && Number.isFinite(s0) && Number.isFinite(s1) && s0 - s1 >= SCORE_DROP) out.push({ type: 'score_drop', severity: s0 - s1 >= 2 * SCORE_DROP ? 'high' : 'medium', from: s0, to: s1 });
  // 3) An engine that named you before and does not now.
  for (const [e, b] of Object.entries(cur.summary?.byEngine || {})) { const a = prev.summary?.byEngine?.[e]; if (a?.mentions > 0 && b?.checks > 0 && b.mentions === 0) out.push({ type: 'engine_lost', severity: 'high', engine: e, before: a.mentions, checks: b.checks }); }
  // 4) Competitor now named more often than you, and was not before.
  const counts = s => { const m = new Map(); for (const r of ok(s)) for (const c of new Set((r.competitors || []).map(x => x.trim()))) { const k = norm(c); const e = m.get(k) || { name: c, n: 0 }; e.n++; m.set(k, e); } return m; };
  const you0 = ok(prev).filter(r => r.mentioned).length, you1 = ok(cur).filter(r => r.mentioned).length; const c0 = counts(prev);
  if (sameQuestions) [...counts(cur).entries()].filter(([k, v]) => v.n > you1 && (c0.get(k)?.n ?? 0) <= you0).sort((a, b) => b[1].n - a[1].n).slice(0, 2)
    .forEach(([k, v]) => out.push({ type: 'competitor_overtook', severity: 'medium', name: v.name, them: v.n, you: you1, themBefore: c0.get(k)?.n ?? 0, youBefore: you0 }));
  // 5) Tone: net fell by TONE_DROP+, or a negative / mixed sentence that the previous scan did not contain.
  const t0 = prev.summary?.sentiment, t1 = cur.summary?.sentiment;
  if (t0 && t1) {
    const before = new Set(ok(prev).flatMap(r => r.sentiment?.phrases || []).map(p => norm(p.text)));
    const fresh = ok(cur).flatMap(r => (r.sentiment?.phrases || []).filter(p => (p.tone === 'negative' || p.tone === 'mixed') && !before.has(norm(p.text))).map(p => ({ ...p, engine: r.engine, question: r.question })));
    if (t0.net - t1.net >= TONE_DROP || fresh.length) out.push({ type: 'tone_drop', severity: 'medium', from: t0.net, to: t1.net, example: fresh[0] || t1.examples?.find(x => x.tone === 'negative') || null });
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
