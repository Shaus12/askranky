// Dashboard insights built ONLY from the account's own stored scans (no engine calls, no spend). Called after the key-auth guard
// with the authenticated account; every lookup is filtered by accountId so one account can never see another's businesses/scans.
import { isOpaqueHost } from './extract.js';
import { summarizeSentiment } from './sentiment.js';
import { summarizeFacts } from './factcheck.js';
const EX = 320; // answer excerpt length
const clip = (s, n = EX) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const engScore = (checks, mentions, ranks) => { if (!checks) return null; const mr = mentions / checks; const ar = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  return Math.round(100 * (0.7 * mr + 0.3 * (ar ? Math.max(0, (6 - ar) / 5) : 0))); };
const scansOf = (db, b) => (b.scanIds || []).map(i => db.scans[i]).filter(s => s && s.businessId === b.id).sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
const okResults = s => (Array.isArray(s.results) ? s.results : []).filter(r => r && !r.error);
const key = n => String(n).trim().toLowerCase();

export function engineTrend(scans) {
  return scans.map(s => { const res = okResults(s); const engines = s.summary?.engines?.ran || Object.keys(s.summary?.byEngine || {}); const by = {};
    for (const e of engines) { const rs = res.filter(r => r.engine === e); const m = rs.filter(r => r.mentioned); const ranks = m.map(r => r.rank || 5);
      const be = s.summary?.byEngine?.[e] || {}; const checks = rs.length || be.checks || 0, mentions = rs.length ? m.length : be.mentions || 0;
      by[e] = { checks, mentions, mentionRate: checks ? +(mentions / checks).toFixed(2) : 0, avgRank: ranks.length ? +(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : be.avgRank ?? null, score: rs.length ? engScore(checks, mentions, ranks) : null }; }
    return { scanId: s.id, at: s.at, score: s.summary?.score ?? null, byEngine: by }; });
}
export function competitorBoard(scans, limit = 10) {
  const map = new Map();
  scans.forEach((s, i) => { const seen = new Map(); for (const r of okResults(s)) for (const c of r.competitors || []) { const k = key(c); if (!k) continue; const e = seen.get(k) || { name: c, n: 0 }; e.n++; seen.set(k, e); }
    if (!okResults(s).length) for (const c of s.summary?.topCompetitors || []) seen.set(key(c.name), { name: c.name, n: c.count });
    for (const [k, v] of seen) { const row = map.get(k) || { name: v.name, total: 0, scans: 0, counts: Array(scans.length).fill(0) }; row.total += v.n; row.scans++; row.counts[i] = v.n; map.set(k, row); } });
  return [...map.values()].map(r => ({ ...r, last: r.counts.at(-1), prev: r.counts.length > 1 ? r.counts.at(-2) : null, trend: r.counts.length > 1 ? Math.sign(r.counts.at(-1) - r.counts.at(-2)) : 0 }))
    .sort((a, b) => b.total - a.total || b.last - a.last || a.name.localeCompare(b.name)).slice(0, limit);
}
export function questionExplorer(scans) {
  const last = scans.at(-1), prev = scans.length > 1 ? scans.at(-2) : null; if (!last) return [];
  const prevBy = new Map(); for (const r of prev ? (prev.results || []) : []) if (r && !r.error) prevBy.set(`${r.engine}\u0000${key(r.question)}`, r);
  const qs = new Map();
  for (const r of last.results || []) { if (!r) continue; const q = qs.get(r.question) || { question: r.question, engines: {} }; const p = prevBy.get(`${r.engine}\u0000${key(r.question)}`);
    q.engines[r.engine] = r.error ? { error: true } : { excerpt: clip(r.answer), mentioned: !!r.mentioned, rank: r.rank ?? null, competitors: (r.competitors || []).slice(0, 5),
      change: !p ? null : { mentionedBefore: !!p.mentioned, rankBefore: p.rank ?? null, delta: (!!r.mentioned === !!p.mentioned) ? (r.mentioned && r.rank && p.rank ? Math.sign(p.rank - r.rank) : 0) : (r.mentioned ? 1 : -1) } };
    qs.set(r.question, q); }
  return [...qs.values()];
}
// Domains the engines cite in answers that do NOT mention the business (latest scan first, all scans as context).
export function sourceGaps(scans, limit = 8) {
  const last = scans.at(-1); if (!last) return [];
  const map = new Map();
  for (const r of okResults(last)) { const hosts = new Set((r.citations || []).filter(c => c && !c.isOwnSite && !c.opaque && !isOpaqueHost(c.host)).map(c => String(c.host).toLowerCase()));
    for (const h of hosts) { const e = map.get(h) || { host: h, cited: 0, missing: 0, engines: new Set() }; e.cited++; if (!r.mentioned) e.missing++; e.engines.add(r.engine); map.set(h, e); } }
  return [...map.values()].filter(e => e.missing > 0).sort((a, b) => b.missing - a.missing || b.cited - a.cited || a.host.localeCompare(b.host)).slice(0, limit).map(e => ({ ...e, engines: [...e.engines].sort() }));
}
// Sentiment per scan (counts + net score) and the latest scan's fact flags. Older scans without per-answer sentiment are skipped, not guessed.
export function sentimentTrend(scans) {
  return scans.map(s => { const engines = s.summary?.engines?.ran || Object.keys(s.summary?.byEngine || {}); const v = s.summary?.sentiment || summarizeSentiment(okResults(s), engines);
    return v ? { scanId: s.id, at: s.at, counts: v.counts, net: v.net, answers: v.answers, byEngine: v.byEngine, examples: v.examples } : null; }).filter(Boolean);
}
export const latestFacts = scans => { const last = scans.at(-1); return last ? (last.summary?.facts || summarizeFacts(okResults(last))) : null; };
// Alerts from the account's own scans, newest first (each scan stores what got worse versus the scan before it).
export const recentAlerts = (scans, limit = 12) => scans.slice().reverse().flatMap(s => (s.alerts || []).map(a => ({ ...a, scanId: s.id, at: s.at }))).slice(0, limit);
export function dashboardData(db, account) {
  return Object.values(db.businesses).filter(b => b.accountId === account.id).map(b => { const scans = scansOf(db, b).filter(s => s.accountId === undefined || s.accountId === account.id);
    return { businessId: b.id, scanCount: scans.length, engineTrend: engineTrend(scans), competitors: competitorBoard(scans), questions: questionExplorer(scans), sources: sourceGaps(scans), sentiment: sentimentTrend(scans), facts: latestFacts(scans), alerts: recentAlerts(scans),
      lastScanAt: scans.at(-1)?.at ?? null, prevScanAt: scans.length > 1 ? scans.at(-2).at : null }; });
}
// CSV (RFC 4180, UTF-8 BOM for Excel/Hebrew). Cells starting with = + - @ (or tab/CR) are prefixed with ' to block formula injection.
const cell = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function dashboardCsv(db, b) {
  const rows = [['scan_id', 'scan_date', 'score', 'question', 'engine', 'mentioned', 'rank', 'competitors', 'cited_domains', 'answer_excerpt', 'error', 'sentiment', 'fact_flags']];
  for (const s of scansOf(db, b)) for (const r of s.results || []) { if (!r) continue;
    rows.push([s.id, s.at, s.summary?.score ?? '', r.question, r.engine, r.error ? '' : r.mentioned ? 'yes' : 'no', r.error ? '' : r.rank ?? '', (r.competitors || []).join('; '), [...new Set((r.citations || []).filter(c => !c.opaque).map(c => c.host))].join('; '), r.error ? '' : clip(r.answer, 500), r.error ? 'error' : '', r.sentiment?.tone ?? '', (r.facts || []).filter(f => f.status !== 'match').map(f => `${f.status}:${f.type}:${f.said}`).join('; ')]); }
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
