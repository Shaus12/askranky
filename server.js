import express from 'express'; import fs from 'node:fs'; import path from 'node:path';
import { BRAND } from './src/brand.js'; import { PLANS, isPaid, CURRENCIES } from './src/plans.js'; import { detectCurrency, billingFor, publicPlans, usdBillingEnabled } from './src/currency.js';
import { getDb, save, id } from './src/store.js'; import { runScan } from './src/scan.js';
import { getPayments } from './src/payments/index.js'; import { renderWeeklyEmail } from './src/email/report.js'; import { sendEmail } from './src/email/send.js';
import * as V from './src/views.js'; import { isMockMode } from './src/providers/index.js';
import { token, safeEqual, issueMagicLink, consumeMagic } from './src/security/tokens.js'; import { createRateLimiter } from './src/security/ratelimit.js';
import { verifyTurnstile, turnstileSiteKey } from './src/security/turnstile.js'; import { esc } from './src/security/html.js';

const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY); app.use(express.urlencoded({ extended: false })); app.use(express.json()); app.use(express.static('public'));
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const freeScanIps = new Map();
const wantsJson = q => q.path.startsWith('/api/');
// Burst limiter on scan endpoints (in addition to the 3-free-scans-per-IP rule). Env: SCAN_RATE_MAX, SCAN_RATE_WINDOW_MS.
export const scanLimiter = createRateLimiter({ max: Number(process.env.SCAN_RATE_MAX || 5), windowMs: Number(process.env.SCAN_RATE_WINDOW_MS || 10 * 60 * 1000),
  onLimit: (q, r, retry) => wantsJson(q) ? r.status(429).json({ error: `Too many scans. Try again in ${retry}s.` }) : r.status(429).send(V.landing(`Too many scans. Try again in ${retry}s.`)) });
const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000, onLimit: (q, r) => wantsJson(q) ? r.status(429).json({ error: 'Too many requests' }) : r.status(429).send('Too many requests') });
async function captcha(q, r, next) {
  const v = await verifyTurnstile(q.body?.['cf-turnstile-response'] || q.body?.turnstileToken, q.ip); if (v.ok) return next();
  return wantsJson(q) ? r.status(403).json({ error: v.error }) : r.status(403).send(V.landing(v.error));
}
const dashUrl = a => `/dashboard/${encodeURIComponent(a.id)}?key=${encodeURIComponent(a.key)}`;
async function emailMagicLink(a) {
  const link = issueMagicLink(a, BASE); await save();
  await sendEmail({ to: a.email, subject: `Your ${BRAND.name} dashboard link`, html: `<p>Open your ${esc(BRAND.name)} dashboard (link valid 15 minutes, single use):</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>If you didn't request this, ignore this email.</p>` });
}

function findOrCreateAccount(email) {
  const db = getDb(); let a = Object.values(db.accounts).find(x => x.email === email.toLowerCase());
  if (!a) { a = { id: id(10), key: token(32), email: email.toLowerCase(), plan: 'free', createdAt: new Date().toISOString(), usage: {} }; db.accounts[a.id] = a; save(); }
  return a;
}

app.get('/health', (q, r) => r.json({ ok: true, brand: BRAND.name, mockScans: isMockMode(), payments: getPayments().id }));

app.post('/scan', scanLimiter, captcha, async (q, r) => {
  const { name, website, category, city, email } = q.body;
  if (!name || !category || !city || !email) return r.status(400).send(V.landing('Please fill all required fields.'));
  const ipCount = freeScanIps.get(q.ip) || 0; if (ipCount >= 3 && !process.env.DISABLE_IP_LIMIT) return r.status(429).send(V.landing('Free scan limit reached for today.'));
  const db = getDb(); const account = findOrCreateAccount(email);
  if (account.plan === 'free' && Object.values(db.businesses).some(b => b.accountId === account.id && b.scanIds?.length)) {
    const b = Object.values(db.businesses).find(b => b.accountId === account.id); return r.redirect(`/r/${b.scanIds.at(-1)}`);
  }
  const business = { id: id(10), accountId: account.id, name: name.trim(), website: website?.trim(), category: category.trim(), city: city.trim() };
  db.businesses[business.id] = business; save();
  try {
    const scan = await runScan(account, business); freeScanIps.set(q.ip, ipCount + 1);
    await sendEmail({ to: account.email, subject: `Your ${BRAND.name} report: ${business.name} scored ${scan.summary.score}/100`, html: renderWeeklyEmail({ business, scan, reportUrl: `${BASE}/r/${scan.id}` }) });
    r.redirect(`/r/${scan.id}`);
  } catch (e) { r.status(e.code === 'CAP' ? 429 : 500).send(V.landing(e.message)); }
});


// Server-side price lookup only: the client may name a plan and a display currency (ILS|USD), never an amount.
// The quote is frozen on the account at checkout start and re-checked against PLANS on return.
const displayCurrencyFor = q => { const c = String(q.body?.currency || '').toUpperCase(); return CURRENCIES.includes(c) ? c : detectCurrency(q, q.body?.lang).currency; };
async function startCheckout(q) {
  const plan = Object.hasOwn(PLANS, q.body?.plan) ? PLANS[q.body.plan] : null; if (!isPaid(plan) || !q.body?.email) return null;
  const billing = billingFor(plan, displayCurrencyFor(q));
  const account = findOrCreateAccount(q.body.email); account.pendingPlan = plan.id; account.pendingBilling = billing; const state = account.checkoutState = token(24); save();
  const { redirectUrl } = await getPayments().createCheckout({ account, plan, billing, state, returnUrl: `${BASE}/billing/return` }); return { redirectUrl, billing };
}
app.post('/checkout', async (q, r) => { const c = await startCheckout(q); if (!c) return r.status(400).send('bad plan'); r.redirect(c.redirectUrl); });
app.get('/billing/return', async (q, r) => {
  const db = getDb(); const [accId, state] = String(q.query.Identifier || '').split('.'); const account = Object.hasOwn(db.accounts, accId) ? db.accounts[accId] : null;
  if (!account || !account.checkoutState || !safeEqual(state, account.checkoutState)) return r.status(400).send(V.message('Checkout link invalid', '<a href="/pricing">Start again</a>'));
  const plan = PLANS[account.pendingPlan || 'starter'];
  // Re-derive from PLANS (never trust stored/client amounts); keeps the currency chosen at checkout start.
  const billing = billingFor(plan, account.pendingBilling?.displayCurrency || 'ILS');
  try {
    const res = await getPayments().handleReturn(q.query, account, plan, billing);
    if (!res.ok) return r.send(V.message('Payment failed', '<a href="/pricing">Try again</a>', res.error));
    Object.assign(account, { plan: plan.id, subscriptionRef: res.subscriptionRef, paidAt: new Date().toISOString(), billing: { currency: billing.currency, amount: billing.amount } }); delete account.pendingPlan; delete account.pendingBilling; delete account.checkoutState; save();
    db.events.push({ at: new Date().toISOString(), type: 'subscription.activated', account: account.id, plan: plan.id, currency: billing.currency, amount: billing.amount }); save();
    // Don't hand the dashboard key to whoever holds this URL: email a single-use magic link instead.
    await emailMagicLink(account);
    r.send(V.message('Payment received', '<p>Check your inbox: we emailed you a private link to your dashboard.</p>'));
  } catch (e) { r.status(502).send(V.message('Payment error', '', e.message)); }
});
app.post('/webhooks/payments', async (q, r) => { const res = await getPayments().handleWebhook(q.body, q.headers); if (!res.ok) return r.sendStatus(401); getDb().events.push({ at: new Date().toISOString(), ...res.event }); save(); r.sendStatus(200); });

const accountFor = q => { const db = getDb(); const a = Object.hasOwn(db.accounts, q.params.id) ? db.accounts[q.params.id] : null; return a && safeEqual(String(q.query.key ?? q.get('x-dashboard-key') ?? ''), a.key) ? a : null; };
function auth(q, r) { const a = accountFor(q); if (!a) { r.status(403).send('forbidden'); return null; } return a; }
// Magic-link login: always answers the same way so it can't be used to probe which emails exist.
async function login(q, r) { const email = String(q.body?.email || '').trim().toLowerCase(); const a = email && Object.values(getDb().accounts).find(x => x.email === email);
  if (a) await emailMagicLink(a); const msg = 'If that email has an account, we sent a sign-in link.'; return wantsJson(q) ? r.json({ ok: true, message: msg }) : r.send(V.message('Check your email', '', msg)); }
app.post('/login', loginLimiter, login); app.post('/api/login', loginLimiter, login);
app.get('/auth/magic', loginLimiter, (q, r) => { const db = getDb(); const a = Object.hasOwn(db.accounts, String(q.query.a)) ? db.accounts[q.query.a] : null;
  if (!a || !consumeMagic(a, q.query.t)) return r.status(403).send(V.message('Link expired', '', 'This sign-in link is invalid or already used. Request a new one.'));
  if (!a.key || a.key.length < 32) a.key = token(32); save(); r.set('Referrer-Policy', 'no-referrer'); r.redirect(dashUrl(a)); });
app.post('/dashboard/:id/rescan', async (q, r) => {
  const a = auth(q, r); if (!a) return; const b = Object.hasOwn(getDb().businesses, String(q.body.businessId)) ? getDb().businesses[q.body.businessId] : null; if (!b || b.accountId !== a.id) return r.sendStatus(404);
  try { await runScan(a, b); r.redirect(dashUrl(a)); } catch (e) { r.status(429).send(V.message('Scan not run', '', e.message)); }
});



// ---------- JSON API for the Next.js frontend (web/) ----------
const pub = a => ({ id: a.id, email: a.email, plan: a.plan, active: !!a.subscriptionRef });
app.get('/api/config', (q, r) => r.json({ brand: BRAND, plans: publicPlans(), usdBilling: usdBillingEnabled(), mock: isMockMode(), turnstileSiteKey: turnstileSiteKey() }));
app.post('/api/scan', scanLimiter, captcha, async (q, r) => {
  const { name, website, category, city, email } = q.body || {};
  if (!name || !category || !city || !email) return r.status(400).json({ error: 'Please fill all required fields.' });
  const ipCount = freeScanIps.get(q.ip) || 0; if (ipCount >= 3 && !process.env.DISABLE_IP_LIMIT) return r.status(429).json({ error: 'Free scan limit reached for today.' });
  const db = getDb(); const account = findOrCreateAccount(email);
  const existing = Object.values(db.businesses).find(b => b.accountId === account.id && b.scanIds?.length);
  if (account.plan === 'free' && existing) return r.json({ reportId: existing.scanIds.at(-1), existing: true });
  const business = { id: id(10), accountId: account.id, name: name.trim(), website: website?.trim(), category: category.trim(), city: city.trim() };
  db.businesses[business.id] = business; save();
  try {
    const scan = await runScan(account, business); freeScanIps.set(q.ip, ipCount + 1);
    await sendEmail({ to: account.email, subject: `Your ${BRAND.name} report: ${business.name} scored ${scan.summary.score}/100`, html: renderWeeklyEmail({ business, scan, reportUrl: `${BASE}/r/${scan.id}` }) });
    r.json({ reportId: scan.id });
  } catch (e) { r.status(e.code === 'CAP' ? 429 : 500).json({ error: e.message }); }
});
app.get('/api/report/:id', (q, r) => { const db = getDb(); const s = db.scans[q.params.id]; if (!s) return r.status(404).json({ error: 'not found' });
  const b = db.businesses[s.businessId]; const hist = (b.scanIds || []).map(i => db.scans[i]).filter(Boolean); const idx = hist.findIndex(x => x.id === s.id);
  r.json({ business: { name: b.name, category: b.category, city: b.city, website: b.website }, scan: s, previousScore: idx > 0 ? hist[idx - 1].summary.score : null, history: hist.slice(0, idx + 1).map(x => x.summary.score) }); });
app.post('/api/checkout', async (q, r) => { const c = await startCheckout(q); if (!c) return r.status(400).json({ error: 'Choose a plan and enter your email.' }); r.json(c); });
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
  try { const s = await runScan(a, b); r.json({ reportId: s.id }); } catch (e) { r.status(429).json({ error: e.message }); }
});
// Legal drafts in legal/*.md (Hebrew: *.he.md). Known placeholders come from BRAND/env; any other {{KEY}} renders as
// "[KEY]" (or env LEGAL_KEY) so unfilled fields are visible but never leak template syntax.
app.get('/api/legal/:doc', (q, r) => {
  const doc = q.params.doc.replace(/[^a-z]/g, ''); const he = q.query.lang === 'he' && fs.existsSync(path.resolve('legal', doc + '.he.md'));
  const f = path.resolve('legal', doc + (he ? '.he.md' : '.md')); if (!doc || !fs.existsSync(f)) return r.status(404).json({ error: 'not found' });
  const known = { BRAND: BRAND.name, DOMAIN: BRAND.domain, EMAIL: BRAND.supportEmail, ENTITY: BRAND.legalEntity };
  r.json({ lang: he ? 'he' : 'en', markdown: fs.readFileSync(f, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => known[k] ?? process.env['LEGAL_' + k] ?? `[${k}]`) });
});
// ---------- Next.js frontend (static export in web/out, built with `npm run build`) ----------
// Pages are plain HTML; dynamic segments (/r/:id, /dashboard/:id) map onto one exported page whose client code reads the id from the URL.
const OUT = path.resolve('web/out'); const LANGS = ['he', 'en'];
const prefLang = q => { const c = /(?:^|;\s*)ranky_lang=(he|en)/.exec(q.get('cookie') || ''); if (c) return c[1]; return /\bhe\b|\biw\b/i.test(q.get('accept-language') || '') ? 'he' : 'en'; };
const qs = q => { const i = q.originalUrl.indexOf('?'); return i >= 0 ? q.originalUrl.slice(i) : ''; };
function page(r, lang, name) {
  const f = path.join(OUT, name ? `${lang}/${name}.html` : `${lang}.html`);
  if (!fs.existsSync(f)) return r.status(503).send('Frontend not built: cd web && npm install && npm run build');
  r.set('Set-Cookie', `ranky_lang=${lang}; Path=/; SameSite=Lax; Max-Age=31536000`); r.sendFile(f);
}
app.use(['/dashboard', '/auth', '/he/dashboard', '/en/dashboard'], (q, r, next) => { r.set('Referrer-Policy', 'no-referrer'); r.set('Cache-Control', 'no-store'); next(); });
app.use('/_next', express.static(path.join(OUT, '_next'), { immutable: true, maxAge: '1y' }));
app.get('/', (q, r) => r.redirect(`/${prefLang(q)}`));
// Language-less legacy/short links → preferred language.
app.get('/r/:id', (q, r) => r.redirect(`/${prefLang(q)}/r/${encodeURIComponent(q.params.id)}`));
app.get('/dashboard/:id', (q, r) => r.redirect(`/${prefLang(q)}/dashboard/${encodeURIComponent(q.params.id)}${qs(q)}`));
app.get('/login', (q, r) => r.redirect(`/${prefLang(q)}/login`));
app.get('/pricing', (q, r) => r.redirect(`/${prefLang(q)}#pricing`));
app.get('/mock-checkout', (q, r) => r.redirect(`/${prefLang(q)}/checkout${qs(q)}`));
app.get('/legal/:doc', (q, r) => r.redirect(`/${prefLang(q)}/legal?doc=${encodeURIComponent(q.params.doc)}`));
app.get('/:lang', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang) : next());
app.get('/:lang/r/:id', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang, 'report') : next());
app.get('/:lang/dashboard/:id', (q, r, next) => LANGS.includes(q.params.lang) ? page(r, q.params.lang, 'dashboard') : next());
app.get('/:lang/:page', (q, r, next) => LANGS.includes(q.params.lang) && ['scan', 'report', 'login', 'dashboard', 'checkout', 'legal'].includes(q.params.page) ? page(r, q.params.lang, q.params.page) : next());
app.get(['/he.txt', '/en.txt', '/:lang/:page.txt'], (q, r) => { const f = path.join(OUT, q.path); return LANGS.some(l => q.path.startsWith('/' + l)) && fs.existsSync(f) && !q.path.includes('..') ? r.sendFile(f) : r.sendStatus(404); });
app.use((q, r) => { const f = path.join(OUT, '404.html'); return fs.existsSync(f) ? r.status(404).sendFile(f) : r.sendStatus(404); });

const port = process.env.PORT || 3000;
if (process.argv[1]?.endsWith('server.js')) app.listen(port, '127.0.0.1', () => console.log(`${BRAND.name} on http://localhost:${port} (scans: ${isMockMode() ? 'MOCK' : 'LIVE'}, payments: ${getPayments().id})`));
export default app;
