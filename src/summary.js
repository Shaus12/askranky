import { isOpaqueHost } from './extract.js';
// Summary of a scan from its results (pure; shared by runScan and scripts/day1-analyze.js, which rebuilds it per business offline without importing any provider).
export function summarizeResults(results, { plan, engines, skipped = [], cost = 0 }) {
  const ok = results.filter(r => !r.error);
  const compCount = {}, hostCount = {};
  for (const r of ok) { for (const c of r.competitors.slice(0, plan.competitors + 2)) compCount[c] = (compCount[c] || 0) + 1; for (const c of r.citations) { if (c.opaque || isOpaqueHost(c.host)) continue; const k = c.host; hostCount[k] = hostCount[k] || { host: k, count: 0, isOwnSite: c.isOwnSite }; hostCount[k].count++; } }
  const byEngine = Object.fromEntries(engines.map(e => { const rs = ok.filter(r => r.engine === e); const m = rs.filter(r => r.mentioned); return [e, { checks: rs.length, mentions: m.length, avgRank: m.length ? +(m.reduce((s, r) => s + (r.rank || 5), 0) / m.length).toFixed(1) : null, mock: rs.every(r => r.mock) }]; }));
  const mentionRate = ok.length ? ok.filter(r => r.mentioned).length / ok.length : 0;
  const ranks = ok.filter(r => r.rank).map(r => r.rank);
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const score = Math.round(100 * (0.7 * mentionRate + 0.3 * (avgRank ? Math.max(0, (6 - avgRank) / 5) : 0)));
  return {
    score, mentionRate: +mentionRate.toFixed(2), avgRank: avgRank && +avgRank.toFixed(1), byEngine,
    topCompetitors: Object.entries(compCount).sort((a, b) => b[1] - a[1]).slice(0, plan.competitors).map(([name, count]) => ({ name, count })),
    topCitedHosts: Object.values(hostCount).sort((a, b) => b.count - a.count).slice(0, 8),
    engines: { ran: engines, skipped }, ownSiteCited: ok.some(r => r.ownSiteCited), checks: ok.length, ...(ok.some(r => r.clarifying) ? { clarifyingAnswers: ok.filter(r => r.clarifying).length } : {}), errors: results.length - ok.length, estCostUsd: +cost.toFixed(3),
  };
}
