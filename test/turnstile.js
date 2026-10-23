// Turnstile hardening: enforcement on waitlist/login/checkout/scan, stable error codes, hostname check, 5s timeout (fail closed),
// startup config check for live mode, and client wiring (widget + localized strings).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { spawnSync } from 'node:child_process'; import { useTempData } from './helpers.js'; const TD = useTempData('ts');
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '100'; delete process.env.PRELAUNCH; delete process.env.NODE_ENV; delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_HOSTNAMES;
const { default: app, loginLimiter } = await import('../server.js'); const TS = await import('../src/security/turnstile.js'); const { checkConfig } = await import('../src/config-check.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const realFetch = globalThis.fetch; let cf = null, cfCalls = [];
// Intercept only Cloudflare siteverify; everything else (our own server) goes through the real fetch.
globalThis.fetch = (u, o) => String(u).includes('challenges.cloudflare.com') ? (cfCalls.push({ u: String(u), o }), cf(u, o)) : realFetch(u, o);
const reply = j => async () => ({ json: async () => j });
const post = (p, d) => (loginLimiter.reset?.(), realFetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }));
const quiet = async f => { const w = console.warn; console.warn = () => {}; try { return await f(); } finally { console.warn = w; } };
try {
  // ---- off: no-op without keys ----
  for (const [p, d] of [['/api/waitlist', { email: 'a@t.test' }], ['/api/login', { email: 'a@t.test' }]]) assert.equal((await post(p, d)).status, 200);
  assert.equal((await post('/api/checkout', { plan: 'starter', email: 'a@t.test' })).status, 200); assert.equal(cfCalls.length, 0); ok('no keys: waitlist, login and checkout are not enforced and never call Cloudflare');
  // ---- on ----
  process.env.TURNSTILE_SECRET_KEY = 'sk'; process.env.TURNSTILE_SITE_KEY = 'pk';
  for (const [p, d] of [['/api/waitlist', { email: 'b@t.test' }], ['/api/login', { email: 'b@t.test' }], ['/api/checkout', { plan: 'starter', email: 'b@t.test' }], ['/api/scan', { name: 'T', category: 'c', city: 'x', email: 'b@t.test' }]]) {
    const r = await post(p, d); const j = await r.json(); assert.equal(r.status, 403, p); assert.equal(j.error, 'captcha_required', p); assert.equal(j.code, 'captcha_required'); assert.equal(j.message, 'Please complete the CAPTCHA.'); }
  assert.equal(cfCalls.length, 0); ok('missing token -> 403 {error:"captcha_required", message} on waitlist, login, checkout, scan (no Cloudflare call)');
  loginLimiter.reset?.(); const h = await realFetch(B + '/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'b@t.test' }) }); assert.equal(h.status, 403); assert.match(await h.text(), /CAPTCHA/); ok('HTML /login form post is enforced too');
  cf = reply({ success: false, 'error-codes': ['invalid-input-response'] });
  for (const [p, d] of [['/api/waitlist', { email: 'b@t.test' }], ['/api/login', { email: 'b@t.test' }], ['/api/checkout', { plan: 'starter', email: 'b@t.test' }]]) {
    const r = await quiet(() => post(p, { ...d, 'cf-turnstile-response': 'bogus' })); const j = await r.json(); assert.equal(r.status, 403, p); assert.equal(j.error, 'captcha_failed'); }
  assert.equal(cfCalls.length, 3); assert.match(String(cfCalls[0].o.body), /secret=sk&response=bogus/); ok('bogus token -> 403 captcha_failed (siteverify mocked)');
  cf = reply({ success: true, hostname: 'askranky.com' });
  for (const [p, d, s] of [['/api/waitlist', { email: 'c@t.test' }, 200], ['/api/login', { email: 'c@t.test' }, 200], ['/api/checkout', { plan: 'starter', email: 'c@t.test' }, 200]]) assert.equal((await post(p, { ...d, 'cf-turnstile-response': 'good' })).status, s, p);
  assert.equal((await post('/api/waitlist', { email: 'd@t.test', turnstileToken: 'good' })).status, 200); ok('valid token passes on waitlist, login, checkout (also legacy turnstileToken field)');
  // ---- admin test checkout (pre-launch, mock payments, valid ADMIN_TEST_TOKEN) skips the CAPTCHA; a wrong token does not ----
  process.env.PRELAUNCH = '1'; process.env.ADMIN_TEST_TOKEN = 'adm-0123456789abcdef'; cfCalls.length = 0;
  const ckh = async (tok) => { loginLimiter.reset?.(); return realFetch(B + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-test-token': tok }, body: JSON.stringify({ plan: 'pro', email: 'adm@t.test' }) }); };
  assert.equal((await ckh('adm-0123456789abcdef')).status, 200); const bad = await ckh('adm-0123456789abcdeX'); assert.equal(bad.status, 403); assert.equal((await bad.json()).error, 'captcha_required'); assert.equal(cfCalls.length, 0);
  delete process.env.PRELAUNCH; delete process.env.ADMIN_TEST_TOKEN; ok('admin test checkout (valid token, pre-launch) bypasses CAPTCHA; wrong token still gets captcha_required');
  // ---- hostname ----
  const w = []; const cw = console.warn; console.warn = m => w.push(String(m));
  try {
    process.env.TURNSTILE_HOSTNAMES = 'askranky.com, www.askranky.com';
    assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'evil.example' }))).ok, false);
    assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true }))).ok, false);
    assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'www.askranky.com' }))).ok, true);
    assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'ASKRANKY.com' }))).ok, true);
    assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'evil.example' }))).code, 'captcha_failed'); ok('hostname must be askranky.com / www.askranky.com (case-insensitive); mismatch or missing rejected');
    process.env.TURNSTILE_HOSTNAMES = 'staging.example.com'; assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'staging.example.com' }))).ok, true); assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'askranky.com' }))).ok, false); ok('TURNSTILE_HOSTNAMES overrides the list');
    delete process.env.TURNSTILE_HOSTNAMES; assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'localhost' }))).ok, true); ok('hostname check skipped in dev/test (no NODE_ENV=production, no TURNSTILE_HOSTNAMES)');
    process.env.NODE_ENV = 'production'; assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'localhost' }))).ok, false); assert.equal((await TS.verifyTurnstile('t', '1', reply({ success: true, hostname: 'askranky.com' }))).ok, true); delete process.env.NODE_ENV; ok('hostname check on by default in production');
    // ---- error codes logged, no secrets ----
    w.length = 0; await TS.verifyTurnstile('SECRET-TOKEN-123', '1', reply({ success: false, 'error-codes': ['timeout-or-duplicate'] })); assert.ok(w.some(m => m.includes('timeout-or-duplicate'))); assert.ok(!w.join('\n').match(/sk|SECRET-TOKEN-123/)); ok('error-codes are logged; secret and token are not');
    // ---- timeout / network: fail closed ----
    let sig; const hang = (u, o) => { sig = o.signal; return new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))); };
    const hangFetch = (u, o) => { const p = hang(u, o); return p; };
    const orig = AbortSignal.timeout; AbortSignal.timeout = ms => { assert.equal(ms, 5000); return orig.call(AbortSignal, 20); };
    try { const t0 = Date.now(); const v = await TS.verifyTurnstile('t', '1', hangFetch); assert.equal(v.ok, false); assert.equal(v.code, 'captcha_unavailable'); assert.ok(Date.now() - t0 < 2000); assert.ok(sig instanceof AbortSignal); } finally { AbortSignal.timeout = orig; }
    ok('siteverify uses AbortSignal.timeout(5000); a hung call fails closed (captcha_unavailable)');
    assert.equal((await TS.verifyTurnstile('t', '1', async () => { throw new Error('net'); })).code, 'captcha_unavailable'); assert.equal((await TS.verifyTurnstile('t', '1', async () => ({ json: async () => { throw new Error('bad json'); } }))).ok, false);
    cf = () => Promise.reject(new Error('net')); const r = await post('/api/waitlist', { email: 'e@t.test', 'cf-turnstile-response': 'x' }); assert.equal(r.status, 403); assert.equal((await r.json()).error, 'captcha_unavailable'); ok('network/JSON error fails closed on the server too (403 captcha_unavailable)');
  } finally { console.warn = cw; }
  // ---- no-key mode skips everything again ----
  delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; assert.deepEqual(await TS.verifyTurnstile(undefined, '1'), { ok: true, skipped: true });
  // ---- config check ----
  const prod = { NODE_ENV: 'production', PRELAUNCH: '0' }; const keys = { TURNSTILE_SITE_KEY: 'pk', TURNSTILE_SECRET_KEY: 'sk' };
  let c = checkConfig({ ...prod }); assert.ok(c.fatal.length === 1 && /TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must both be set/.test(c.fatal[0])); assert.equal(c.ok, false);
  for (const one of [{ TURNSTILE_SITE_KEY: 'pk' }, { TURNSTILE_SECRET_KEY: 'sk' }]) { c = checkConfig({ ...prod, ...one }); assert.equal(c.fatal.length, 1); assert.ok(c.warnings.some(x => /Only TURNSTILE_/.test(x))); }
  c = checkConfig({ ...prod, ...keys }); assert.equal(c.fatal.length, 0); assert.ok(!c.errors.some(x => /TURNSTILE/.test(x))); assert.equal(c.modes.TURNSTILE, 'on'); ok('live mode (production, PRELAUNCH=0): missing/partial Turnstile keys are fatal; both set is fine');
  c = checkConfig({ NODE_ENV: 'production' }); assert.equal(c.fatal.length, 0); assert.ok(c.warnings.some(x => /Turnstile keys not set/.test(x))); c = checkConfig({ NODE_ENV: 'production', PRELAUNCH: '1', TURNSTILE_SITE_KEY: 'pk' }); assert.equal(c.fatal.length, 0); assert.ok(c.warnings.some(x => /Only TURNSTILE_SITE_KEY/.test(x))); ok('pre-launch (explicit or auto via mock providers): only warnings');
  c = checkConfig({}); assert.equal(c.fatal.length, 0); ok('dev/test: no Turnstile requirement');
  // real process: refuses to start (exit 1) in live mode without keys; secrets are not echoed
  const run = env => spawnSync(process.execPath, ['server.js'], { env: { PATH: process.env.PATH, DATA_DIR: TD.dir, FORCE_JSON_STORE: '1', PORT: '0', ...env }, encoding: 'utf8', timeout: 20000 });
  const p = run({ NODE_ENV: 'production', PRELAUNCH: '0', TURNSTILE_SECRET_KEY: 'only-a-secret-XYZ' }); assert.equal(p.status, 1); assert.match(p.stderr + p.stdout, /must both be set/); assert.ok(!(p.stderr + p.stdout).includes('only-a-secret-XYZ')); ok('server.js exits 1 with a clear message in live mode without both keys (secret not printed)');
  // ---- client wiring ----
  const read = f => fs.readFileSync(f, 'utf8'); const login = read('web/components/Login.tsx'), co = read('web/components/Checkout.tsx'), sp = read('web/components/ScanProgress.tsx'), i18n = read('web/lib/i18n.ts'), api = read('web/lib/api.ts'), tsx = read('web/components/Turnstile.tsx');
  for (const [name, src] of [['Login', login], ['Checkout', co]]) { assert.match(src, /<Turnstile siteKey=\{siteKey\} lang=\{lang\} resetKey=\{rk\}/, name); assert.match(src, /cf-turnstile-response/, name); assert.match(src, /errMessage\(x, t\)/, name); assert.match(src, /setRk\(/, name); }
  assert.equal((co.match(/<Turnstile /g) || []).length, 2); assert.match(co, /\/api\/waitlist.*cf-turnstile-response/s); assert.match(sp, /errMessage\(e, t\)/); assert.match(api, /captcha_required.*captcha_failed.*captcha_unavailable/s); assert.match(tsx, /turnstile\?\.reset/); assert.match(tsx, /language: lang/);
  assert.equal((i18n.match(/captchaFailed:/g) || []).length, 2); assert.equal((i18n.match(/captchaUnavailable:/g) || []).length, 2); assert.match(i18n, /captchaFailed: "אימות ה־CAPTCHA/); ok('Login, Checkout (checkout + waitlist) and ScanProgress wired: widget with locale + reset, localized HE/EN captcha strings');
  console.log(`ALL TURNSTILE TESTS PASSED (${n})`);
} finally { globalThis.fetch = realFetch; srv.close(); TD.done(); }
process.exit(0);
