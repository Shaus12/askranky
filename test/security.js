// Security regression tests: XSS escaping, dashboard tokens/magic links, scan rate limit + Turnstile hook, atomic store.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('sec'); import fs from 'node:fs'; import path from 'node:path';
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '3'; process.env.SCAN_RATE_WINDOW_MS = '60000';
delete process.env.TURNSTILE_SECRET_KEY; 
const { default: app, scanLimiter } = await import('../server.js'); const store = await import('../src/store.js');
const V = await import('../src/views.js'); const { renderWeeklyEmail } = await import('../src/email/report.js');
const { esc, safeUrl } = await import('../src/security/html.js'); const T = await import('../src/security/tokens.js');
const { createRateLimiter } = await import('../src/security/ratelimit.js'); const TS = await import('../src/security/turnstile.js');
const srv = app.listen(3998); const B = 'http://127.0.0.1:3998'; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const form = (p, d, h = {}) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...h }, body: new URLSearchParams(d) });
const json = (p, d, h = {}) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(d) });
const X = `<script>alert(1)</script>"'><img src=x onerror=alert(2)>`;
try {
  // ---- 1. XSS ----
  assert.equal(esc(X).match(/[<>"']/), null); ok('esc() neutralises < > " \' `');
  assert.equal(safeUrl('javascript:alert(1)'), '#'); assert.equal(safeUrl('/r/x?a=1&b=2'), '/r/x?a=1&amp;b=2'); ok('safeUrl() blocks javascript: URLs');
  const scan = { id: 's1', at: new Date().toISOString(), mock: true, summary: { score: 10, mentionRate: 0.1, avgRank: null, checks: 1, byEngine: { [X]: { mentions: 0, checks: 1, avgRank: X } }, topCompetitors: [{ name: X, count: 1 }], topCitedHosts: [{ host: X, count: 1 }] },
    fixes: [{ title: X, why: X, copy: X }], results: [{ question: X, engine: X, rank: X }] };
  const biz = { id: X, name: X, category: X, city: X };
  const acct = { id: 'a"b', key: 'k"<', email: X, plan: X };
  const pages = { landing: V.landing(X), report: V.reportPage(biz, scan), dashboard: V.dashboard(acct, [biz], { [X]: [scan] }, { used: 1, cap: 2 }), message: V.message(X, '', X), pricing: V.pricing(),
    email: renderWeeklyEmail({ business: biz, scan, prev: null, reportUrl: 'javascript:alert(1)' }) };
  for (const [k, h] of Object.entries(pages)) { assert.ok(!h.includes('<script>alert') && !h.includes('<img src=x') && !h.includes('javascript:'), `${k} leaks raw input`); }
  ok('all views.js renderers + weekly email escape user/AI-provided text');
  const mc = fs.readFileSync('web/components/Checkout.tsx', 'utf8'); assert.match(mc, /encodeURIComponent\(account\)/); ok('Checkout (mock payment page) encodes the account param before building links');
  const lg = fs.readFileSync('web/components/Legal.tsx', 'utf8') + fs.readFileSync('web/components/ReportBody.tsx', 'utf8'); assert.ok(!lg.includes('dangerouslySetInnerHTML')); ok('Next UI renders AI/legal text as text (no dangerouslySetInnerHTML)');
  const dk = fs.readFileSync('web/components/Dashboard.tsx', 'utf8'); assert.match(dk, /history\.replaceState/); assert.match(dk, /x-dashboard-key/); ok('dashboard key stripped from URL, sent as header');
  let r = await fetch(`${B}/billing/return?Valid=0&Identifier=${encodeURIComponent(X)}`); const body = await r.text(); assert.equal(r.status, 400); assert.ok(!body.includes('<script>alert')); ok('/billing/return does not reflect Identifier');

  // ---- 2. dashboard access ----
  r = await form('/scan', { name: 'Sec Co', category: 'Plumber', city: 'Austin', email: 'sec@co.test' }); assert.equal(r.status, 302);
  const a = Object.values(store.getDb().accounts).find(x => x.email === 'sec@co.test'); const bid = Object.values(store.getDb().businesses).find(b => b.accountId === a.id).id;
  assert.ok(a.key.length >= 43, 'key ≥ 256 bits'); ok('dashboard key is a 256-bit random token');
  for (const k of ['', 'wrong', a.key.slice(0, -1)]) {
    assert.equal((await fetch(`${B}/api/dashboard/${a.id}?key=${k}`)).status, 403);
    assert.equal((await json(`/api/dashboard/${a.id}/rescan?key=${k}`, { businessId: bid })).status, 403);
    assert.equal((await form(`/dashboard/${a.id}/rescan?key=${k}`, { businessId: bid })).status, 403);
  }
  assert.equal((await fetch(`${B}/api/dashboard/__proto__?key=x`)).status, 403); ok('dashboard + both rescan routes reject missing/wrong/truncated keys');
  assert.equal((await fetch(`${B}/api/dashboard/${a.id}`, { headers: { 'x-dashboard-key': a.key } })).status, 200); ok('key also accepted via X-Dashboard-Key header');
  const before = fs.readdirSync(TD.outbox).length;
  r = await json('/api/login', { email: 'nobody@x.test' }); const r2 = await json('/api/login', { email: 'sec@co.test' }); assert.deepEqual(await r.json(), await r2.json()); ok('login response identical for unknown/known email (no enumeration)');
  const mail = fs.readdirSync(TD.outbox).slice(before).map(f => fs.readFileSync(path.join(TD.outbox, f), 'utf8')); assert.equal(mail.length, 1, 'only one magic email, to the real account');
  const link = mail[0].match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&').replace(/^https?:\/\/[^/]+/, B); ok('magic link delivered via mock outbox');
  assert.ok(!JSON.stringify(a).includes(new URL(link).searchParams.get('t')), 'raw magic token not stored'); ok('only the hash of the magic token is stored');
  r = await fetch(link, { redirect: 'manual' }); assert.equal(r.status, 302); assert.equal(r.headers.get('referrer-policy'), 'no-referrer'); assert.equal(r.headers.get('location'), `/dashboard/${a.id}?key=${a.key}`);
  assert.equal((await fetch(link, { redirect: 'manual' })).status, 403); ok('magic link works once, then is rejected (single use)');
  const acc2 = { id: 'z' }; const l2 = T.issueMagicLink(acc2, B, 0); assert.equal(T.consumeMagic(acc2, new URL(l2).searchParams.get('t'), T.MAGIC_TTL_MS + 1), false); ok('magic link expires after 15 min');
  r = await form('/checkout', { plan: 'starter', email: 'sec@co.test' }); const ident = new URL(B + r.headers.get('location')).searchParams.get('account');
  assert.equal((await fetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${a.id}`, { redirect: 'manual' })).status, 400);
  assert.equal((await fetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${a.id}.forged`, { redirect: 'manual' })).status, 400);
  r = await fetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' }); assert.equal(r.status, 200); assert.ok(!(await r.text()).includes(a.key));
  assert.equal((await fetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' })).status, 400);
  ok('billing return needs the per-checkout state, is single-use, and never reveals the key (emails a magic link)');

  // ---- 3. rate limit + Turnstile ----
  scanLimiter.reset();
  const s = []; for (let i = 0; i < 4; i++) s.push((await json('/api/scan', { name: 'R' + i, category: 'c', city: 'x', email: `r${i}@r.test` })).status);
  assert.deepEqual(s.slice(0, 3).every(x => x === 200), true); assert.equal(s[3], 429); ok('/api/scan returns 429 after SCAN_RATE_MAX requests');
  r = await form('/scan', { name: 'R', category: 'c', city: 'x', email: 'r@r.test' }); assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0); ok('/scan (form) shares the limit and sends Retry-After');
  let t = 0; const lim = createRateLimiter({ max: 2, windowMs: 1000, now: () => t }); const run = () => new Promise(res => lim({ ip: '1' }, { set() {}, status: c => ({ send: () => res(c) }) }, () => res(200)));
  assert.deepEqual([await run(), await run(), await run()], [200, 200, 429]); t = 1001; assert.equal(await run(), 200); ok('limiter window slides and recovers');
  assert.deepEqual(await TS.verifyTurnstile(undefined, '1'), { ok: true, skipped: true }); assert.equal((await (await fetch(B + '/api/config')).json()).turnstileSiteKey, null); ok('Turnstile disabled when env keys unset');
  process.env.TURNSTILE_SECRET_KEY = 'sk'; process.env.TURNSTILE_SITE_KEY = 'pk'; let sent;
  const fake = ok2 => async (u, o) => { sent = { u, body: String(o.body) }; return { json: async () => ({ success: ok2 }) }; };
  assert.equal((await TS.verifyTurnstile('', '1', fake(true))).ok, false); assert.equal((await TS.verifyTurnstile('tok', '1', fake(false))).ok, false);
  assert.equal((await TS.verifyTurnstile('tok', '1', fake(true))).ok, true); assert.match(sent.u, /challenges\.cloudflare\.com/); assert.match(sent.body, /secret=sk.*response=tok/);
  assert.equal((await TS.verifyTurnstile('tok', '1', async () => { throw new Error('net'); })).ok, false);
  scanLimiter.reset(); r = await json('/api/scan', { name: 'T', category: 'c', city: 'x', email: 't@t.test' }); assert.equal(r.status, 403); assert.equal((await (await fetch(B + '/api/config')).json()).turnstileSiteKey, 'pk');
  delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; ok('Turnstile enforced when TURNSTILE_SECRET_KEY set (missing/failed/network-error tokens rejected)');

  // ---- 4. atomic store ----
  const dir = path.dirname(store.DB_FILE); const tmps = () => fs.readdirSync(dir).filter(f => f.startsWith(path.basename(store.DB_FILE)) && f.endsWith('.tmp'));
  const db = store.getDb(); const ps = []; for (let i = 0; i < 200; i++) { db.events.push({ i }); ps.push(store.save()); } await Promise.all(ps); await store.flush();
  const disk = JSON.parse(fs.readFileSync(store.DB_FILE, 'utf8')); assert.equal(disk.events.filter(e => 'i' in e).length, 200); assert.deepEqual(tmps(), []); ok('200 rapid saves → valid JSON with all data, no temp files left');
  const ino = fs.statSync(store.DB_FILE).ino; await store.save(); assert.notEqual(fs.statSync(store.DB_FILE).ino, ino); ok('save replaces file via rename (new inode), never truncates in place');
  const orig = fs.renameSync; fs.renameSync = () => { throw new Error('disk full'); }; const good = fs.readFileSync(store.DB_FILE, 'utf8');
  db.events.push({ broken: true }); await assert.rejects(store.save()); fs.renameSync = orig; assert.equal(fs.readFileSync(store.DB_FILE, 'utf8'), good); assert.deepEqual(tmps(), []); ok('failed write leaves previous DB intact and cleans temp file');
  const src = fs.readFileSync('src/store.js', 'utf8'); assert.match(src, /renameSync/); assert.match(src, /fsyncSync/);
  console.log(`ALL SECURITY TESTS PASSED (${n} checks)`);
} finally { srv.close(); }
await (await import('../src/store.js')).flush().catch(() => {}); TD.done(); console.log('  ✓ app/data untouched (temp DATA_DIR: ' + TD.dir + ')');
