import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js';
export function renderWeeklyEmail({ business, scan, prev, reportUrl }) {
  const s = scan.summary; const delta = prev ? s.score - prev.summary.score : null;
  const eng = Object.entries(s.byEngine).map(([e, v]) => `<tr><td>${esc(e)}</td><td>${+v.mentions}/${+v.checks}</td><td>${esc(v.avgRank ?? '–')}</td></tr>`).join('');
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111">
<h2 style="color:${esc(BRAND.color)}">${esc(BRAND.name)} weekly report: ${esc(business.name)}</h2>
<p style="font-size:40px;margin:0"><b>${+s.score}</b>/100 ${delta === null ? '' : `<span style="font-size:18px;color:${delta >= 0 ? 'green' : 'red'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}</span>`}</p>
<p>Mentioned in <b>${Math.round(s.mentionRate * 100)}%</b> of ${+s.checks} AI answers. Average position: <b>${esc(s.avgRank ?? 'not ranked')}</b>.</p>
<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Engine</th><th>Mentions</th><th>Avg rank</th></tr>${eng}</table>
<h3>Who AI recommends instead</h3><ol>${s.topCompetitors.map(c => `<li>${esc(c.name)} (${+c.count}x)</li>`).join('')}</ol>
<h3>This week's 3 fixes</h3>${scan.fixes.map((f, i) => `<p><b>${i + 1}. ${esc(f.title)}</b><br>${esc(f.why)}</p><pre style="background:#f4f4f5;padding:8px;white-space:pre-wrap">${esc(f.copy)}</pre>`).join('')}
<p><a href="${safeUrl(reportUrl)}">See the full report →</a></p>
<p style="color:#888;font-size:12px">${scan.mock ? '[MOCK DATA] ' : ''}Results come from the engines' APIs and can differ from the consumer apps. ${esc(BRAND.name)} · ${esc(BRAND.legalEntity)} · <a href="{{unsubscribe}}">Unsubscribe</a></p>
</body></html>`;
}
