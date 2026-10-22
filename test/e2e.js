// End-to-end test in mock mode: free scan -> report -> email -> checkout -> dashboard -> rescan -> caps -> weekly.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('e2e'); import fs from 'node:fs'; import path from 'node:path';
process.env.DISABLE_IP_LIMIT = '1'; 
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const { analyzeAnswer } = await import('../src/extract.js'); const { checkBudget } = await import('../src/costs.js');
const srv = app.listen(3999); const B = 'http://127.0.0.1:3999';
const post = (p, data) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
try {
  // extraction unit test
  const a = analyzeAnswer({ text: '1. **Bright Plumber** – good\n2. **Acme Plumbing** – great\n3. **Elite Plumber** – ok', citations: ['https://www.yelp.com/x', 'https://acmeplumbing.com/a'] }, { name: 'Acme Plumbing', website: 'https://acmeplumbing.com' });
  assert.equal(a.mentioned, true); assert.equal(a.rank, 2); assert.deepEqual(a.competitors, ['Bright Plumber', 'Elite Plumber']); assert.equal(a.ownSiteCited, true);
  let home = await fetch(B + '/', { redirect: 'manual', headers: { 'accept-language': 'he-IL,he;q=0.9' } }); assert.equal(home.headers.get('location'), '/he');
  home = await fetch(B + '/', { headers: { 'accept-language': 'en-US' } }); const homeHtml = await home.text(); assert.equal(home.status, 200); assert.ok(homeHtml.includes('Ranky') && homeHtml.includes('dir="ltr"'), 'Next.js export served (en)');
  const heHtml = await (await fetch(B + '/he')).text(); assert.ok(heHtml.includes('dir="rtl"') && heHtml.includes('lang="he"'), 'Hebrew RTL page');
  for (const p of ['/he/scan', '/en/login', '/he/r/abc', '/en/dashboard/xyz', '/he/checkout', '/en/legal']) assert.equal((await fetch(B + p)).status, 200, p);
  assert.ok(!/RankScout|AskAI|airank/i.test(heHtml + homeHtml), 'old brand names gone');
  const cfg = await (await fetch(B + '/api/config')).json(); assert.equal(cfg.brand.name, 'Ranky'); assert.deepEqual(cfg.plans.find(p => p.id === 'starter').prices, { ILS: 79, USD: 19 });
  let r = await post('/scan', { name: 'Acme Plumbing', website: 'https://acmeplumbing.com', category: 'Plumber', city: 'Austin, TX', email: 'owner@acme.test' });
  assert.equal(r.status, 302); const reportPath = r.headers.get('location'); assert.match(reportPath, /^\/r\//);
  assert.equal((await fetch(B + reportPath)).status, 200);
  const rep = await (await fetch(B + '/api/report/' + reportPath.split('/').pop())).json(); assert.equal(rep.business.name, 'Acme Plumbing'); assert.equal(rep.scan.fixes.length, 3); assert.deepEqual(rep.history, [rep.scan.summary.score]);
  const heScan = await (await fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'מספרת שירה', category: 'מספרה', city: 'חיפה', email: 'shira@he.test' }) })).json();
  const heRep = await (await fetch(B + '/api/report/' + heScan.reportId)).json(); assert.ok(heRep.scan.results.every(x => /[\u05D0-\u05EA]/.test(x.question))); assert.ok(/[\u05D0-\u05EA]/.test(heRep.scan.fixes[0].title), 'Hebrew business → Hebrew questions + fixes');
  // JSON scan API (used by React form)
  const js = await (await fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Bolt Dental', category: 'Dentist', city: 'Denver, CO', email: 'dr@bolt.test' }) })).json(); assert.ok(js.reportId);
  assert.equal((await fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  const db = getDb(); const scan = Object.values(db.scans)[0];
  assert.equal(scan.results.length, 15); assert.ok(scan.summary.topCompetitors.length > 0); assert.ok(scan.summary.topCitedHosts.length > 0); assert.equal(scan.fixes.length, 3);
  assert.ok(fs.readdirSync(TD.outbox).length > 0, 'email written to outbox');
  // repeat free scan -> same report, no extra spend
  r = await post('/scan', { name: 'Acme Plumbing', category: 'Plumber', city: 'Austin, TX', email: 'owner@acme.test' }); assert.equal(r.headers.get('location'), reportPath);
  // checkout (mock payments) -> dashboard
  r = await post('/checkout', { plan: 'starter', email: 'owner@acme.test' }); assert.match(r.headers.get('location'), /mock-checkout/);
  const acct = Object.values(db.accounts).find(a => a.email === 'owner@acme.test');
  const co = await (await fetch(B + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'agency', email: 'x@y.test' }) })).json(); assert.match(co.redirectUrl, /mock-checkout/);
  r = await fetch(`${B}/billing/return?Valid=1&Token=tok&Identifier=${acct.id}`, { redirect: 'manual' }); assert.equal(r.status, 400, 'return without checkout state rejected');
  const ident = new URL(B + (await post('/checkout', { plan: 'starter', email: 'owner@acme.test' })).headers.get('location')).searchParams.get('account');
  r = await fetch(`${B}/billing/return?Valid=1&Token=tok&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' }); assert.equal(r.status, 200); assert.ok(!(r.headers.get('location') || '').includes('key='));
  const magic = fs.readdirSync(TD.outbox).filter(f => f.includes('owner_acme_test')).map(f => fs.readFileSync(path.join(TD.outbox, f), 'utf8')).reverse().find(h => h.includes('/auth/magic'));
  const link = magic.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&').replace(/^https?:\/\/[^/]+/, B);
  r = await fetch(link, { redirect: 'manual' }); assert.equal(r.status, 302); assert.match(r.headers.get('location'), new RegExp(`^/dashboard/${acct.id}\\?key=`));
  assert.equal(acct.plan, 'starter');
  r = await post(`/dashboard/${acct.id}/rescan?key=${acct.key}`, { businessId: Object.values(db.businesses)[0].id }); assert.equal(r.status, 302);
  const rs = await (await fetch(`${B}/api/dashboard/${acct.id}/rescan?key=${acct.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: Object.values(db.businesses)[0].id }) })).json(); assert.ok(rs.reportId);
  assert.equal(Object.values(db.scans).at(-1).results.length, 45);
  const dash = await (await fetch(`${B}/api/dashboard/${acct.id}?key=${acct.key}`)).json(); assert.equal(dash.account.plan, 'starter'); assert.equal(dash.businesses[0].scans.length, 3); assert.equal(dash.usage.used, 105);
  assert.equal((await fetch(`${B}/api/dashboard/${acct.id}?key=wrong`)).status, 403);
  // plan cap: starter budget 225 checks/month; already used 15+45
  acct.usage[new Date().toISOString().slice(0, 7)] = 220; assert.equal(checkBudget(acct, ['chatgpt', 'gemini', 'perplexity'], 15).ok, false);
  // declined payment
  const id2 = new URL(B + (await post('/checkout', { plan: 'starter', email: 'owner@acme.test' })).headers.get('location')).searchParams.get('account'); r = await fetch(`${B}/billing/return?Valid=0&Identifier=${encodeURIComponent(id2)}`); assert.ok((await r.text()).includes('Payment failed'));
  for (const d of ['terms', 'privacy', 'refunds', 'disclaimer']) { const j = await (await fetch(`${B}/api/legal/${d}`)).json(); assert.ok(j.markdown.includes('Ranky') && !j.markdown.includes('{{')); }
  assert.equal((await fetch(B + '/pricing')).status, 200);
  console.log('ALL E2E TESTS PASSED. Report:', B + reportPath, 'score', scan.summary.score, 'est cost $' + scan.summary.estCostUsd);
} finally { srv.close(); }
await (await import('../src/store.js')).flush().catch(() => {}); TD.done(); console.log('  ✓ app/data untouched (temp DATA_DIR: ' + TD.dir + ')');
