import express from 'express'; import fs from 'node:fs'; import path from 'node:path';
import { BRAND } from './src/brand.js'; import { PLANS, isPaid, CURRENCIES } from './src/plans.js'; import { detectCurrency, billingFor, publicPlans, usdBillingEnabled } from './src/currency.js';
import { getDb, save, id, BACKEND } from './src/store.js'; import { runScan } from './src/scan.js';
import { getPayments } from './src/payments/index.js'; import { renderWeeklyEmail } from './src/email/report.js'; import { sendEmail, emailIsMock } from './src/email/send.js';
import * as V from './src/views.js'; import { isMockMode } from './src/providers/index.js';
import { token, safeEqual, issueMagicLink, consumeMagic } from './src/security/tokens.js'; import { createRateLimiter } from './src/security/ratelimit.js';
import { verifyTurnstile, turnstileSiteKey } from './src/security/turnstile.js'; import { esc } from './src/security/html.js';
import { isPrelaunch } from './src/prelaunch.js'; import { billingPage, notFoundPage, langOf } from './src/pages.js'; import { robotsTxt, sitemapXml, llmsTxt, NOINDEX_PATH } from './src/seo.js';
import { renderTx } from './src/email/templates.js'; import { setConsent, verifyUnsubToken, unsubUrl, unsubHeaders } from './src/consent.js'; import { unsubscribePage } from './src/pages.js';
import { startBillingCron, ymd, syncAll } from './src/jobs/billing-sync.js'; import { LEGAL_DOCS, legalDoc, legalPageHtml } from './src/legal.js';

const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY); app.use(express.urlencoded({ extended: false })); app.use(express.json()); // noindex on private pages (meta robots is also in the HTML; the header covers redirects and server-rendered pages).
// Which paths: NOINDEX_PATH in src/seo.js (the single source for robots.txt and these headers).
app.use((q, r, next) => { if (NOINDEX_PATH.test(q.path)) r.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
// Baseline security headers on every response. HSTS without `preload` (opt-in later, and it is hard to undo).
app.use((q, r, next) => { r.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); r.set('X-Content-Type-Options', 'nosniff'); next(); });
// OG/brand images change rarely: cache a day (+ a week stale-while-revalidate) instead of Express's default max-age=0.
app.use(express.static('public', { setHeaders: (res, file) => { if (/\/(?:og-[a-z]+|logo)\.png$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800'); } }));
const addMonth = d => { const x = new Date(d), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(Math.min(day, new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate())); return x; }; // clamps Jan 31 → Feb 28
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const freeScanIps = new Map();
const wantsJson = q => q.path.startsWith('/api/');
// Burst limiter on scan endpoints (in addition to the 3-free-scans-per-IP rule). Env: SCAN_RATE_MAX, SCAN_RATE_WINDOW_MS.
export const scanLimiter = createRateLimiter({ max: Number(process.env.SCAN_RATE_MAX || 5), windowMs: Number(process.env.SCAN_RATE_WINDOW_MS || 10 * 60 * 1000),
  onLimit: (q, r, retry) => wantsJson(q) ? r.status(429).json({ error: 'rate_limited', code: 'rate_limited', retryAfter: retry, message: `Too many scans. Try again in ${retry}s.` }) : r.status(429).send(V.landing(`Too many scans. Try again in ${retry}s.`)) });
export const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000, onLimit: (q, r, retry) => wantsJson(q) ? r.status(429).json({ error: 'rate_limited', code: 'rate_limited', retryAfter: retry, message: 'Too many requests' }) : r.status(429).send('Too many requests') });
// CAPTCHA failures are not counted against the scan/login limiters (the hit is refunded); instead they get their own looser
// limit so a bot can't hammer siteverify. Env: CAPTCHA_FAIL_MAX (default 30) per 10 minutes per IP.
export const captchaFailLimiter = createRateLimiter({ max: Number(process.env.CAPTCHA_FAIL_MAX || 30), windowMs: 10 * 60 * 1000,
  onLimit: (q, r, retry) => wantsJson(q) ? r.status(429).json({ error: 'rate_limited', code: 'rate_limited', retryAfter: retry, message: `Too many attempts. Try again in ${retry}s.` }) : r.status(429).send(V.landing(`Too many attempts. Try again in ${retry}s.`)) });
async function captcha(q, r, next) {
  const v = await verifyTurnstile(q.body?.['cf-turnstile-response'] || q.body?.turnstileToken, q.ip); if (v.ok) return next();
  scanLimiter.refund(q); loginLimiter.refund(q);
  // Stable code in `error`/`code` (clients localize it) + the English text in `message`.
  return captchaFailLimiter(q, r, () => wantsJson(q) ? r.status(403).json({ error: v.code, code: v.code, message: v.error }) : r.status(403).send(V.landing(v.error)));
}
const dashUrl = a => `/dashboard/${encodeURIComponent(a.id)}?key=${encodeURIComponent(a.key)}`;
async function emailMagicLink(a) {
  const link = issueMagicLink(a, BASE); await save();
  await sendEmail({ to: a.email, subject: `Your ${BRAND.name} dashboard link`, html: `<p>Open your ${esc(BRAND.name)} dashboard (link valid 15 minutes, single use):</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>If you didn't request this, ignore this email.</p>` });
}

// Optional marketing consent from the scan form (unchecked by default). Stored only when given, with timestamp, language
// and the notice version shown; scanning never requires it. Transactional report emails are sent regardless.
export const CONSENT_VERSION = 'scan-form-2026-10-22';
function recordConsent(a, body) {
  const v = body?.marketingConsent; if (!(v === true || v === 'on' || v === '1' || v === 'true')) return;
  setConsent(a, 'marketing', true, 'scan-form'); a.marketingConsent = { granted: true, at: a.marketingConsent.at, lang: body?.lang === 'he' ? 'he' : 'en', source: 'scan-form', version: CONSENT_VERSION };
  getDb().events.push({ at: a.marketingConsent.at, type: 'consent.marketing', account: a.id, version: CONSENT_VERSION }); save();
}
async function sendReportEmail(account, business, scan, lang) { const u = unsubUrl(BASE, account, 'all', lang === 'he' ? 'he' : 'en');
  await sendEmail({ to: account.email, headers: unsubHeaders(u), subject: `Your ${BRAND.name} report: ${business.name} scored ${scan.summary.score}/100`, html: renderWeeklyEmail({ business, scan, reportUrl: `${BASE}/r/${scan.id}`, unsubscribeUrl: u }) }); }
// Admin-only test checkout while pre-launch: ADMIN_TEST_TOKEN via x-admin-test-token header (or ?admin_token=), compared
// timing-safe. Only ever with the mock payments provider, so no real card can be charged before launch.
export const adminTestOk = q => { const t = process.env.ADMIN_TEST_TOKEN; if (!t || t.length < 16 || getPayments().id !== 'mock') return false;
  const g = String(q.get('x-admin-test-token') || q.query?.admin_token || q.body?.adminToken || ''); return safeEqual(g, t); };
function findOrCreateAccount(email) {
  const db = getDb(); let a = Object.values(db.accounts).find(x => x.email === email.toLowerCase());
  if (!a) { a = { id: id(10), key: token(32), email: email.toLowerCase(), plan: 'free', createdAt: new Date().toISOString(), usage: {} }; db.accounts[a.id] = a; save(); }
  return a;
}

app.get('/health', (q, r) => r.json({ ok: true, brand: BRAND.name, mockScans: isMockMode(), payments: getPayments().id, prelaunch: isPrelaunch(), store: BACKEND }));
// Keep-warm for free hosting (cold starts): tiny, no DB or provider calls.
app.get('/healthz', (q, r) => r.set('Cache-Control', 'no-store').json({ ok: true }));
// External cron trigger (GitHub Actions / cron-job.org) for the daily billing sync, because the free Render plan has no cron.
// Disabled (404) unless CRON_SECRET (>= 16 chars) is set. Requires header X-Cron-Secret, compared timing-safe (sha256 + timingSafeEqual).
// Not behind the CAPTCHA. Only wrong-secret attempts are rate limited (CRON_FAIL_MAX per 15 min per IP). Concurrent runs are collapsed
// by an in-process lock (the second caller gets 202 {running:true}). The sync is idempotent. Responses never include sync data.
export const cronHooks = { sync: syncAll };
const cronFailLimiter = createRateLimiter({ max: Number(process.env.CRON_FAIL_MAX || 10), windowMs: 15 * 60 * 1000, onLimit: (q, r) => r.status(429).json({ ok: false }) });
let cronRunning = false;
app.post('/api/internal/cron/sync', async (q, r) => {
  r.set('Cache-Control', 'no-store'); const secret = process.env.CRON_SECRET || ''; if (secret.length < 16) return r.status(404).json({ ok: false });
  if (!safeEqual(String(q.get('x-cron-secret') || ''), secret)) return cronFailLimiter(q, r, () => r.status(401).json({ ok: false }));
  if (cronRunning) return r.status(202).json({ ok: true, running: true });
  cronRunning = true;
  try { await cronHooks.sync(); console.log('[cron] billing sync done'); return r.json({ ok: true, ranAt: new Date().toISOString() }); }
  catch (e) { console.error(`[cron] billing sync failed (${e?.name || 'Error'})`); return r.status(500).json({ ok: false }); }
  finally { cronRunning = false; }
});
app.get('/llms.txt', (q, r) => r.type('text/plain; charset=utf-8').send(llmsTxt()));
app.get('/robots.txt', (q, r) => r.type('text/plain').send(robotsTxt()));
app.get('/sitemap.xml', (q, r) => r.type('application/xml').send(sitemapXml()));
// Pre-launch waitlist: stores an email + language, never starts a payment.
app.post('/api/waitlist', loginLimiter, captcha, (q, r) => { const email = String(q.body?.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return r.status(400).json({ error: 'Enter a valid email.' });
  const db = getDb(); db.waitlist ||= []; if (!db.waitlist.some(w => w.email === email)) { db.waitlist.push({ email, lang: q.body?.lang === 'he' ? 'he' : 'en', plan: Object.hasOwn(PLANS, q.body?.plan) ? q.body.plan : null, at: new Date().toISOString() }); save(); }
  r.json({ ok: true }); });

app.post('/scan', scanLimiter, captcha, async (q, r) => {
  const { name, website, category, city, email } = q.body;
  if (!name || !category || !city || !email) return r.status(400).send(V.landing('Please fill all required fields.'));
  const ipCount = freeScanIps.get(q.ip) || 0; if (ipCount >= 3 && !process.env.DISABLE_IP_LIMIT) return r.status(429).send(V.landing('Free scan limit reached for today.'));
  const db = getDb(); const account = findOrCreateAccount(email); recordConsent(account, q.body);
  if (account.plan === 'free' && Object.values(db.businesses).some(b => b.accountId === account.id && b.scanIds?.length)) {
    const b = Object.values(db.businesses).find(b => b.accountId === account.id); return r.redirect(`/r/${b.scanIds.at(-1)}`);
  }
  const business = { id: id(10), accountId: account.id, name: name.trim(), website: website?.trim(), category: category.trim(), city: city.trim() };
  db.businesses[business.id] = business; save();
  try {
    const scan = await runScan(account, business); freeScanIps.set(q.ip, ipCount + 1);
    await sendReportEmail(account, business, scan, q.body?.lang);
    r.redirect(`/r/${scan.id}`);
  } catch (e) { r.status(e.code === 'CAP' ? 429 : e.code === 'NO_ENGINE' ? 503 : 500).send(V.landing(e.message)); }
});


// Server-side price lookup only: the client may name a plan and a display currency (ILS|USD), never an amount.
// The quote is frozen on the account at checkout start and re-checked against PLANS on return.
const displayCurrencyFor = q => { const c = String(q.body?.currency || '').toUpperCase(); return CURRENCIES.includes(c) ? c : detectCurrency(q, q.body?.lang).currency; };
// Pre-launch admin test checkouts (valid ADMIN_TEST_TOKEN, mock payments only) skip the CAPTCHA; everyone else is verified.
const captchaUnlessAdminTest = (q, r, next) => (isPrelaunch() && adminTestOk(q) ? next() : captcha(q, r, next));
async function startCheckout(q) {
  const adminTest = isPrelaunch() && adminTestOk(q); if (isPrelaunch() && !adminTest) return { prelaunch: true };
  const plan = Object.hasOwn(PLANS, q.body?.plan) ? PLANS[q.body.plan] : null; if (!isPaid(plan) || !q.body?.email) return null;
  const billing = billingFor(plan, displayCurrencyFor(q));
  const account = findOrCreateAccount(q.body.email); account.pendingPlan = plan.id; account.pendingBilling = billing; account.pendingLang = q.body?.lang === 'he' ? 'he' : q.body?.lang === 'en' ? 'en' : langOf(q); const state = account.checkoutState = token(24); if (adminTest) account.pendingAdminTest = true; else delete account.pendingAdminTest; save();
  const { redirectUrl } = await getPayments().createCheckout({ account, plan, billing, state, returnUrl: `${BASE}/billing/return?lang=${account.pendingLang}` }); return { redirectUrl, billing };
}
app.post('/checkout', captchaUnlessAdminTest, async (q, r) => { const c = await startCheckout(q); if (c?.prelaunch) return r.status(403).send(billingPage('prelaunch', q.body?.lang === 'he' || q.body?.lang === 'en' ? q.body.lang : langOf(q))); if (!c) return r.status(400).send('bad plan'); r.redirect(c.redirectUrl); });
app.get('/billing/return', async (q, r) => {
  const db = getDb(); const [accId, state] = String(q.query.Identifier || '').split('.'); const account = Object.hasOwn(db.accounts, accId) ? db.accounts[accId] : null;
  if (isPrelaunch() && !(account?.pendingAdminTest && getPayments().id === 'mock')) return r.status(403).send(billingPage('prelaunch', langOf(q)));
  if (!account || !account.checkoutState || !safeEqual(state, account.checkoutState)) return r.status(400).send(billingPage('invalid', langOf(q)));
  const plan = PLANS[account.pendingPlan || 'starter']; const lang = q.query.lang === 'he' || q.query.lang === 'en' ? q.query.lang : account.pendingLang || langOf(q);
  // Re-derive from PLANS (never trust stored/client amounts); keeps the currency chosen at checkout start.
  const billing = billingFor(plan, account.pendingBilling?.displayCurrency || 'ILS');
  try {
    const res = await getPayments().handleReturn(q.query, account, plan, billing);
    if (!res.ok) return r.send(billingPage('failed', lang, res.error));
    Object.assign(account, { plan: plan.id, subscriptionRef: res.subscriptionRef, paidAt: new Date().toISOString(), billing: { currency: billing.currency, amount: billing.amount }, status: 'active', lang, paidThrough: addMonth(new Date()).toISOString(), ...(account.pendingAdminTest ? { adminTest: true } : {}) }); delete account.cancelledAt; delete account.pendingAdminTest; delete account.pendingPlan; delete account.pendingBilling; delete account.checkoutState; delete account.pendingLang; save();
    db.events.push({ at: new Date().toISOString(), type: 'subscription.activated', account: account.id, plan: plan.id, currency: billing.currency, amount: billing.amount }); save();
    // Don't hand the dashboard key to whoever holds this URL: email a single-use magic link instead.
    await emailMagicLink(account);
    await sendEmail({ to: account.email, ...renderTx('receipt', lang, { planName: plan.name, amount: billing.amount, currency: billing.currency, paidThrough: ymd(account.paidThrough), receiptUrl: res.receiptUrl }) });
    r.send(billingPage('ok', lang));
  } catch (e) { r.status(502).send(billingPage('error', lang, e.message)); }
});
// Webhooks are rejected unless SUMIT_WEBHOOK_SECRET is set AND the request carries it (x-webhook-secret header or
// ?secret= in the trigger URL), compared timing-safe. Applies to every provider, mock included.
export const webhookAuthorized = q => { const s = process.env.SUMIT_WEBHOOK_SECRET || ''; if (s.length < 16) return false;
  return safeEqual(String(q.get('x-webhook-secret') || q.query?.secret || ''), s); };
app.post('/webhooks/payments', async (q, r) => { if (!webhookAuthorized(q)) return r.sendStatus(401); const res = await getPayments().handleWebhook(q.body, q.headers); if (!res.ok) return r.sendStatus(401); getDb().events.push({ at: new Date().toISOString(), ...res.event }); save(); r.sendStatus(200); });

const accountFor = q => { const db = getDb(); const a = Object.hasOwn(db.accounts, q.params.id) ? db.accounts[q.params.id] : null; return a && safeEqual(String(q.query.key ?? q.get('x-dashboard-key') ?? ''), a.key) ? a : null; };
function auth(q, r) { const a = accountFor(q); if (!a) { r.status(403).send('forbidden'); return null; } return a; }
// Magic-link login: always answers the same way so it can't be used to probe which emails exist.
async function login(q, r) { const email = String(q.body?.email || '').trim().toLowerCase(); const a = email && Object.values(getDb().accounts).find(x => x.email === email);
  if (a) await emailMagicLink(a); const msg = 'If that email has an account, we sent a sign-in link.'; return wantsJson(q) ? r.json({ ok: true, message: msg }) : r.send(V.message('Check your email', '', msg)); }
app.post('/login', loginLimiter, captcha, login); app.post('/api/login', loginLimiter, captcha, login);
app.get('/auth/magic', loginLimiter, (q, r) => { const db = getDb(); const a = Object.hasOwn(db.accounts, String(q.query.a)) ? db.accounts[q.query.a] : null;
  if (!a || !consumeMagic(a, q.query.t)) return r.status(403).send(V.message('Link expired', '', 'This sign-in link is invalid or already used. Request a new one.'));
  if (!a.key || a.key.length < 32) a.key = token(32); save(); r.set('Referrer-Policy', 'no-referrer'); r.redirect(dashUrl(a)); });
app.post('/dashboard/:id/rescan', async (q, r) => {
  const a = auth(q, r); if (!a) return; const b = Object.hasOwn(getDb().businesses, String(q.body.businessId)) ? getDb().businesses[q.body.businessId] : null; if (!b || b.accountId !== a.id) return r.sendStatus(404);
  try { await runScan(a, b); r.redirect(dashUrl(a)); } catch (e) { r.status(e.code === 'NO_ENGINE' ? 503 : 429).send(V.message('Scan not run', '', e.message)); }
});



// Self-serve cancel (dashboard key). Requires {confirm:true}; cancels the standing order via the payments adapter, keeps
// access until paidThrough, emails a written confirmation (Consumer Protection Law s.13D).
app.post('/api/dashboard/:id/cancel', async (q, r) => {
  const a = accountFor(q); if (!a) return r.status(403).json({ error: 'forbidden' });
  if (q.body?.confirm !== true) return r.status(400).json({ error: 'Confirmation required.' });
  if (a.plan === 'free' || !a.subscriptionRef) return r.status(400).json({ error: 'No active subscription.' });
  if (a.status === 'cancelled') return r.json({ ok: true, already: true, paidThrough: a.paidThrough });
  try { const res = await getPayments().cancel(a); if (!res?.ok) throw new Error('cancel failed'); } catch (e) { return r.status(502).json({ error: 'Could not cancel right now. Please try again or email ' + BRAND.supportEmail }); }
  const now = new Date(); a.status = 'cancelled'; a.cancelledAt = now.toISOString(); a.paidThrough ||= addMonth(a.paidAt || now).toISOString();
  getDb().events.push({ at: a.cancelledAt, type: 'subscription.cancelled', account: a.id, plan: a.plan, source: 'dashboard' }); save();
  const lang = q.body?.lang === 'he' ? 'he' : q.body?.lang === 'en' ? 'en' : a.lang || 'en';
  await sendEmail({ to: a.email, ...renderTx('cancel', lang, { planName: PLANS[a.plan].name, cancelDate: ymd(now), paidThrough: ymd(a.paidThrough), currency: a.billing?.currency }) });
  r.json({ ok: true, paidThrough: a.paidThrough });
});
// Unsubscribe: GET shows a confirm page (so mail scanners prefetching the link don't unsubscribe); POST performs it.
// POST also serves RFC 8058 one-click (List-Unsubscribe-Post). Token = HMAC-signed account id + channel.
const unsubAccount = t => { const v = verifyUnsubToken(t); const db = getDb(); return v && Object.hasOwn(db.accounts, v.accountId) ? { a: db.accounts[v.accountId], channel: v.channel } : null; };
app.use('/unsubscribe', (q, r, next) => { r.set('X-Robots-Tag', 'noindex, nofollow'); r.set('Referrer-Policy', 'no-referrer'); r.set('Cache-Control', 'no-store'); next(); });
app.get('/unsubscribe', (q, r) => { const u = unsubAccount(q.query.t); r.status(u ? 200 : 400).send(unsubscribePage(u ? 'confirm' : 'invalid', langOf(q), String(q.query.t || ''))); });
app.post('/unsubscribe', loginLimiter, (q, r) => { const t = q.query.t || q.body?.t; const u = unsubAccount(t); if (!u) return r.status(400).send(unsubscribePage('invalid', langOf(q)));
  setConsent(u.a, u.channel, false, q.body?.['List-Unsubscribe'] === 'One-Click' ? 'one-click' : 'unsubscribe-page'); getDb().events.push({ at: new Date().toISOString(), type: 'consent.optout', account: u.a.id, channel: u.channel }); save();
  r.send(unsubscribePage('done', langOf(q))); });

// ---------- JSON API for the Next.js frontend (web/) ----------
const pub = a => ({ id: a.id, email: a.email, plan: a.plan, active: !!a.subscriptionRef && a.status !== 'cancelled', status: a.status || (a.subscriptionRef ? 'active' : null), paidThrough: a.paidThrough || null, cancelledAt: a.cancelledAt || null });
app.get('/api/config', (q, r) => r.json({ brand: BRAND, plans: publicPlans(), usdBilling: usdBillingEnabled(), mock: isMockMode(), prelaunch: isPrelaunch(), emailMock: emailIsMock(), turnstileSiteKey: turnstileSiteKey() }));
app.post('/api/scan', scanLimiter, captcha, async (q, r) => {
  const { name, website, category, city, email } = q.body || {};
  if (!name || !category || !city || !email) return r.status(400).json({ error: 'Please fill all required fields.' });
  const ipCount = freeScanIps.get(q.ip) || 0; if (ipCount >= 3 && !process.env.DISABLE_IP_LIMIT) return r.status(429).json({ error: 'free_limit_reached', code: 'free_limit_reached', message: 'Free scan limit reached for today.' });
  const db = getDb(); const account = findOrCreateAccount(email); recordConsent(account, q.body);
  const existing = Object.values(db.businesses).find(b => b.accountId === account.id && b.scanIds?.length);
  if (account.plan === 'free' && existing) return r.json({ reportId: existing.scanIds.at(-1), existing: true });
  const business = { id: id(10), accountId: account.id, name: name.trim(), website: website?.trim(), category: category.trim(), city: city.trim() };
  db.businesses[business.id] = business; save();
  try {
    const scan = await runScan(account, business); freeScanIps.set(q.ip, ipCount + 1);
    await sendReportEmail(account, business, scan, q.body?.lang);
    r.json({ reportId: scan.id });
  } catch (e) { if (e.code === 'NO_ENGINE') return r.status(503).json({ error: 'scan_unavailable', code: 'scan_unavailable', message: e.message }); r.status(e.code === 'CAP' ? 429 : 500).json({ error: q.body?.lang === 'he' && e.he ? e.he : e.message }); }
});
app.get('/api/report/:id', (q, r) => { const db = getDb(); const s = db.scans[q.params.id]; if (!s) return r.status(404).json({ error: 'not found' });
  const b = db.businesses[s.businessId]; const hist = (b.scanIds || []).map(i => db.scans[i]).filter(Boolean); const idx = hist.findIndex(x => x.id === s.id);
  r.json({ demo: !!s.mock || isPrelaunch(), business: { name: b.name, category: b.category, city: b.city, website: b.website }, scan: s, previousScore: idx > 0 ? hist[idx - 1].summary.score : null, history: hist.slice(0, idx + 1).map(x => x.summary.score) }); });
app.post('/api/checkout', captchaUnlessAdminTest, async (q, r) => { const c = await startCheckout(q); if (c?.prelaunch) return r.status(403).json({ error: 'Pre-launch: checkout is not open yet. Join the waitlist.', prelaunch: true }); if (!c) return r.status(400).json({ error: 'Choose a plan and enter your email.' }); r.json(c); });
// Pricing for the UI: detected display currency + server prices + what checkout will actually charge.
app.get('/api/pricing', (q, r) => {
  const forced = String(q.query.currency || '').toUpperCase(); const d = CURRENCIES.includes(forced) ? { currency: forced, source: 'query' } : detectCurrency(q, q.query.lang);
  r.set('Vary', 'Cookie, Accept-Language, CF-IPCountry'); r.set('Cache-Control', 'private, no-store');
  r.json({ currency: d.currency, source: d.source, currencies: CURRENCIES, usdBilling: usdBillingEnabled(), vat: false,
    plans: publicPlans().map(p => ({ ...p, billing: p.prices.ILS ? billingFor(PLANS[p.id], d.currency) : null })) });
});
app.get('/api/dashboard/:id', (q, r) => {
  const a = accountFor(q); if (!a) return r.status(403).json({ error: 'forbidden' }); const db = getDb();
  const biz = Object.values(db.businesses).filter(b => b.accountId === a.id).map(b => ({ ...b, scans: (b.scanIds || []).map(i => db.scans[i]).filter(Boolean).map(s => ({ id: s.id, at: s.at, summary: s.summary })) }));
  r.json({ account: pub(a), businesses: biz, usage: { used: a.usage?.[new Date().toISOString().slice(0, 7)] || 0, cap: PLANS[a.plan].monthlyCheckBudget } });
});
app.post('/api/dashboard/:id/rescan', async (q, r) => {
  const a = accountFor(q); if (!a) return r.status(403).json({ error: 'forbidden' });
  const b = Object.hasOwn(getDb().businesses, String(q.body?.businessId)) ? getDb().businesses[q.body.businessId] : null; if (!b || b.accountId !== a.id) return r.status(404).json({ error: 'not found' });
  try { const s = await runScan(a, b); r.json({ reportId: s.id }); } catch (e) { if (e.code === 'NO_ENGINE') return r.status(503).json({ error: 'scan_unavailable', code: 'scan_unavailable', message: e.message }); r.status(429).json({ error: e.message }); }
});
// Legal docs in legal/*.md (Hebrew: *.he.md). Whitelisted names only (COMPLIANCE-NOTES.md is internal and never served).
// Docs are pre-filled; known {{KEY}} placeholders are still substituted (Hebrew files get the Hebrew entity/address), and
// any other {{KEY}} renders as "[KEY]" (or env LEGAL_KEY) so it is visible but never leaks template syntax.
export { LEGAL_DOCS };
function legal(q, r, doc, lang) { const d = legalDoc(doc, lang); if (!d) return r.status(404).json({ error: 'not found' }); r.json(d); }
app.get('/api/legal/:lang(he|en)/:doc', (q, r) => legal(q, r, q.params.doc, q.params.lang));
app.get('/api/legal/:doc', (q, r) => legal(q, r, q.params.doc, q.query.lang === 'he' ? 'he' : 'en'));
// Seller disclosure for footer/checkout (Consumer Protection Law s.14C). Public business details only.
app.get('/api/seller', (q, r) => r.json({ name: BRAND.legalEntity, nameHe: BRAND.legalEntityHe, entityId: BRAND.entityId, entityType: BRAND.entityType, entityTypeHe: BRAND.entityTypeHe, address: BRAND.address, addressHe: BRAND.addressHe, email: BRAND.supportEmail, vat: false }));
// ---------- Next.js frontend (static export in web/out, built with `npm run build`) ----------
// Pages are plain HTML; dynamic segments (/r/:id, /dashboard/:id) map onto one exported page whose client code reads the id from the URL.
// Public pages are the same for everyone (language comes from the URL), so they carry no Set-Cookie/Vary and may be cached at a
// CDN briefly (s-maxage short because a deploy replaces the hashed /_next chunks the HTML points at).
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=120'; const PUBLIC_PAGES = new Set(['', 'scan', 'report', 'legal']); const OUT = path.resolve('web/out'); const LANGS = ['he', 'en'];
const prefLang = q => { const c = /(?:^|;\s*)ranky_lang=(he|en)/.exec(q.get('cookie') || ''); if (c) return c[1]; return /\bhe\b|\biw\b/i.test(q.get('accept-language') || '') ? 'he' : 'en'; };
const qs = q => { const i = q.originalUrl.indexOf('?'); return i >= 0 ? q.originalUrl.slice(i) : ''; };
function page(r, lang, name, shared = PUBLIC_PAGES.has(name || '')) {
  const f = path.join(OUT, name ? `${lang}/${name}.html` : `${lang}.html`);
  if (!fs.existsSync(f)) return r.status(503).send('Frontend not built: cd web && npm install && npm run build');
  // No ranky_lang cookie here: it is set client-side only when the visitor explicitly switches language (web/components/LangLink.tsx).
  if (shared) r.set('Cache-Control', PUBLIC_CACHE); r.sendFile(f, { cacheControl: !shared });
}
// Language-less short links redirect by cookie / Accept-Language: say so (Vary) and keep them out of shared caches.
app.use((q, r, next) => { if (/^\/(?:(?:r|dashboard)\/[^/]+|login|pricing|mock-checkout|legal(?:\/[^/]+)?)?\/?$/.test(q.path)) { r.vary('Cookie'); r.vary('Accept-Language'); r.set('Cache-Control', 'private, no-store'); } next(); });
app.use(['/dashboard', '/auth', '/he/dashboard', '/en/dashboard'], (q, r, next) => { r.set('Referrer-Policy', 'no-referrer'); r.set('Cache-Control', 'no-store'); next(); });
app.use('/_next', express.static(path.join(OUT, '_next'), { immutable: true, maxAge: '1y' }));
app.get('/', (q, r) => r.redirect(`/${prefLang(q)}`));
// Language-less legacy/short links → preferred language.
app.get('/r/:id', (q, r) => r.redirect(`/${prefLang(q)}/r/${encodeURIComponent(q.params.id)}`));
app.get('/dashboard/:id', (q, r) => r.redirect(`/${prefLang(q)}/dashboard/${encodeURIComponent(q.params.id)}${qs(q)}`));
app.get('/login', (q, r) => r.redirect(`/${prefLang(q)}/login`));
app.get('/pricing', (q, r) => r.redirect(`/${prefLang(q)}#pricing`));
app.get('/mock-checkout', (q, r) => { const k = String(q.query.account || '').split('.')[0]; const acc = Object.hasOwn(getDb().accounts, k) ? getDb().accounts[k] : null; return isPrelaunch() && !(acc?.pendingAdminTest && getPayments().id === 'mock') ? r.redirect(`/${prefLang(q)}/checkout`) : r.redirect(`/${prefLang(q)}/checkout${qs(q)}${isPrelaunch() ? (qs(q) ? '&' : '?') + 'admintest=1' : ''}`); });
// Legal docs live at /{lang}/legal/{doc} (server-rendered from legal/*.md, full text in the HTML). Short links and the old
// /{lang}/legal?doc=… URLs 301 there (language-less short links 302: the language is a per-visitor choice). Anything off the
// whitelist, COMPLIANCE-NOTES included, is an explicit 404 and is never redirected to a page that could imply it exists.
const isDoc = d => typeof d === 'string' && LEGAL_DOCS.includes(d);
app.get('/legal', (q, r) => r.redirect(`/${prefLang(q)}/legal`));
app.get('/legal/:lang(he|en)/:doc', (q, r, next) => isDoc(q.params.doc) ? r.redirect(301, `/${q.params.lang}/legal/${q.params.doc}`) : next());
app.get('/legal/:doc', (q, r, next) => isDoc(q.params.doc) ? r.redirect(`/${prefLang(q)}/legal/${q.params.doc}`) : next());
app.get('/:lang/legal', (q, r, next) => { if (!LANGS.includes(q.params.lang)) return next(); if (q.query.doc === undefined) return page(r, q.params.lang, 'legal'); return isDoc(q.query.doc) ? r.redirect(301, `/${q.params.lang}/legal/${q.query.doc}`) : r.redirect(301, `/${q.params.lang}/legal`); });
app.get('/:lang/legal/:doc', (q, r, next) => {
  if (!LANGS.includes(q.params.lang) || !isDoc(q.params.doc)) return next();
  const h = legalPageHtml(OUT, q.params.lang, q.params.doc); if (h === undefined) return r.status(503).send('Frontend not built: cd web && npm install && npm run build');
  r.set('Cache-Control', PUBLIC_CACHE).type('html').send(h); });
app.get('/:lang', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang) : next());
app.get('/:lang/r/:id', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang, 'report', false) : next());
app.get('/:lang/dashboard/:id', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang, 'dashboard') : next());
app.get('/:lang/:page', (q, r, next) => LANGS.includes(q.params.lang) && ['scan', 'report', 'login', 'dashboard', 'checkout'].includes(q.params.page) ? page(r, q.params.lang, q.params.page) : next());
app.get(['/he.txt', '/en.txt', '/:lang/:page.txt'], (q, r) => { const f = path.join(OUT, q.path); return LANGS.some(l => q.path.startsWith('/' + l)) && fs.existsSync(f) && !q.path.includes('..') ? r.sendFile(f) : r.sendStatus(404); });
// Branded bilingual 404 (RTL Hebrew + English, order follows the URL language or preference). JSON for /api.
app.use((q, r) => { if (wantsJson(q)) return r.status(404).json({ error: 'not found' }); const m = /^\/(he|en)(\/|$)/.exec(q.path); r.status(404).type('html').send(notFoundPage(m ? m[1] : prefLang(q))); });

const port = process.env.PORT || 3000;
if (process.argv[1]?.endsWith('server.js')) { const cfg = (await import('./src/config-check.js')).logConfig(); if (cfg.fatal.length) { console.error('[config] FATAL: ' + cfg.fatal.join('; ')); process.exit(1); } if (!cfg.ok && process.env.CONFIG_STRICT === '1') process.exit(1); }
if (process.argv[1]?.endsWith('server.js') && process.env.BILLING_SYNC_CRON === '1') { startBillingCron(); console.log('billing sync: in-process daily scheduler on'); }
if (process.argv[1]?.endsWith('server.js')) app.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`${BRAND.name} on http://localhost:${port} (scans: ${isMockMode() ? 'MOCK' : 'LIVE'}, payments: ${getPayments().id})`));
export default app;
