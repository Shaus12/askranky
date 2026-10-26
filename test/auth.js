// v2-auth: email+password (scrypt), sessions (cookie + server store), CSRF, rate limits, reset/verify tokens, Google OIDC (mocked), legacy key.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { useTempData } from './helpers.js'; const TD = useTempData('auth');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'BASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', SCAN_RATE_MAX: '1000', UNSUBSCRIBE_SECRET: 'test-unsub-secret-0123456789', AUTH_LOGIN_MAX: '1000', AUTH_LOGIN_EMAIL_MAX: '4', AUTH_SIGNUP_MAX: '6', AUTH_RESET_MAX: '1000', AUTH_RESET_EMAIL_MAX: '3', AUTH_TOKEN_MAX: '1000', AUTH_PASSWORD_MAX: '1000', AUTH_GOOGLE_MAX: '1000',
  GOOGLE_AUTH_URL: 'https://google.test/auth', GOOGLE_TOKEN_URL: 'https://google.test/token', GOOGLE_JWKS_URL: 'https://google.test/jwks' });
const logs = []; for (const k of ['log', 'error', 'warn']) { const o = console[k]; console[k] = (...a) => { logs.push(a.map(String).join(' ')); o(...a); }; }
const { hashPassword, verifyPassword, passwordProblem, SCRYPT } = await import('../src/auth/password.js');
const S = await import('../src/auth/session.js'); const R = await import('../src/auth/routes.js'); const G = await import('../src/auth/google.js');
const { default: app } = await import('../server.js'); const { getDb, flush, DB_FILE } = await import('../src/store.js'); const { issueMagicLink, sha256 } = await import('../src/security/tokens.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); }; const db = getDb();
// --- mocked Google ---
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }); const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const evil = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const jwt = (claims, key = privateKey, kid = 'k1') => { const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url'), p = Buffer.from(JSON.stringify(claims)).toString('base64url'); return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`; };
let nextIdToken = null; const tokenCalls = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { u = String(u);
  if (u === 'https://google.test/jwks') return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
  if (u === 'https://google.test/token') { const b = new URLSearchParams(String(o.body)); tokenCalls.push(Object.fromEntries(b)); return new Response(JSON.stringify({ id_token: nextIdToken(b) }), { headers: { 'content-type': 'application/json' } }); }
  if (u.startsWith(B)) return realFetch(u, o); throw new Error('outbound blocked: ' + u); };
// --- tiny browser: cookie jar + Origin ---
const browser = () => { const jar = {}; const b = { jar, csrf: null,
  async req(p, { method = 'GET', body, headers = {}, origin = B } = {}) {
    const h = { ...(method !== 'GET' ? { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) } : {}), ...headers }; const c = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); if (c) h.Cookie = c;
    const r = await realFetch(B + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
    for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(sc) || !v) delete jar[k]; else jar[k] = v; }
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, h: r.headers, txt }; },
  post(p, body, o = {}) { return b.req(p, { method: 'POST', body, ...o }); },
  async me() { const r = await b.req('/api/auth/me'); b.csrf = r.j.csrf || null; return r.j; } }; return b; };
const mailDir = path.join(TD.dir, 'outbox'); const mails = () => fs.existsSync(mailDir) ? fs.readdirSync(mailDir).sort().map(f => fs.readFileSync(path.join(mailDir, f), 'utf8')) : [];
const lastLink = kind => { const all = mails(); const m = [...all.at(-1).matchAll(/href="([^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&')).find(h => h.includes(`/${kind}?`)); assert.ok(m, 'link in mail: ' + kind); const u = new URL(m); return { a: u.searchParams.get('a'), t: u.searchParams.get('t'), url: m }; };
const PW = 'correct horse battery', PW2 = 'another long passphrase';
try {
  // 1) hashing
  const h1 = await hashPassword(PW), h2 = await hashPassword(PW);
  assert.equal(h1.alg, 'scrypt'); assert.equal(h1.N, SCRYPT.N); assert.equal(h1.r, 8); assert.equal(h1.p, 1); assert.equal(Buffer.from(h1.salt, 'base64').length, 16); assert.notEqual(h1.salt, h2.salt); assert.notEqual(h1.hash, h2.hash); assert.ok(!JSON.stringify(h1).includes(PW));
  assert.equal(await verifyPassword(h1, PW), true); assert.equal(await verifyPassword(h1, PW + ' '), false); assert.equal(await verifyPassword(null, PW), false); assert.equal(await verifyPassword(undefined, 'dummy-password-for-timing'), false);
  assert.equal(await verifyPassword({ ...h1, N: 2 ** 30 }, PW), false, 'absurd params refused'); assert.equal(await verifyPassword(h1, 123), false);
  const low = await hashPassword(PW, { N: 2 ** 14, r: 8, p: 1, keylen: 64 }); assert.equal(await verifyPassword(low, PW), true, 'stored params are honoured');
  assert.equal(passwordProblem('short'), 'password_short'); assert.equal(passwordProblem('1234567890'), 'password_common'); assert.equal(passwordProblem('zzzzzzzzzzzz'), 'password_common'); assert.equal(passwordProblem('x'.repeat(300)), 'password_long'); assert.equal(passwordProblem(PW), null); assert.equal(passwordProblem('סיסמהארוכהמאוד'), null);
  ok('scrypt: per-user 16-byte salt, params stored and honoured, timing-safe verify, dummy hash for missing accounts; policy = length (10..256) + common list, no composition rules');

  // 2) unit: tokens, safeNext, origin, cookie names
  const acc = { id: 'u1' }; const t = R.issueToken(acc, 'reset', 1000, 0); assert.equal(R.consumeToken(acc, 'reset', t, 2000), false, 'expired'); const t2 = R.issueToken(acc, 'reset', 1000, 0);
  assert.equal(R.consumeToken(acc, 'verify', t2, 1), false, 'wrong purpose'); assert.equal(R.consumeToken(acc, 'reset', 'x' + t2, 1), false); assert.equal(R.consumeToken(acc, 'reset', t2, 1), true); assert.equal(R.consumeToken(acc, 'reset', t2, 1), false, 'single use'); assert.ok(!JSON.stringify(acc).includes(t2), 'only the hash is stored');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/he//evil.com', '/he/%2f%2fevil.com', 'javascript:alert(1)', '/x/dashboard', '', null, '/he/\nx']) assert.equal(S.safeNext(bad, 'F'), 'F', String(bad));
  for (const good of ['/he/dashboard', '/en/account', '/he/dashboard/abc?x=1', '/en']) assert.equal(S.safeNext(good, 'F'), good);
  assert.equal(S.sessionCookieName('https://askranky.com'), '__Host-ranky_sid'); assert.match(S.cookieAttrs('https://askranky.com', 1000), /^Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=1$/); assert.doesNotMatch(S.cookieAttrs('http://localhost:3000', 1000), /Secure|Domain/);
  assert.equal(G.redirectUri('https://askranky.com'), 'https://askranky.com/auth/google/callback'); assert.equal(G.redirectUri('https://askranky.com/'), 'https://askranky.com/auth/google/callback');
  ok('tokens single-use + expiring + hash-only; next param only /he|/en relative paths (no //, \\, encoded slashes, schemes); __Host- + Secure cookies on https; redirect URI from BASE_URL');

  // 3) signup → verify → session; enumeration-safe responses
  const u = browser(); const r0 = await u.post('/api/auth/signup', { email: 'New@T.test', password: PW, lang: 'he' }); assert.equal(r0.s, 200); const generic = r0.j;
  const a1 = Object.values(db.accounts).find(x => x.email === 'new@t.test'); assert.ok(a1.pendingPassword && !a1.passwordHash && !a1.emailVerified);
  const v = lastLink('verify'); assert.match(v.url, /\/he\/verify\?a=/); assert.match(mails().at(-1), /dir="rtl"/);
  assert.equal((await u.post('/api/auth/login', { email: 'new@t.test', password: PW })).j.code, 'email_unverified', 'unverified: no session');
  assert.equal((await u.post('/api/auth/verify', { a: v.a, t: 'nope' })).s, 400);
  const rv = await u.post('/api/auth/verify', { a: v.a, t: v.t, lang: 'he' }); assert.equal(rv.s, 200); assert.equal(rv.j.next, `/he/dashboard/${a1.id}`); assert.ok(u.jar.ranky_sid);
  assert.equal((await u.post('/api/auth/verify', { a: v.a, t: v.t })).s, 400, 'verify link single use'); assert.ok(a1.passwordHash && a1.emailVerified && !a1.pendingPassword);
  const me1 = await u.me(); assert.equal(me1.signedIn, true); assert.equal(me1.account.id, a1.id); assert.equal(me1.account.hasPassword, true); assert.ok(me1.csrf.length > 20); assert.equal(me1.account.passwordHash, undefined);
  const sc = (await realFetch(B + '/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: B }, body: '{}' })); assert.equal(sc.headers.get('cache-control'), 'no-store');
  const n0 = mails().length; const r1 = await browser().post('/api/auth/signup', { email: 'new@t.test', password: 'some other password', lang: 'en' }); assert.equal(r1.s, 200); assert.deepEqual(r1.j, generic, 'existing email: same answer');
  assert.equal(mails().length, n0 + 1); assert.match(mails().at(-1), /already has a Ranky password/); assert.equal(await verifyPassword(a1.passwordHash, PW), true, 'existing password untouched by a 2nd signup');
  assert.deepEqual((await browser().post('/api/auth/signup', { email: 'bad', password: PW })).j.code, 'email_invalid'); assert.equal((await browser().post('/api/auth/signup', { email: 'x@t.test', password: 'short' })).j.code, 'password_short');
  ok('signup: verification email (HE RTL), no session until the single-use link is confirmed by POST; existing email gets the same generic answer + an "already registered" mail, password untouched');

  // 4) login: generic failure, session rotation (fixation), next validation, logout
  const L1 = browser(); L1.jar.ranky_sid = 'attacker-chosen-session-id-0123456789abcdef';
  const bad1 = await L1.post('/api/auth/login', { email: 'new@t.test', password: 'wrong password!' }), bad2 = await L1.post('/api/auth/login', { email: 'nobody@t.test', password: 'wrong password!' });
  assert.equal(bad1.s, 401); assert.equal(bad2.s, 401); assert.deepEqual(bad1.j, bad2.j, 'same error for unknown email and wrong password');
  const good = await L1.post('/api/auth/login', { email: 'NEW@t.test', password: PW, next: '//evil.com' }); assert.equal(good.s, 200); assert.equal(good.j.next, `/en/dashboard/${a1.id}`, 'open redirect refused');
  assert.notEqual(L1.jar.ranky_sid, 'attacker-chosen-session-id-0123456789abcdef'); const sid1 = L1.jar.ranky_sid; assert.ok(!Object.hasOwn(db.sessions, sid1) && Object.hasOwn(db.sessions, sha256(sid1)), 'store keeps only sha256(id)');
  const sch = good.h.getSetCookie().find(c => c.startsWith('ranky_sid=')); assert.match(sch, /HttpOnly/); assert.match(sch, /SameSite=Lax/); assert.match(sch, /Path=\//);
  const old = { ...L1.jar }; const again = await L1.post('/api/auth/login', { email: 'new@t.test', password: PW, next: '/he/account' }); assert.equal(again.j.next, '/he/account'); assert.notEqual(L1.jar.ranky_sid, old.ranky_sid, 'rotated on login');
  const stale = browser(); stale.jar.ranky_sid = old.ranky_sid; assert.equal((await stale.me()).signedIn, false, 'previous id destroyed');
  await L1.me(); assert.equal((await L1.post('/api/auth/logout', {})).s, 403, 'logout needs CSRF'); assert.equal((await L1.post('/api/auth/logout', {}, { headers: { 'X-CSRF-Token': L1.csrf } })).s, 200);
  const after = browser(); after.jar.ranky_sid = sid1; assert.equal((await L1.me()).signedIn, false); assert.equal(Object.keys(db.sessions).some(k => k === sha256(again.h.getSetCookie()[0].split(';')[0].split('=')[1])), false, 'logout wiped the server row');
  ok('login: same 401 for unknown email / wrong password; fresh session id on every login (attacker-set and previous ids dead); HttpOnly+SameSite=Lax; next validated; logout (CSRF) deletes the server row');

  // 5) per-email login limit, reset limits
  for (let i = 0; i < 4; i++) assert.equal((await browser().post('/api/auth/login', { email: 'victim@t.test', password: 'wrong password ' + i })).s, 401);
  const lim = await browser().post('/api/auth/login', { email: 'victim@t.test', password: 'wrong password x' }); assert.equal(lim.s, 429); assert.equal(lim.j.code, 'rate_limited'); assert.ok(lim.h.get('retry-after'));
  assert.equal((await browser().post('/api/auth/login', { email: 'other@t.test', password: 'wrong password x' })).s, 401, 'other emails unaffected');
  for (let i = 0; i < 3; i++) assert.equal((await browser().post('/api/auth/reset-request', { email: 'spam@t.test' })).s, 200); assert.equal((await browser().post('/api/auth/reset-request', { email: 'spam@t.test' })).s, 429);
  R.authLimiters.signup.reset(); for (let i = 0; i < 6; i++) assert.equal((await browser().post('/api/auth/signup', { email: `s${i}@t.test`, password: PW })).s, 200);
  const sl = await browser().post('/api/auth/signup', { email: 's9@t.test', password: PW }); assert.equal(sl.s, 429); assert.equal(sl.j.code, 'rate_limited'); R.authLimiters.signup.reset();
  ok('rate limits: login per email (IP limit separate, AUTH_LOGIN_MAX), reset per email, signup per IP (6th+1 refused); 429 rate_limited + Retry-After');

  // 6) reset: generic, single use, expiry, wipes sessions
  const p1 = browser(); await p1.post('/api/auth/login', { email: 'new@t.test', password: PW }); const p2 = browser(); await p2.post('/api/auth/login', { email: 'new@t.test', password: PW });
  const rq1 = await browser().post('/api/auth/reset-request', { email: 'new@t.test', lang: 'en' }), rq2 = await browser().post('/api/auth/reset-request', { email: 'ghost@t.test', lang: 'en' }); assert.deepEqual(rq1.j, rq2.j); assert.equal(rq1.s, rq2.s);
  const rl = lastLink('reset'); assert.match(rl.url, /\/en\/reset\?a=/);
  assert.equal((await browser().post('/api/auth/reset', { a: rl.a, t: rl.t, password: 'short' })).j.code, 'password_short', 'policy before consuming');
  const rs = browser(); const rr = await rs.post('/api/auth/reset', { a: rl.a, t: rl.t, password: PW2 }); assert.equal(rr.s, 200); assert.ok(rs.jar.ranky_sid);
  assert.equal((await browser().post('/api/auth/reset', { a: rl.a, t: rl.t, password: PW2 + 'x' })).s, 400, 'reset single use');
  assert.equal((await p1.me()).signedIn, false); assert.equal((await p2.me()).signedIn, false); assert.equal((await rs.me()).signedIn, true); assert.equal(await verifyPassword(a1.passwordHash, PW2), true);
  await browser().post('/api/auth/reset-request', { email: 'new@t.test' }); const rl2 = lastLink('reset'); a1.authTokens.reset.exp = Date.now() - 1; assert.equal((await browser().post('/api/auth/reset', { a: rl2.a, t: rl2.t, password: PW })).j.code, 'link_invalid', 'expired');
  ok('reset: identical answer for unknown emails; 30-min single-use token; expired refused; new password signs out every other session');

  // 7) set / change password from a magic-link session (existing paid account), CSRF + Origin
  const paid = { id: 'paid1', key: 'K'.repeat(40), email: 'paid@t.test', plan: 'starter', status: 'active', subscriptionRef: 'sr1', usage: {}, createdAt: new Date().toISOString() }; db.accounts[paid.id] = paid;
  db.businesses.pb = { id: 'pb', accountId: paid.id, name: 'Paid Biz', category: 'Plumber', city: 'Haifa', scanIds: [] };
  const link = new URL(issueMagicLink(paid, B)); const m = browser(); const mg = await m.req(link.pathname + link.search); assert.equal(mg.s, 302); assert.match(mg.h.get('location'), /^\/dashboard\/paid1\?key=/); assert.ok(m.jar.ranky_sid, 'magic link also starts a session');
  const mm = await m.me(); assert.equal(mm.account.hasPassword, false);
  assert.equal((await m.post('/api/auth/password', { password: PW })).j.code, 'csrf', 'no token');
  assert.equal((await m.post('/api/auth/password', { password: PW }, { headers: { 'X-CSRF-Token': m.csrf }, origin: 'https://evil.example' })).j.code, 'bad_origin');
  const sp = await m.post('/api/auth/password', { password: PW }, { headers: { 'X-CSRF-Token': m.csrf } }); assert.equal(sp.s, 200); assert.ok(paid.passwordHash);
  await m.me(); assert.equal((await m.post('/api/auth/password', { password: PW2 }, { headers: { 'X-CSRF-Token': m.csrf } })).j.code, 'invalid_credentials', 'change needs current password');
  const other = browser(); await other.post('/api/auth/login', { email: 'paid@t.test', password: PW });
  assert.equal((await m.post('/api/auth/password', { current: PW, password: PW2 }, { headers: { 'X-CSRF-Token': m.csrf } })).s, 200); assert.equal((await other.me()).signedIn, false, 'other sessions wiped'); assert.equal((await m.me()).signedIn, true, 'this browser gets a fresh session');
  assert.equal((await browser().post('/api/auth/login', { email: 'paid@t.test', password: PW2 })).s, 200);
  ok('existing paid account: magic link → session → set password (CSRF token + Origin required) → change needs current password and wipes other sessions');

  // 8) dashboard + paid /scan guard: session or legacy key
  const k = browser(); await k.req('/api/dashboard/paid1'); assert.equal((await k.req('/api/dashboard/paid1')).s, 403, 'no auth');
  assert.equal((await k.req('/api/dashboard/paid1', { headers: { 'x-dashboard-key': paid.key } })).s, 200, 'legacy key still works');
  assert.equal((await m.req('/api/dashboard/paid1')).j.account.id, 'paid1', 'session works'); assert.equal((await m.req('/api/dashboard/' + a1.id)).s, 403, 'session for another account refused');
  { const dj = (await m.req('/api/dashboard/paid1')).j; assert.ok('insights' in dj, 'insights via session'); assert.equal((await m.req('/api/dashboard/' + a1.id)).j.insights, undefined, 'no insights for other account');
    const csv = await m.req('/api/dashboard/paid1/export.csv?businessId=pb'); assert.equal(csv.s, 200, 'CSV via session'); assert.match(csv.h.get('content-type'), /text\/csv/);
    assert.equal((await browser().req('/api/dashboard/paid1/export.csv?businessId=pb')).s, 403, 'CSV needs auth'); assert.equal((await m.req('/api/dashboard/' + a1.id + '/export.csv?businessId=pb')).s, 403, 'CSV: session of another account refused');
    const ob = Object.values(getDb().businesses).find(b => b.accountId !== 'paid1'); if (ob) assert.equal((await m.req('/api/dashboard/paid1/export.csv?businessId=' + ob.id)).s, 404, 'CSV: other account business refused'); }
  ok('v2-release: dashboard insights + CSV export via session; A cannot read B through session');
  await m.me(); assert.equal((await m.post('/api/dashboard/paid1/rescan', { businessId: 'pb' })).s, 403, 'cookie-only POST without CSRF refused');
  assert.equal((await m.post('/api/dashboard/paid1/rescan', { businessId: 'pb' }, { headers: { 'X-CSRF-Token': m.csrf }, origin: 'https://evil.example' })).s, 403);
  assert.equal((await m.post('/api/dashboard/paid1/rescan', { businessId: 'pb' }, { headers: { 'X-CSRF-Token': m.csrf } })).s, 200);
  assert.equal((await k.post('/api/dashboard/paid1/rescan', { businessId: 'pb' }, { headers: { 'x-dashboard-key': paid.key }, origin: null })).s, 200, 'legacy key route unchanged');
  const bareOut = await browser().req('/he/dashboard'); assert.equal(bareOut.s, 302); assert.match(bareOut.h.get('location'), /^\/he\/login\?next=/); assert.equal((await m.req('/en/dashboard')).h.get('location'), '/en/dashboard/paid1');
  const scanB = { name: 'Another Biz', category: 'Plumber', city: 'Haifa', email: 'paid@t.test', lang: 'he' };
  assert.equal((await browser().post('/api/scan', scanB)).j.code, 'login_required'); assert.equal((await m.post('/api/scan', scanB)).j.code, 'login_required', 'session without CSRF token does not unlock a paid scan');
  assert.equal((await m.post('/api/scan', scanB, { headers: { 'X-CSRF-Token': m.csrf } })).s, 200, 'session + CSRF');
  assert.equal((await browser().post('/api/scan', { ...scanB, name: 'Third' }, { headers: { 'x-account-id': 'paid1', 'x-dashboard-key': paid.key } })).s, 200, 'legacy key');
  assert.equal((await rs.me(), await rs.post('/api/scan', { ...scanB, name: 'Fourth' }, { headers: { 'X-CSRF-Token': rs.csrf } })).j.code, 'login_required', 'session of a different account');
  ok('dashboard API + paid-account login_required guard accept a session (CSRF on writes) or the legacy key; bare /{lang}/dashboard → own dashboard or login');

  // 9) Google sign-in (mocked endpoints)
  assert.equal((await browser().req('/auth/google')).s, 404, 'feature off: 404'); assert.equal((await browser().req('/api/config')).j.googleAuth, false);
  process.env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  assert.equal((await browser().req('/api/config')).j.googleAuth, true); assert.equal((await browser().req('/api/auth/me')).j.google, true);
  const claims = (o = {}) => ({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: 'g-123', email: 'paid@t.test', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000), ...o });
  async function gflow(o, { key, tamperState, next } = {}) { const g = browser(); const s = await g.req('/auth/google?lang=he' + (next ? '&next=' + encodeURIComponent(next) : '')); assert.equal(s.s, 302); const au = new URL(s.h.get('location'));
    const st = au.searchParams.get('state'), nonce = au.searchParams.get('nonce'); nextIdToken = b => { assert.equal(b.get('code_verifier') && crypto.createHash('sha256').update(b.get('code_verifier')).digest('base64url'), au.searchParams.get('code_challenge')); return jwt(claims({ nonce, ...o }), key); };
    const cb = await g.req(`/auth/google/callback?code=abc&state=${encodeURIComponent(tamperState ? st + 'x' : st)}`); return { g, cb, au, st }; }
  const f1 = await gflow({}); assert.equal(f1.au.origin + f1.au.pathname, 'https://google.test/auth'); assert.equal(f1.au.searchParams.get('code_challenge_method'), 'S256'); assert.equal(f1.au.searchParams.get('redirect_uri'), `${B.replace('127.0.0.1', '127.0.0.1')}/auth/google/callback`.replace(B, process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`)); assert.equal(f1.au.searchParams.get('scope'), 'openid email profile');
  assert.equal(f1.cb.s, 302); assert.equal(f1.cb.h.get('location'), '/he/dashboard/paid1'); assert.equal(paid.googleSub, 'g-123'); assert.equal((await f1.g.me()).account.googleLinked, true); assert.equal(tokenCalls.at(-1).client_secret, 'test-google-secret');
  const replay = await f1.g.req(`/auth/google/callback?code=abc&state=${encodeURIComponent(f1.st)}`); assert.match(replay.h.get('location'), /error=google_state/, 'state is single use');
  assert.match((await gflow({}, { tamperState: true })).cb.h.get('location'), /error=google_state/);
  assert.match((await gflow({ nonce: 'wrong-nonce-wrong-nonce-wrong-no' })).cb.h.get('location'), /error=google_failed/, 'nonce');
  assert.match((await gflow({}, { key: evil })).cb.h.get('location'), /error=google_failed/, 'signature');
  assert.match((await gflow({ aud: 'someone-else' })).cb.h.get('location'), /error=google_failed/, 'aud');
  assert.match((await gflow({ iss: 'https://evil.example' })).cb.h.get('location'), /error=google_failed/, 'iss');
  assert.match((await gflow({ exp: Math.floor(Date.now() / 1000) - 3600 })).cb.h.get('location'), /error=google_failed/, 'exp');
  const unv = await gflow({ sub: 'g-999', email: 'new@t.test', email_verified: false }); assert.match(unv.cb.h.get('location'), /error=google_unverified/); assert.equal(a1.googleSub, undefined, 'not linked when unverified'); assert.equal(unv.g.jar.ranky_sid, undefined);
  const fresh = await gflow({ sub: 'g-777', email: 'Brand.New@t.test' }, { next: '/he/account' }); assert.equal(fresh.cb.h.get('location'), '/he/account'); const na = Object.values(db.accounts).find(x => x.email === 'brand.new@t.test'); assert.ok(na && na.googleSub === 'g-777' && na.plan === 'free' && na.key.length >= 32);
  assert.equal((await gflow({ sub: 'g-123', email: 'changed@t.test', email_verified: false })).cb.h.get('location'), '/he/dashboard/paid1', 'known subject signs in even if the email changed');
  assert.match((await browser().req('/auth/google/callback?code=abc&state=x')).h.get('location'), /error=google_state/, 'no cookie');
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; assert.equal((await browser().req('/auth/google/callback?code=a&state=b')).s, 404);
  ok('Google: code + PKCE(S256) + state cookie + nonce; RS256 id_token checked (sig, iss, aud, exp, nonce); links by verified email only, by subject afterwards; creates free account; feature-off → 404 + flag false');

  // 10) pages, CSP, persistence, logs
  for (const p of ['/he/login', '/en/login', '/he/signup', '/en/signup', '/he/reset', '/en/reset', '/he/verify', '/he/account', '/en/account']) { const r = await browser().req(p); assert.equal(r.s, 200, p); const c = r.h.get('content-security-policy'); assert.match(c, /default-src 'none'/, p); assert.doesNotMatch(c, /script-src[^;]*unsafe-inline/, p); assert.equal(r.h.get('cache-control'), 'no-store'); assert.equal(r.h.get('x-robots-tag'), 'noindex, nofollow', p); }
  assert.match((await browser().req('/he/login')).txt, /dir="rtl"/);
  await flush(); const disk = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); assert.ok(Object.keys(disk.sessions).length >= 1); assert.ok(Object.values(disk.sessions).every(s => s.accountId && s.exp > Date.now() && s.csrf));
  const blob = logs.join('\n'); for (const s of [PW, PW2, 'new@t.test', 'paid@t.test', v.t, rl.t, paid.key, 'test-google-secret']) assert.ok(!blob.includes(s), 'never logged: ' + s.slice(0, 3));
  ok('login/signup/reset/verify/account pages: strict CSP (no unsafe-inline scripts), no-store, noindex; sessions persisted (hash ids); no passwords/emails/tokens/secrets in logs');

  // 11) Postgres: sessions migration appended + round trip
  const { newDb } = await import('pg-mem'); const P = await import('../src/store-pg.js'); const mem = newDb(); const { Pool } = mem.adapters.createPg();
  assert.match(P.MIGRATIONS.at(-2), /CREATE TABLE IF NOT EXISTS sessions/); const st = await P.createPgStore('postgres://u@h/db?sslmode=disable', { Pool }); st.db().sessions.abc = { accountId: 'x', exp: 1 }; await st.save();
  const st2 = await P.createPgStore('postgres://u@h/db?sslmode=disable', { Pool }); assert.deepEqual(st2.db().sessions, { abc: { accountId: 'x', exp: 1 } }); delete st2.db().sessions.abc; await st2.save(); assert.deepEqual((await P.createPgStore('postgres://u@h/db?sslmode=disable', { Pool })).db().sessions, {});
  ok('Postgres: sessions table from an appended migration (PG_AUTO_MIGRATE), save/reload/delete round-trip');
} finally { srv.close(); globalThis.fetch = realFetch; }
TD.done(); console.log(`ALL AUTH TESTS PASSED (${n})`); process.exit(0);
