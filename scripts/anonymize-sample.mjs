// Usage: node scripts/anonymize-sample.mjs <scan.json> <he|en> [tradeLabel] [city]  -> prints a RealSample object for web/lib/sample-real.ts.
// Input: a stored scan ({ scan: { summary, results } } or the scan itself). Every competitor name and the scanned business name are replaced
// with neutral labels (עסק א׳ / Business A ...) everywhere, including inside answer excerpts; URLs and domains are stripped. Refuses dental
// scans (product rule). Numbers (score, counts) are copied as-is, never invented. Review the output by hand before committing it.
import fs from 'node:fs';
const [f, lang = 'he', trade = '', city = ''] = process.argv.slice(2); if (!f) { console.error('usage: anonymize-sample.mjs <scan.json> <he|en> [trade] [city]'); process.exit(2); }
const d = JSON.parse(fs.readFileSync(f, 'utf8')); const s = d.scan || d; const biz = d.business || d.meta?.business || {};
const blob = JSON.stringify(s.results || []); if (/dent|שיניים/i.test(blob + trade)) { console.error('refused: dental scan (product rule)'); process.exit(1); }
const HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳']; const label = i => lang === 'he' ? `עסק ${HE[i] || i + 1}` : `Business ${String.fromCharCode(65 + i)}`;
const names = new Map(); (s.summary?.topCompetitors || []).forEach((c, i) => names.set(c.name, label(i)));
for (const r of s.results || []) for (const c of r.competitors || []) { const n = typeof c === 'string' ? c : c?.name; if (n && !names.has(n)) names.set(n, label(names.size)); }
const own = lang === 'he' ? 'העסק שנבדק' : 'The scanned business';
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scrub = t => { let o = String(t || ''); for (const n of [biz.name, ...(biz.aliases || [])].filter(Boolean)) o = o.replace(new RegExp(esc(n), 'gi'), own);
  for (const [n, l] of [...names].sort((a, b) => b[0].length - a[0].length)) o = o.replace(new RegExp(esc(n), 'gi'), l);
  return o.replace(/\(\[[^\]]*\]\([^)]*\)\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/\b[\w-]+\.(?:com|co\.il|org|net|io|ai|online|il)\b\S*/gi, '').replace(/\*\*/g, '').trim(); };
const ok = (s.results || []).filter(r => !r.error);
const out = { lang, trade, city, at: String(s.at || '').slice(0, 10), score: s.summary.score, checks: s.summary.checks, engines: s.summary.engines?.ran || [],
  named: (s.summary.topCompetitors || []).map(c => ({ label: names.get(c.name), count: c.count })),
  qa: ok.slice(0, 2).map(r => ({ question: scrub(r.question), engine: r.engine, excerpt: scrub(r.answer).slice(0, 420), mentioned: !!r.mentioned })) };
console.log(JSON.stringify(out, null, 2));
