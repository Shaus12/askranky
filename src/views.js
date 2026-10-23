import { engineNote } from './engine-note.js';
import { BRAND } from './brand.js'; import { PLANS, isPaid } from './plans.js';
import { esc } from './security/html.js'; export { esc };
export const layout = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(BRAND.name)}</title><link rel="stylesheet" href="/style.css"></head><body>
<nav><a class="logo" href="/">◆ ${esc(BRAND.name)}</a><span><a href="/pricing">Pricing</a><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a></span></nav>
<main>${body}</main><footer>© ${new Date().getFullYear()} ${esc(BRAND.name)} · <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> · <a href="/legal/refunds">Refunds</a> · <a href="/legal/disclaimer">AI results disclaimer</a></footer></body></html>`;

export const landing = (err = '') => layout('AI visibility for local businesses', `
<section class="hero"><h1>Does ChatGPT recommend your business?</h1><p class="sub">${esc(BRAND.tagline)} Free scan in 60 seconds. No card needed.</p>
${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/scan" class="card form">
<label>Business name<input name="name" required placeholder="Acme Plumbing"></label>
<label>Website<input name="website" placeholder="https://acmeplumbing.com"></label>
<label>Category<input name="category" required placeholder="Plumber"></label>
<label>City<input name="city" required placeholder="Austin, TX"></label>
<label>Email (we send your report)<input name="email" type="email" required placeholder="you@business.com"></label>
<button>Run my free AI scan →</button></form></section>
<section class="grid3"><div class="card"><h3>🔎 3 AI engines</h3><p>We ask ChatGPT, Gemini and Perplexity the questions your customers ask.</p></div>
<div class="card"><h3>🏁 Your rank vs competitors</h3><p>See who gets recommended instead of you and which sites AI cites.</p></div>
<div class="card"><h3>🛠 3 fixes per report</h3><p>Concrete changes with ready-to-paste copy, not just charts.</p></div></section>`);

const scoreColor = s => s >= 60 ? '#16a34a' : s >= 30 ? '#ca8a04' : '#dc2626';
export const reportPage = (business, scan) => { const s = scan.summary; return layout(`AI visibility report: ${business.name}`, `
${scan.mock ? '<p class="mock">MOCK MODE: sample data, no real AI engines were queried.</p>' : ''}
<h1>AI visibility report: ${esc(business.name)}</h1><p class="sub">${esc(business.category)} · ${esc(business.city)} · ${esc(new Date(scan.at).toUTCString())}</p>
${s.engines ? `<p class="sub">${esc(engineNote(s))}</p>` : ''}
<div class="grid3"><div class="card big"><div class="score" style="color:${scoreColor(+s.score)}">${+s.score}<small>/100</small></div>AI Visibility Score</div>
<div class="card big"><div class="score">${Math.round(s.mentionRate * 100)}%</div>of ${+s.checks} answers mention you</div>
<div class="card big"><div class="score">${esc(s.avgRank ?? '–')}</div>average position when listed</div></div>
<h2>By engine</h2><table><tr><th>Engine</th><th>Mentioned</th><th>Avg rank</th></tr>${Object.entries(s.byEngine).map(([e, v]) => `<tr><td>${esc(e)}</td><td>${+v.mentions}/${+v.checks}</td><td>${esc(v.avgRank ?? '–')}</td></tr>`).join('')}</table>
<div class="grid2"><div><h2>Recommended instead of you</h2><ol>${s.topCompetitors.map(c => `<li>${esc(c.name)} <span class="muted">(${+c.count}×)</span></li>`).join('')}</ol></div>
<div><h2>Sources AI cites</h2><ul>${s.topCitedHosts.map(h => `<li>${esc(h.host)} <span class="muted">(${+h.count}×)</span>${h.isOwnSite ? ' <b>your site</b>' : ''}</li>`).join('')}</ul></div></div>
<h2>Your 3 fixes</h2>${scan.fixes.map((f, i) => `<div class="card fix"><h3>${i + 1}. ${esc(f.title)}</h3><p>${esc(f.why)}</p><pre>${esc(f.copy)}</pre></div>`).join('')}
<h2>Answers</h2><table class="answers"><tr><th>Question</th><th>Engine</th><th>Mentioned</th><th>Rank</th></tr>${scan.results.map(r => `<tr><td>${esc(r.question)}</td><td>${esc(r.engine)}</td><td>${r.error ? 'error' : r.mentioned ? '✅' : '❌'}</td><td>${esc(r.rank ?? '–')}</td></tr>`).join('')}</table>
<div class="cta card"><h3>Track your score over time and watch it climb</h3><a class="btn" href="/pricing">Start from $19 / ₪79 a month →</a></div>
<p class="muted small">Results come from the engines' APIs, which approximate but don't exactly match the consumer apps. Answers vary between runs, so watch trends.</p>`); };

export const pricing = () => layout('Pricing', `<h1>Simple pricing</h1><p class="sub">Cancel anytime. No VAT is added (exempt dealer). Israel: ILS, elsewhere: USD.</p><div class="grid3">
${Object.values(PLANS).map(p => `<div class="card plan"><h2>${esc(p.name)}</h2><div class="score">$${+p.prices.USD} / ₪${+p.prices.ILS}<small>${isPaid(p) ? '/mo' : ''}</small></div><ul>
<li>${p.businesses} business${p.businesses > 1 ? 'es' : ''}</li><li>${p.questionsPerBusiness} questions × 3 AI engines</li><li>${p.cadence === 'once' ? 'One-time scan' : 'Regular tracking (weekly reports coming soon)'}</li><li>Top ${p.competitors} competitors</li><li>3 fixes per report</li></ul>
${isPaid(p) ? `<form method="post" action="/checkout"><input type="hidden" name="plan" value="${esc(p.id)}"><input name="email" type="email" required placeholder="Email"><button>Choose ${esc(p.name)}</button></form>` : '<a class="btn" href="/">Run free scan</a>'}</div>`).join('')}</div>`);

export const dashboard = (account, businesses, scansByBiz, budget) => layout('Dashboard', `<h1>Dashboard</h1><p class="sub">${esc(account.email)} · plan <b>${esc(account.plan)}</b> · ${account.subscriptionRef ? 'active' : 'no subscription'}</p>
<p>Checks used this month: <b>${+budget.used}</b> / ${+budget.cap}</p>
${businesses.map(b => { const sc = scansByBiz[b.id] || []; return `<div class="card"><h2>${esc(b.name)}</h2><p class="muted">${esc(b.category)} · ${esc(b.city)}</p>
<div class="spark">${sc.map(s => `<span title="${esc(s.at)}" style="height:${+s.summary.score}px"></span>`).join('')}</div>
<table><tr><th>Date</th><th>Score</th><th>Mention rate</th><th></th></tr>${sc.slice().reverse().map(s => `<tr><td>${esc(s.at.slice(0, 10))}</td><td>${+s.summary.score}</td><td>${Math.round(s.summary.mentionRate * 100)}%</td><td><a href="/r/${encodeURIComponent(s.id)}">report</a></td></tr>`).join('')}</table>
<form method="post" action="/dashboard/${encodeURIComponent(account.id)}/rescan?key=${encodeURIComponent(account.key)}"><input type="hidden" name="businessId" value="${esc(b.id)}"><button>Run scan now</button></form></div>`; }).join('')}`);

// `html` is trusted markup written by us; pass user/provider text through `text` (escaped).
export const message = (title, html = '', text = '') => layout(title, `<h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}${html}`);
