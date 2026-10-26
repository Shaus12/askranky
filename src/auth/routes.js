// Email + password accounts, real sessions, CSRF and Google sign-in (OIDC code + PKCE). Mounted by server.js via registerAuth().
// Magic links and the legacy x-dashboard-key keep working alongside (transition period).
// Responses never say whether an email has an account; nothing here logs passwords, tokens or email addresses.
import { createRateLimiter } from '../security/ratelimit.js'; import { token, sha256, safeEqual } from '../security/tokens.js';
import { hashPassword, verifyPassword, passwordProblem } from './password.js';
import { createSessionStore, sessionCookieName, cookieAttrs, readCookie, sameOrigin, safeNext, SESSION_TTL_MS, secureCookies } from './session.js';
import { googleEnabled, startAuth, exchangeCode, verifyIdToken } from './google.js';
export const VERIFY_TTL_MS = 24 * 3600e3, RESET_TTL_MS = 30 * 60e3;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const normEmail = v => { const e = String(v ?? '').trim().toLowerCase(); return e.length <= 200 && EMAIL_RE.test(e) ? e : null; };
const L = v => (v === 'he' ? 'he' : 'en');
// Single-use, expiring, hash-only tokens on the account (same scheme as the magic link): a.authTokens[purpose] = { hash, exp }.
export function issueToken(a, purpose, ttl, now = Date.now()) { const t = token(32); (a.authTokens ||= {})[purpose] = { hash: sha256(t), exp: now + ttl }; return t; }
export function consumeToken(a, purpose, t, now = Date.now()) { const m = a?.authTokens?.[purpose]; if (!m || typeof t !== 'string' || t.length > 100 || now > m.exp || !safeEqual(sha256(t), m.hash)) return false; delete a.authTokens[purpose]; return true; }
const limiter = (envKey, max, windowMs, keyFn) => createRateLimiter({ max: Number(process.env[envKey] || max), windowMs, ...(keyFn ? { keyFn } : {}),
  onLimit: (q, r, retry) => r.status(429).json({ ok: false, error: 'rate_limited', code: 'rate_limited', retryAfter: retry }) });
export const authLimiters = {
  loginIp: limiter('AUTH_LOGIN_MAX', 10, 15 * 60e3), loginEmail: limiter('AUTH_LOGIN_EMAIL_MAX', 8, 15 * 60e3, q => 'e:' + (normEmail(q.body?.email) || '-')),
  signup: limiter('AUTH_SIGNUP_MAX', 5, 3600e3), reset: limiter('AUTH_RESET_MAX', 5, 3600e3), resetEmail: limiter('AUTH_RESET_EMAIL_MAX', 3, 3600e3, q => 'e:' + (normEmail(q.body?.email) || '-')),
  token: limiter('AUTH_TOKEN_MAX', 20, 15 * 60e3), google: limiter('AUTH_GOOGLE_MAX', 30, 15 * 60e3), password: limiter('AUTH_PASSWORD_MAX', 10, 15 * 60e3),
};
export function registerAuth(app, { getDb, save, id, BASE, sendEmail, renderTx, captcha }) {
  const sessions = createSessionStore({ getDb, save }); const SID = sessionCookieName(BASE); const GST = secureCookies(BASE) ? '__Host-ranky_gstate' : 'ranky_gstate';
  const accounts = () => getDb().accounts; const byId = i => (Object.hasOwn(accounts(), String(i)) ? accounts()[String(i)] : null);
  const byEmail = e => Object.values(accounts()).find(x => x.email === e) || null;
  const setCookie = (r, name, val, ms) => r.append('Set-Cookie', `${name}=${encodeURIComponent(val)}; ${cookieAttrs(BASE, ms)}`);
  // Load the session (read-only) for every request.
  app.use((q, r, next) => { const sid = readCookie(q, SID); q.session = sid ? sessions.get(sid) : null; if (q.session && !byId(q.session.accountId)) q.session = null; q.sid = q.session ? sid : null; next(); });
  // Login: always a brand-new id (fixation), any prior session id in the browser destroyed.
  function startSession(q, r, a, via) { if (q.sid) sessions.destroy(q.sid); const sid = sessions.create(a.id, { via }); setCookie(r, SID, sid, SESSION_TTL_MS); q.session = sessions.get(sid); q.sid = sid; return sid; }
  const originGuard = (q, r, next) => sameOrigin(q, BASE) === false ? r.status(403).json({ ok: false, error: 'bad_origin', code: 'bad_origin' }) : next();
  const csrfOk = q => sameOrigin(q, BASE) !== false && sessions.csrfOk(q.session, String(q.get('x-csrf-token') ?? q.body?.csrf ?? ''));
  const needSession = (q, r, next) => !q.session ? r.status(401).json({ ok: false, error: 'not_signed_in', code: 'not_signed_in' }) : !csrfOk(q) ? r.status(403).json({ ok: false, error: 'csrf', code: 'csrf' }) : next();
  const noStore = (q, r, next) => { r.set('Cache-Control', 'no-store'); r.set('Referrer-Policy', 'no-referrer'); next(); };
  const mail = (a, kind, lang, vars) => sendEmail({ to: a.email, ...renderTx(kind, lang, vars) }).catch(() => {});
  const link = (path, a, t, lang) => `${BASE}/${lang}/${path}?a=${encodeURIComponent(a.id)}&t=${encodeURIComponent(t)}`;
  const dashFor = (a, lang) => `/${lang}/dashboard/${encodeURIComponent(a.id)}`;
  const newAccount = email => { const a = { id: id(10), key: token(32), email, plan: 'free', createdAt: new Date().toISOString(), usage: {} }; accounts()[a.id] = a; return a; };
  const GENERIC = { ok: true, message: 'If the details are valid, we sent you an email. Check your inbox.' };
  app.use('/api/auth', noStore);

  app.get('/api/auth/me', (q, r) => { const a = q.session && byId(q.session.accountId);
    if (!a) return r.json({ signedIn: false, google: googleEnabled() });
    r.json({ signedIn: true, google: googleEnabled(), csrf: q.session.csrf, account: { id: a.id, email: a.email, plan: a.plan, hasPassword: !!a.passwordHash, googleLinked: !!a.googleSub } }); });

  app.post('/api/auth/signup', originGuard, authLimiters.signup, captcha, async (q, r) => {
    const email = normEmail(q.body?.email), pw = q.body?.password, lang = L(q.body?.lang);
    if (!email) return r.status(400).json({ ok: false, error: 'email_invalid', code: 'email_invalid' });
    const prob = passwordProblem(pw); if (prob) return r.status(400).json({ ok: false, error: prob, code: prob });
    const h = await hashPassword(pw); let a = byEmail(email);
    if (a?.passwordHash) { const t = issueToken(a, 'reset', RESET_TTL_MS); await save(); await mail(a, 'exists', lang, { link: `${BASE}/${lang}/login`, resetLink: link('reset', a, t, lang) }); return r.json(GENERIC); }
    a ||= newAccount(email); a.pendingPassword = { ...h, at: new Date().toISOString() }; const t = issueToken(a, 'verify', VERIFY_TTL_MS); await save();
    await mail(a, 'verify', lang, { link: link('verify', a, t, lang) }); r.json(GENERIC); });

  app.post('/api/auth/verify', originGuard, authLimiters.token, async (q, r) => {
    const a = byId(q.body?.a); const lang = L(q.body?.lang);
    if (!a || !a.pendingPassword || !consumeToken(a, 'verify', q.body?.t)) return r.status(400).json({ ok: false, error: 'link_invalid', code: 'link_invalid' });
    const { at, ...h } = a.pendingPassword; a.passwordHash = h; a.passwordSetAt = new Date().toISOString(); a.emailVerified = true; delete a.pendingPassword;
    sessions.destroyAllFor(a.id); startSession(q, r, a, 'verify'); await save(); r.json({ ok: true, next: dashFor(a, lang) }); });

  app.post('/api/auth/login', originGuard, authLimiters.loginIp, authLimiters.loginEmail, captcha, async (q, r) => {
    const email = normEmail(q.body?.email), lang = L(q.body?.lang); const a = email ? byEmail(email) : null;
    const good = await verifyPassword(a?.passwordHash, typeof q.body?.password === 'string' ? q.body.password : '');
    if (!good) { if (a && !a.passwordHash && a.pendingPassword && await verifyPassword(a.pendingPassword, q.body?.password)) return r.status(403).json({ ok: false, error: 'email_unverified', code: 'email_unverified' });
      return r.status(401).json({ ok: false, error: 'invalid_credentials', code: 'invalid_credentials' }); }
    authLimiters.loginEmail.refund(q); startSession(q, r, a, 'password'); a.lastLoginAt = new Date().toISOString(); await save();
    r.json({ ok: true, next: safeNext(q.body?.next, dashFor(a, lang)) }); });

  app.post('/api/auth/logout', originGuard, (q, r) => { if (q.session && !csrfOk(q)) return r.status(403).json({ ok: false, error: 'csrf', code: 'csrf' });
    if (q.sid) sessions.destroy(q.sid); setCookie(r, SID, '', 0); r.json({ ok: true }); });

  app.post('/api/auth/reset-request', originGuard, authLimiters.reset, authLimiters.resetEmail, captcha, async (q, r) => {
    const email = normEmail(q.body?.email), lang = L(q.body?.lang); const a = email ? byEmail(email) : null;
    if (a) { const t = issueToken(a, 'reset', RESET_TTL_MS); await save(); await mail(a, 'reset', lang, { link: link('reset', a, t, lang) }); }
    r.json(GENERIC); });

  app.post('/api/auth/reset', originGuard, authLimiters.token, async (q, r) => {
    const a = byId(q.body?.a), lang = L(q.body?.lang); const prob = passwordProblem(q.body?.password); if (prob) return r.status(400).json({ ok: false, error: prob, code: prob });
    if (!a || !consumeToken(a, 'reset', q.body?.t)) return r.status(400).json({ ok: false, error: 'link_invalid', code: 'link_invalid' });
    a.passwordHash = await hashPassword(q.body.password); a.passwordSetAt = new Date().toISOString(); a.emailVerified = true; delete a.pendingPassword; delete a.magic;
    sessions.destroyAllFor(a.id); startSession(q, r, a, 'reset'); await save(); r.json({ ok: true, next: dashFor(a, lang) }); });

  // Set (first time, e.g. a paid account that arrived by magic link) or change the password. Changing needs the current one.
  app.post('/api/auth/password', originGuard, needSession, authLimiters.password, async (q, r) => {
    const a = byId(q.session.accountId); const prob = passwordProblem(q.body?.password); if (prob) return r.status(400).json({ ok: false, error: prob, code: prob });
    if (a.passwordHash && !(await verifyPassword(a.passwordHash, q.body?.current))) return r.status(401).json({ ok: false, error: 'invalid_credentials', code: 'invalid_credentials' });
    authLimiters.password.refund(q); a.passwordHash = await hashPassword(q.body.password); a.passwordSetAt = new Date().toISOString(); delete a.pendingPassword;
    sessions.destroyAllFor(a.id); startSession(q, r, a, 'password_change'); await save(); r.json({ ok: true, csrf: q.session.csrf }); });

  // Bare dashboard URLs: the signed-in account's dashboard, else the login page.
  const bareDash = lang => (q, r) => { r.set('Cache-Control', 'no-store'); const a = q.session && byId(q.session.accountId); r.redirect(a ? dashFor(a, lang) : `/${lang}/login?next=${encodeURIComponent(`/${lang}/dashboard`)}`); };
  app.get(['/he/dashboard', '/he/dashboard/'], bareDash('he')); app.get(['/en/dashboard', '/en/dashboard/'], bareDash('en'));

  // ---------- Google ----------
  const gStates = new Map(); const GSTATE_TTL = 10 * 60e3;
  const gGate = (q, r, next) => (googleEnabled() ? next() : next('route'));
  app.get('/auth/google', gGate, authLimiters.google, (q, r) => {
    const lang = L(q.query.lang); const s = startAuth(BASE); const now = Date.now();
    for (const [k, v] of gStates) if (v.exp < now) gStates.delete(k); if (gStates.size > 5000) gStates.clear();
    gStates.set(sha256(s.state), { nonce: s.nonce, verifier: s.verifier, lang, next: safeNext(q.query.next, null), exp: now + GSTATE_TTL });
    r.set('Cache-Control', 'no-store'); r.set('Referrer-Policy', 'no-referrer'); setCookie(r, GST, s.state, GSTATE_TTL); r.redirect(s.url); });
  app.get('/auth/google/callback', gGate, authLimiters.google, async (q, r) => {
    r.set('Cache-Control', 'no-store'); r.set('Referrer-Policy', 'no-referrer'); const cookieState = readCookie(q, GST); setCookie(r, GST, '', 0);
    const st = String(q.query.state || ''); const rec = st && cookieState && safeEqual(st, cookieState) ? gStates.get(sha256(st)) : null; if (rec) gStates.delete(sha256(st));
    const fail = (lang, code) => r.redirect(`/${lang}/login?error=${code}`);
    if (!rec || rec.exp < Date.now()) return fail('en', 'google_state');
    if (q.query.error || !q.query.code) return fail(rec.lang, 'google_cancelled');
    let c; try { c = await verifyIdToken(await exchangeCode(q.query.code, rec.verifier, BASE), { nonce: rec.nonce }); } catch (e) { console.error(`[auth] google sign-in failed (${e?.message?.slice(0, 20) || 'error'})`); return fail(rec.lang, 'google_failed'); }
    let a = Object.values(accounts()).find(x => x.googleSub === String(c.sub)) || null;
    if (!a) { const email = c.email_verified === true || c.email_verified === 'true' ? normEmail(c.email) : null; if (!email) return fail(rec.lang, 'google_unverified');
      a = byEmail(email) || newAccount(email); a.googleSub = String(c.sub); a.emailVerified = true; delete a.pendingPassword; if (a.authTokens) delete a.authTokens.verify; }
    startSession(q, r, a, 'google'); a.lastLoginAt = new Date().toISOString(); await save(); r.redirect(rec.next || dashFor(a, rec.lang)); });

  return { sessions, csrfOk, startSession, sessionAccountId: q => q.session?.accountId || null };
}
