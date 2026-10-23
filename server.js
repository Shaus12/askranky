import express from 'express'; import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto';
import { BRAND } from './src/brand.js'; import { PLANS, isPaid, CURRENCIES } from './src/plans.js'; import { detectCurrency, billingFor, publicPlans, usdBillingEnabled } from './src/currency.js';
import { getDb, save, id, BACKEND } from './src/store.js'; import { runScan } from './src/scan.js';
import { getPayments } from './src/payments/index.js'; import { renderWeeklyEmail } from './src/email/report.js'; import { sendEmail, sendEmailSoft, emailIsMock } from './src/email/send.js';
import * as V from './src/views.js'; import { isMockMode } from './src/providers/index.js';
import { token, safeEqual, issueMagicLink, consumeMagic } from './src/security/tokens.js'; import { createRateLimiter } from './src/security/ratelimit.js';
import { verifyTurnstile, turnstileSiteKey } from './src/security/turnstile.js'; import { esc } from './src/security/html.js';
import { isPrelaunch } from './src/prelaunch.js'; import { billingPage, notFoundPage, langOf } from './src/pages.js'; import { robotsTxt, sitemapXml, llmsTxt, NOINDEX_PATH } from './src/seo.js';
import { renderTx } from './src/email/templates.js'; import { setConsent, verifyUnsubToken, unsubUrl, unsubHeaders } from './src/consent.js'; import { unsubscribePage } from './src/pages.js';
import { TEST_PLAN, TEST_BILLING, TEST_CHECKOUT_TTL_MS, TEST_ACCESS_MS } from './src/payments/test-plan.js';
import { validSingleUseToken, looksLikeCardNumber } from './src/payments/sumit.js'; import { checkoutCsp, inlineScriptHashes, adminNonce, JQUERY_PATH, SUMIT_SCRIPT_URL } from './src/security/csp.js';
import { startBillingCron, ymd, syncAll } from './src/jobs/billing-sync.js'; import { LEGAL_DOCS, legalDoc, legalPageHtml } from './src/legal.js';

// TRUST_PROXY=1 (GO-LIVE.md) is a *string* in process.env; Express treats a string as an IP/subnet list ('1' = the address 0.0.0.1), so the proxy was
// NOT trusted and every visitor shared the proxy's IP in all per-IP limits. Numbers become a hop count, 'true'/'false' booleans, anything else is passed through.
export const trustProxySetting = v => { const s = String(v).trim(); return /^\d+$/.test(s) ? Number(s) : s === 'true' ? true : s === 'false' ? false : s; };
const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY) app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY)); app.use(express.urlencoded({ extended: false })); app.use(express.json()); // noindex on private pages (meta robots is also in the HTML; the header covers redirects and server-rendered pages).
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
// Sign-in link email (HE/EN via renderTx('login')). Language: explicit > the account's known language > English.
async function emailMagicLink(a, lang) {
  const link = issueMagicLink(a, BASE); await save(); const l = lang === 'he' ? 'he' : lang === 'en' ? 'en' : (a.lang || a.pendingLang) === 'he' ? 'he' : 'en';
  await sendEmail({ to: a.email, ...renderTx('login', l, { link }) });
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
  await sendEmailSoft({ to: account.email, headers: unsubHeaders(u), subject: `Your ${BRAND.name} report: ${business.name} scored ${scan.summary.score}/100`, html: renderWeeklyEmail({ business, scan, reportUrl: `${BASE}/r/${scan.id}`, unsubscribeUrl: u, variant: 'report' }) }); }
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
import { runWeekly } from './src/weekly.js';
export const cronHooks = { sync: syncAll, weekly: () => runWeekly({ base: BASE }) };
const cronFailLimiter = createRateLimiter({ max: Number(process.env.CRON_FAIL_MAX || 10), windowMs: 15 * 60 * 1000, onLimit: (q, r) => r.status(429).json({ ok: false }) });
// Same semantics for every cron endpoint: 404 disabled, 401 wrong secret, 202 already running, 500 {ok:false}, 200 {ok, ranAt}. `enabled` (optional)
// is an extra opt-in flag; when it is off the endpoint answers 200 {ok:true, skipped} after authenticating and runs nothing.
function cronEndpoint(name, label, { enabled, skipped } = {}) { let running = false;
  return async (q, r) => {
    r.set('Cache-Control', 'no-store'); const secret = process.env.CRON_SECRET || ''; if (secret.length < 16) return r.status(404).json({ ok: false });
    if (!safeEqual(String(q.get('x-cron-secret') || ''), secret)) return cronFailLimiter(q, r, () => r.status(401).json({ ok: false }));
    if (enabled && !enabled()) return r.json({ ok: true, skipped });
    if (running) return r.status(202).json({ ok: true, running: true });
    running = true;
    try { await cronHooks[name](); console.log(`[cron] ${label} done`); return r.json({ ok: true, ranAt: new Date().toISOString() }); }
    catch (e) { console.error(`[cron] ${label} failed (${e?.name || 'Error'})`); return r.status(500).json({ ok: false }); }
    finally { running = false; }
  }; }
app.post('/api/internal/cron/sync', cronEndpoint('sync', 'billing sync'));
// Weekly report emails: NOT scheduled anywhere and inert unless WEEKLY_EMAILS_ENABLED=1 (default off) — it re-scans every paid business (AI cost)
// and emails the customers, so it only runs once the owner has approved automated weekly emails.
export const weeklyEmailsEnabled = () => process.env.WEEKLY_EMAILS_ENABLED === '1';
app.post('/api/internal/cron/weekly', cronEndpoint('weekly', 'weekly reports', { enabled: weeklyEmailsEnabled, skipped: 'weekly_disabled' }));
// ---------- Card data guard (checkout / charge / admin routes) ----------
// Card numbers must never reach this server: payments.js sends them straight to SUMIT and we only ever receive a SingleUseToken.
// Defence in depth: refuse (400, nothing stored, nothing logged but the path) any request whose keys look like card fields or whose
// values look like a card number (13-19 digits passing Luhn), in the JSON/urlencoded body or the query string.
const CARD_KEY = /card|cvv|cvc|cc[-_ ]?num|expir|citizen|^og[-_]/i, CARD_VALUE = /^[\d\s-]{13,23}$/;
const hasCardData = (v, depth = 0) => { if (v == null || depth > 4) return false; if (typeof v === 'string') return CARD_VALUE.test(v) && looksLikeCardNumber(v);
  if (typeof v === 'number') return looksLikeCardNumber(String(v)); if (typeof v !== 'object') return false;
  return Object.entries(v).some(([k, x]) => CARD_KEY.test(k) || hasCardData(x, depth + 1)); };
export const noCardData = (q, r, next) => { if (!hasCardData(q.body) && !hasCardData(q.query)) return next();
  console.error(`[security] card-like data rejected on ${q.path}`); return r.status(400).set('Cache-Control', 'no-store').json({ ok: false, error: 'card_data_rejected', code: 'card_data_rejected' }); };
// ---------- Hidden admin-only REAL 1 ILS test checkout (PAYMENTS_PROVIDER=sumit + ADMIN_TEST_TOKEN) ----------
// Same real code path as production checkout (embedded SUMIT Payments JS card form -> POST token -> recurring/charge with DocumentType 2
// receipt, NoVAT true), but with the internal TEST_PLAN (1 ILS, exactly one payment) that is not part of PLANS. 404 for everyone when
// the provider is not sumit or ADMIN_TEST_TOKEN (>= 16 chars) is unset. Token: header x-admin-test-token only (never a URL), compared
// timing-safe; wrong tokens are rate limited. Not linked, not in the sitemap, noindex. Nothing from SUMIT is logged (ok/fail + document id).
// Flow: POST /api/admin/test-checkout {email} -> { embedded: {companyId, publicKey, identifier} } ; the page tokenizes the card in the browser
// (payments.js) ; POST /api/admin/test-checkout/charge {identifier, token} charges. Only the admin charge route may complete a test checkout.
const realTestEnabled = () => getPayments().id === 'sumit' && (process.env.ADMIN_TEST_TOKEN || '').length >= 16;
const adminTokenOk = q => safeEqual(String(q.get('x-admin-test-token') || ''), process.env.ADMIN_TEST_TOKEN || '');
const adminFailLimiter = createRateLimiter({ max: Number(process.env.ADMIN_FAIL_MAX || 10), windowMs: 15 * 60 * 1000, onLimit: (q, r) => r.status(429).json({ ok: false }) });
const adminTestGate = (q, r, next) => { r.set('Cache-Control', 'no-store'); r.set('X-Robots-Tag', 'noindex, nofollow'); r.set('Referrer-Policy', 'no-referrer');
  if (!realTestEnabled()) return next('route'); if (!adminTokenOk(q)) return adminFailLimiter(q, r, () => r.status(401).json({ ok: false })); next(); };
const adminEmail = q => { const e = String(q.body?.email || '').trim().toLowerCase(); return e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null; };
app.post('/api/admin/test-checkout', adminTestGate, noCardData, async (q, r) => {
  const email = adminEmail(q); if (!email) return r.status(400).json({ ok: false, error: 'email' });
  const ex = Object.values(getDb().accounts).find(x => x.email === email);
  if (ex && ex.subscriptionRef && ex.plan !== 'free' && !ex.testSubscription) return r.status(409).json({ ok: false, error: 'real_subscription' }); // never touch a real customer's subscription
  if (ex?.testSubscription && ex.status === 'active' && ex.paidThrough && Date.now() < Date.parse(ex.paidThrough)) return r.status(409).json({ ok: false, error: 'test_active_cancel_first' });
  const account = findOrCreateAccount(email); const state = token(24);
  Object.assign(account, { pendingTest: { at: new Date().toISOString() }, pendingPlan: 'starter', pendingBilling: { ...TEST_BILLING }, pendingLang: 'he', checkoutState: state }); delete account.pendingAdminTest; await save();
  try { const { embedded } = await getPayments().createCheckout({ account, plan: TEST_PLAN, billing: { ...TEST_BILLING }, state }); console.log('[admin-test] checkout started'); return r.json({ ok: true, embedded }); }
  catch { console.error('[admin-test] checkout start failed'); return r.status(502).json({ ok: false }); }
});
app.post('/api/admin/test-checkout/charge', adminTestGate, noCardData, (q, r, next) => chargeLimiter(q, r, next), (q, r) => chargeJson(q, r, 'admin'));
// One-time dashboard sign-in link for a TEST account only (so cancel can be tested even while EMAIL_MODE is not live). Never works for real customers.
app.post('/api/admin/test-checkout/login-link', adminTestGate, async (q, r) => {
  const email = adminEmail(q); const a = email && Object.values(getDb().accounts).find(x => x.email === email); if (!a || !a.testSubscription) return r.status(404).json({ ok: false });
  const link = issueMagicLink(a, BASE); await save(); return r.json({ ok: true, link });
});
// The page is plain HTML with ONE inline script + ONE inline style, both allowed by a per-response CSP nonce. Card inputs have no `name`
// (a native submit could never send them) and are read only by SUMIT's payments.js from the DOM; our script never reads their values.
const adminPage = nonce => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ranky admin test</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;min-height:100vh;font:16px/1.5 Heebo,"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;color:#e2e8f0;background:radial-gradient(70% 40% at 50% 0%,rgba(37,99,235,.22),transparent 70%),linear-gradient(180deg,#01061a,#031035 60%,#01061a);-webkit-font-smoothing:antialiased}
main{max-width:30rem;margin:0 auto;padding:1.5rem 1rem 3rem}
.badge{display:inline-block;border-radius:9999px;border:1px solid rgba(232,176,75,.5);background:rgba(232,176,75,.14);color:#fde68a;padding:.2rem .8rem;font-size:.8rem;font-weight:700;letter-spacing:.04em}
h1{margin:.75rem 0 .25rem;font-size:1.75rem;line-height:1.2;color:#fff}
.sub{margin:0 0 1rem;color:#a5b4cb;font-size:.95rem}
.warn{display:flex;gap:.6rem;border-radius:.85rem;border:1px solid rgba(232,176,75,.5);background:rgba(232,176,75,.1);color:#fde68a;padding:.8rem 1rem;font-size:.9rem;margin-bottom:1rem}
.warn b{color:#fff}
.card{background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border:1px solid rgba(148,163,184,.16);border-radius:1.25rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 24px 48px -28px rgba(0,0,0,.7);padding:1.25rem;margin-bottom:1rem}
.card h2{margin:0 0 .75rem;font-size:1rem;color:#fff}
label{display:block;margin:0 0 .35rem;font-size:.875rem;font-weight:500;color:#e2e8f0}
.f{margin-bottom:.9rem}.f.last{margin-bottom:0}.f.top{margin-top:.9rem}
input{display:block;width:100%;min-height:2.75rem;border-radius:.85rem;border:1px solid rgba(148,163,184,.28);background:rgba(1,6,26,.55);padding:.6rem .9rem;color:#fff;font:inherit;font-size:1rem;text-align:left;font-variant-numeric:tabular-nums;transition:border-color .2s,box-shadow .2s}
input::placeholder{color:#64748b}input:hover{border-color:rgba(148,163,184,.5)}
input:focus{outline:none;border-color:#60a5fa;box-shadow:0 0 0 3px rgba(37,99,235,.35)}
input:read-only{opacity:.65;cursor:progress}
.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
.hint{margin:.4rem 0 0;font-size:.75rem;color:#94a3b8}
.og-errors{color:#fecaca;font-size:.875rem}.og-errors:not(:empty){border:1px solid rgba(233,122,111,.4);background:rgba(233,122,111,.1);border-radius:.85rem;padding:.7rem .9rem;margin-bottom:.9rem}
button{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:3rem;border:0;border-radius:9999px;padding:.8rem 1.5rem;font:inherit;font-weight:700;font-size:1rem;cursor:pointer;background:#22c55e;color:#03200f;box-shadow:0 10px 30px -10px rgba(34,197,94,.6);transition:background .2s,transform .2s}
button:hover{background:#4ade80;transform:translateY(-1px)}
button:disabled{opacity:.65;cursor:not-allowed;transform:none;box-shadow:none}
button.alt{background:transparent;color:#dbeafe;border:1px solid rgba(147,197,253,.35);box-shadow:none;font-weight:600}button.alt:hover{background:rgba(37,99,235,.18)}
a:focus-visible,button:focus-visible{outline:2px solid #93c5fd;outline-offset:3px}
.spin{display:none;width:1.1rem;height:1.1rem;border-radius:9999px;border:2px solid rgba(3,32,15,.25);border-top-color:#03200f;animation:spin .8s linear infinite}.busy .spin{display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
#out{margin:.75rem 0;min-height:1.5rem;word-break:break-word;color:#a5b4cb;font-size:.95rem}#out.ok{color:#a7f3d0}#out.err{color:#fecaca}#out a{color:#7dd3fc}
.secure{margin:.9rem 0 0;text-align:center;font-size:.75rem;color:#94a3b8}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style></head><body><main>
<span class="badge">TEST ₪1</span>
<h1>בדיקת סליקה: ₪1</h1><p class="sub">חיוב אמיתי של ₪1 (תשלום אחד) באותו מסלול קוד כמו הצ'קאאוט. דורש טוקן אדמין.</p>
<div class="warn" role="note"><span aria-hidden="true">⚠️</span><div><b>זה חיוב אמיתי.</b> הכרטיס יחויב ב־₪1 וייווצרו קבלה והוראת קבע ב־SUMIT. ההחזר ידני בדשבורד של SUMIT (ראו TEST-CHECKOUT.he.md). אין להשתמש בכרטיס של לקוח.</div></div>
<form id="f" autocomplete="off" novalidate>
<div class="card"><h2>פרטי בדיקה</h2>
<div class="f"><label for="e">מייל</label><input id="e" type="email" placeholder="you@example.com" autocomplete="off" dir="ltr"></div>
<div class="f last"><label for="t">טוקן אדמין</label><input id="t" type="password" placeholder="••••••••••••••••" autocomplete="off" dir="ltr"></div></div>
<div class="card"><h2>פרטי כרטיס</h2>
<div class="f"><label for="cn">מספר כרטיס</label><input id="cn" type="text" inputmode="numeric" maxlength="23" placeholder="1234 5678 9012 3456" autocomplete="cc-number" dir="ltr" data-og="cardnumber"></div>
<div class="row"><div><label for="cm">חודש</label><input id="cm" type="text" inputmode="numeric" maxlength="2" placeholder="MM" autocomplete="cc-exp-month" dir="ltr" data-og="expirationmonth"></div><div><label for="cy">שנה</label><input id="cy" type="text" inputmode="numeric" maxlength="4" placeholder="YYYY" autocomplete="cc-exp-year" dir="ltr" data-og="expirationyear"></div><div><label for="cv">CVV</label><input id="cv" type="text" inputmode="numeric" maxlength="4" placeholder="•••" autocomplete="cc-csc" dir="ltr" data-og="cvv"></div></div>
<p class="hint">CVV: שלוש הספרות בגב הכרטיס.</p>
<div class="f last top"><label for="ci">ת.ז. בעל הכרטיס (לא חובה)</label><input id="ci" type="text" inputmode="numeric" maxlength="12" placeholder="123456789" autocomplete="off" dir="ltr" data-og="citizenid"><p class="hint">נדרש רק אם מנפיק הכרטיס דורש.</p></div></div>
<div id="og" class="og-errors" role="alert" aria-live="assertive"></div>
<button id="go" type="submit"><span class="spin" aria-hidden="true"></span><span id="gol">שלם ₪1</span></button>
<p class="secure">🔒 תשלום מאובטח באמצעות SUMIT. פרטי הכרטיס לא עוברים בשרת שלנו.</p></form>
<p id="out" role="status" aria-live="polite"></p>
<button id="lk" class="alt" type="button">קבל קישור כניסה לדשבורד (אחרי החיוב)</button>
</main>
<script src="${JQUERY_PATH}"></script><script src="${SUMIT_SCRIPT_URL}"></script>
<script nonce="${nonce}">
const $=i=>document.getElementById(i),out=$('out');let busy=false;const say=(m,c)=>{out.className=c||'';out.textContent=m};const wait=on=>{$('go').disabled=on;$('go').classList.toggle('busy',on);$('gol').textContent=on?'מעבד תשלום…':'שלם ₪1'};
async function call(p,body){const r=await fetch(p,{method:'POST',headers:{'content-type':'application/json','x-admin-test-token':$('t').value},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));return{status:r.status,j}}
function tokenize(c){return new Promise((res,rej)=>{if(typeof OfficeGuy==='undefined'||!OfficeGuy.Payments)return rej(new Error('payments.js לא נטען (חסימה או רשת)'));
const to=setTimeout(()=>rej(new Error('הטוקניזציה לא הסתיימה בזמן')),30000);
OfficeGuy.Payments.CreateToken({CompanyID:c.companyId,APIPublicKey:c.publicKey,FormSelector:'#f',ErrorsClass:'.og-errors',ResponseCallback:function(x){clearTimeout(to);const t=x&&x.Status===0&&x.Data&&x.Data.SingleUseToken;t?res(t):rej(new Error((x&&(x.UserErrorMessage||x.TechnicalErrorDetails))||'הכרטיס לא אומת'))}})})}
function wipe(){document.querySelectorAll('[data-og]').forEach(i=>{i.value=''});const o=$('og-token');if(o)o.value=''}
$('f').addEventListener('submit',async ev=>{ev.preventDefault();if(busy)return;busy=true;wait(true);$('og').textContent='';say('מתחיל בדיקה…');
try{const st=await call('/api/admin/test-checkout',{email:$('e').value});if(!st.j.ok){say('נכשל ('+st.status+(st.j.error?': '+st.j.error:'')+')','err');return}
const tok=await tokenize(st.j.embedded);wipe();
const ch=await call('/api/admin/test-checkout/charge',{identifier:st.j.embedded.identifier,token:tok});
ch.j.ok?say('החיוב עבר (₪1). בדוק ב־SUMIT: קבלה, הוראת קבע אחת.','ok'):say('החיוב נכשל ('+ch.status+(ch.j.error?': '+ch.j.error:'')+')','err')}
catch(e){const m=String(e&&e.message||e);say($('og').textContent.trim()===m?'':m,'err')}finally{wipe();busy=false;wait(false)}});
$('lk').onclick=async()=>{say('…');try{const k=await call('/api/admin/test-checkout/login-link',{email:$('e').value});if(!k.j.ok){say('נכשל ('+k.status+')','err');return}say('','ok');const a=document.createElement('a');a.href=k.j.link;a.textContent='פתח דשבורד (תקף 15 דקות, שימוש אחד)';out.appendChild(a)}catch(e){say('שגיאת רשת','err')}};
</script></body></html>`;
app.get('/admin/test-checkout', (q, r, next) => { if (!realTestEnabled()) return next(); const nonce = adminNonce();
  r.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': checkoutCsp({ sumit: true, fonts: false, scriptSources: [`'nonce-${nonce}'`], styleSources: [`'nonce-${nonce}'`] }) }).type('html').send(adminPage(nonce)); });
app.get('/llms.txt', (q, r) => r.type('text/plain; charset=utf-8').send(llmsTxt()));
app.get('/robots.txt', (q, r) => r.type('text/plain').send(robotsTxt()));
app.get('/sitemap.xml', (q, r) => r.type('application/xml').send(sitemapXml()));
// Pre-launch waitlist: stores an email + language, never starts a payment.
app.post('/api/waitlist', loginLimiter, captcha, (q, r) => { const email = String(q.body?.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return r.status(400).json({ error: 'Enter a valid email.' });
  const db = getDb(); db.waitlist ||= []; if (!db.waitlist.some(w => w.email === email)) { db.waitlist.push({ email, lang: q.body?.lang === 'he' ? 'he' : 'en', plan: Object.hasOwn(PLANS, q.body?.plan) ? q.body.plan : null, at: new Date().toISOString() }); save(); }
  r.json({ ok: true }); });

// Free plan = one scan per email. Looked up BEFORE any engine call or spend, from the account's own stored businesses (email-based account).
// Same business (name + city, case/space-insensitive) again -> the existing report is returned as before (existing:true). A different
// business -> 409 free_scan_used with a pointer to the report this email already owns.
const norm = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export function freeScanLookup(db, account, body) {
  if (account.plan !== 'free') return null;
  const mine = Object.values(db.businesses).filter(b => b.accountId === account.id && b.scanIds?.length); if (!mine.length) return null;
  const same = mine.find(b => norm(b.name) === norm(body?.name) && norm(b.city) === norm(body?.city)); const b = same || mine[0];
  return { same: !!same, reportId: b.scanIds.at(-1) };
}
const FREE_USED_MSG = 'Free plan includes one scan per email.';
const freeUsedBody = (hit, lang) => ({ error: 'free_scan_used', code: 'free_scan_used', message: FREE_USED_MSG, reportId: hit.reportId, reportUrl: `/${lang === 'he' ? 'he' : 'en'}/r/${hit.reportId}` });

app.post('/scan', scanLimiter, captcha, async (q, r) => {
  const { name, website, category, city, email } = q.body;
  if (!name || !category || !city || !email) return r.status(400).send(V.landing('Please fill all required fields.'));
  const ipCount = freeScanIps.get(q.ip) || 0; if (ipCount >= 3 && !process.env.DISABLE_IP_LIMIT) return r.status(429).send(V.landing('Free scan limit reached for today.'));
  const db = getDb(); const account = findOrCreateAccount(email); recordConsent(account, q.body);
  const hit = freeScanLookup(db, account, q.body);
  if (hit && hit.same) return r.redirect(`/r/${hit.reportId}`);
  if (hit) return r.status(409).send(V.landing(`${FREE_USED_MSG} Your existing report: ${BASE}/r/${hit.reportId}`));
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
// Double-charge guard. An account "has an active subscription" while it holds a paid plan with a standing order that is active, or
// cancelled by the customer but still inside the paid period. past_due (grace) and unpaid accounts MAY check out again: that is the
// card-replacement flow (the old failed order is superseded, see completeCheckout). Admin test accounts are not real subscriptions.
export const hasActiveSubscription = (a, now = Date.now()) => !!a && !a.testSubscription && !a.adminTest && isPaid(PLANS[a.plan]) && !!a.subscriptionRef && a.status !== 'past_due'
  && !(a.status === 'cancelled' && !(a.paidThrough && Date.parse(a.paidThrough) > now)) && !['unpaid', 'cancelled_ended'].includes(a.status);
export const ALREADY_SUBSCRIBED = { ok: false, error: 'already_subscribed', code: 'already_subscribed', message: 'You already have an active subscription. Sign in to your dashboard to manage it.', messageHe: 'כבר יש לך מנוי פעיל. היכנס/י ללוח הבקרה כדי לנהל אותו.' };
const CHECKOUT_BUSY = { ok: false, error: 'busy', code: 'busy', message: 'A payment is already in progress for this account. Please wait a moment.', messageHe: 'תשלום כבר בתהליך בחשבון הזה. המתינו רגע.' };
const stateHash = st => createHash('sha256').update(String(st)).digest('hex');
const findAccountByEmail = email => Object.values(getDb().accounts).find(x => x.email === String(email || '').trim().toLowerCase());
// Sends the structured 409 for a start/charge that was refused ('already' | 'busy').
const refuseCheckout = (r, code) => r.status(409).json(code === 'busy' ? CHECKOUT_BUSY : ALREADY_SUBSCRIBED);
async function startCheckout(q) {
  const adminTest = isPrelaunch() && adminTestOk(q); if (isPrelaunch() && !adminTest) return { prelaunch: true };
  const plan = Object.hasOwn(PLANS, q.body?.plan) ? PLANS[q.body.plan] : null; if (!isPaid(plan) || !q.body?.email) return null;
  const billing = billingFor(plan, displayCurrencyFor(q));
  const existing = findAccountByEmail(q.body.email);
  if (existing && !adminTest) { if (chargeLocks.has(existing.id)) return { refused: 'busy' }; if (hasActiveSubscription(existing)) return { refused: 'already' }; } // never overwrite checkoutState mid-charge, never open a 2nd checkout for a live subscription
  const account = findOrCreateAccount(q.body.email); account.pendingPlan = plan.id; account.pendingBilling = billing; account.pendingLang = q.body?.lang === 'he' ? 'he' : q.body?.lang === 'en' ? 'en' : langOf(q); const state = account.checkoutState = token(24); if (adminTest) account.pendingAdminTest = true; else delete account.pendingAdminTest; delete account.pendingTest; save();
  // Mock provider: { redirectUrl } (stand-in card page). SUMIT: { embedded: {companyId, publicKey, identifier} } for the on-page Payments JS card form.
  const co = await getPayments().createCheckout({ account, plan, billing, state, returnUrl: `${BASE}/billing/return?lang=${account.pendingLang}` }); return { ...co, billing, lang: account.pendingLang, plan: plan.id };
}
app.post('/checkout', noCardData, captchaUnlessAdminTest, async (q, r) => { const c = await startCheckout(q); if (c?.refused) return r.status(409).send(billingPage(c.refused === 'busy' ? 'invalid' : 'already', q.body?.lang === 'he' || q.body?.lang === 'en' ? q.body.lang : langOf(q))); if (c?.prelaunch) return r.status(403).send(billingPage('prelaunch', q.body?.lang === 'he' || q.body?.lang === 'en' ? q.body.lang : langOf(q))); if (!c) return r.status(400).send('bad plan'); r.redirect(c.redirectUrl || `/${c.lang}/checkout?plan=${encodeURIComponent(c.plan)}`); });
// One checkout completion for every provider flow. via: 'return' (GET /billing/return, the mock provider's redirect), 'public'
// (POST /api/checkout/charge, embedded SUMIT) or 'admin' (POST /api/admin/test-checkout/charge). Returns { code, lang, error } where
// code is ok | failed | error | invalid | prelaunch | busy. The identifier is "<accountId>.<checkoutState>"; the state is an unguessable
// single-use secret handed out by POST /api/checkout (or the admin start), so no CAPTCHA is needed here.
const chargeLocks = new Set();
async function completeCheckout(q, { identifier, query, via }) {
  const db = getDb(); const [accId, state] = String(identifier || '').split('.'); const account = Object.hasOwn(db.accounts, accId) ? db.accounts[accId] : null;
  // The hidden admin 1 ILS test (account.pendingTest, set only by POST /api/admin/test-checkout) is the one thing allowed through while pre-launch,
  // only with the real provider, and only through the admin charge route (valid ADMIN_TEST_TOKEN).
  const isTest = via !== 'public' && !!account?.pendingTest && realTestEnabled();
  if (via === 'return' && getPayments().id === 'sumit') return { code: 'invalid' }; // SUMIT no longer redirects back; tokens never travel in URLs
  if (isPrelaunch() && !(account?.pendingAdminTest && getPayments().id === 'mock') && !isTest) return { code: 'prelaunch' };
  // A checkout that already completed (its single-use state was consumed): a repeat/second-device submit is a 409, not a charge.
  if (account && account.lastCheckout?.h && !isTest && state && safeEqual(stateHash(state), account.lastCheckout.h)) return { code: 'already' };
  if (!account || !account.checkoutState || !safeEqual(state, account.checkoutState) || (via === 'admin' && !isTest) || (account.pendingTest && (via === 'public' || !isTest || !(Date.now() - Date.parse(account.pendingTest.at) < TEST_CHECKOUT_TTL_MS)))) return { code: 'invalid' };
  if (!isTest && hasActiveSubscription(account)) return { code: 'already' };
  if (chargeLocks.has(account.id)) return { code: 'busy' };
  const plan = isTest ? TEST_PLAN : PLANS[account.pendingPlan || 'starter']; const lang = query.lang === 'he' || query.lang === 'en' ? query.lang : account.pendingLang || langOf(q);
  // Re-derive from PLANS (never trust stored/client amounts); keeps the currency chosen at checkout start.
  const billing = isTest ? { ...TEST_BILLING } : billingFor(plan, account.pendingBilling?.displayCurrency || 'ILS');
  chargeLocks.add(account.id);
  try {
    const res = await getPayments().handleReturn(query, account, plan, billing);
    if (isTest) console.log(res.ok ? `[admin-test] charge ok${res.documentId ? ` doc=${Number(res.documentId) || ''}` : ''}` : '[admin-test] charge failed');
    if (!res.ok) return { code: 'failed', lang, error: res.error };
    // Card-replacement flow: a past-due/unpaid customer subscribing again. Remember the old standing order so it can be cancelled after the new one is live.
    const oldRef = !isTest && ['past_due', 'unpaid'].includes(account.status) && account.subscriptionRef && String(account.subscriptionRef) !== String(res.subscriptionRef) ? String(account.subscriptionRef) : null;
    Object.assign(account, { plan: isTest ? 'starter' : plan.id, subscriptionRef: res.subscriptionRef, paidAt: new Date().toISOString(), billing: { currency: billing.currency, amount: billing.amount }, status: 'active', lang, paidThrough: isTest ? new Date(Date.now() + TEST_ACCESS_MS).toISOString() : addMonth(new Date()).toISOString(), ...(account.pendingAdminTest ? { adminTest: true } : {}), ...(isTest ? { testSubscription: true, adminTest: true } : {}) }); delete account.cancelledAt; delete account.pendingAdminTest; delete account.pendingTest; delete account.pendingPlan; delete account.pendingBilling; delete account.checkoutState; delete account.pendingLang; save();
    if (!isTest) { account.lastCheckout = { h: stateHash(state), at: new Date().toISOString() }; delete account.pastDueSince; delete account.failedNoticeAt; } // repeat submits of this checkout get 409 'already', never a 2nd charge
    db.events.push({ at: new Date().toISOString(), type: 'subscription.activated', account: account.id, plan: plan.id, currency: billing.currency, amount: billing.amount, ...(isTest ? { test: true, documentId: Number(res.documentId) || null } : {}) }); save();
    // Don't hand the dashboard key to whoever holds this URL: email a single-use magic link instead.
    await emailMagicLink(account, lang).catch(() => {});
    await sendEmailSoft({ to: account.email, ...renderTx('receipt', lang, { planName: plan.name, amount: billing.amount, currency: billing.currency, paidThrough: ymd(account.paidThrough), receiptUrl: res.receiptUrl }) });
    // Supersede the old failed order (best effort: SUMIT normally already disabled it; the provider's own cancel path is used, errors are only recorded).
    if (oldRef) { let ok = false; try { ok = !!(await getPayments().cancel({ ...account, subscriptionRef: oldRef }))?.ok; } catch { /* already disabled/cancelled at the provider */ } getDb().events.push({ at: new Date().toISOString(), type: 'subscription.superseded', account: account.id, cancelled: ok }); save(); }
    return { code: 'ok', lang };
  } catch (e) { if (isTest) console.error('[admin-test] charge failed'); return { code: 'error', lang, error: e.message }; }
  finally { chargeLocks.delete(account.id); }
}
app.get('/billing/return', async (q, r) => {
  const o = await completeCheckout(q, { identifier: q.query.Identifier, query: q.query, via: 'return' });
  if (o.code === 'prelaunch') return r.status(403).send(billingPage('prelaunch', langOf(q)));
  if (o.code === 'already') return r.status(409).send(billingPage('already', langOf(q)));
  if (o.code === 'invalid' || o.code === 'busy') return r.status(400).send(billingPage('invalid', langOf(q)));
  if (o.code === 'failed') return r.send(billingPage('failed', o.lang, o.error));
  if (o.code === 'error') return r.status(502).send(billingPage('error', o.lang, o.error));
  r.send(billingPage('ok', o.lang));
});
// Embedded SUMIT flow: the browser tokenizes the card with payments.js (card data goes browser -> SUMIT only) and POSTs just
// { identifier, token, lang } here. Only the SUMIT provider has this route (404 otherwise). JSON only; no card data, tokens or SUMIT
// responses are ever logged or echoed back; the client only gets a stable error code to localize.
export const chargeLimiter = createRateLimiter({ max: Number(process.env.CHARGE_RATE_MAX || 15), windowMs: 15 * 60 * 1000, onLimit: (q, r, retry) => r.status(429).json({ ok: false, error: 'rate_limited', code: 'rate_limited', retryAfter: retry }) });
async function chargeJson(q, r, via) {
  r.set('Cache-Control', 'no-store'); r.set('Referrer-Policy', 'no-referrer'); const b = q.body || {};
  if (typeof b.identifier !== 'string' || b.identifier.length > 200 || !validSingleUseToken(b.token)) return r.status(400).json({ ok: false, error: 'bad_request' });
  const o = await completeCheckout(q, { identifier: b.identifier, query: { Valid: '1', Token: b.token, Identifier: b.identifier, lang: b.lang }, via });
  if (o.code === 'ok') return r.json({ ok: true, lang: o.lang });
  if (o.code === 'prelaunch') return r.status(403).json({ ok: false, error: 'prelaunch', prelaunch: true });
  if (o.code === 'invalid') return r.status(400).json({ ok: false, error: 'invalid_checkout' });
  if (o.code === 'already') return refuseCheckout(r, 'already');
  if (o.code === 'busy') return refuseCheckout(r, 'busy');
  if (o.code === 'failed') return r.status(402).json({ ok: false, error: 'declined' });
  return r.status(502).json({ ok: false, error: 'charge_error' });
}
app.post('/api/checkout/charge', (q, r, next) => getPayments().id === 'sumit' ? next() : next('route'), noCardData, chargeLimiter, (q, r) => chargeJson(q, r, 'public'));
// Webhooks are rejected unless SUMIT_WEBHOOK_SECRET is set AND the request carries it (x-webhook-secret header or
// ?secret= in the trigger URL), compared timing-safe. Applies to every provider, mock included.
export const webhookAuthorized = q => { const s = process.env.SUMIT_WEBHOOK_SECRET || ''; if (s.length < 16) return false;
  return safeEqual(String(q.get('x-webhook-secret') || q.query?.secret || ''), s); };
app.post('/webhooks/payments', async (q, r) => { if (!webhookAuthorized(q)) return r.sendStatus(401); const res = await getPayments().handleWebhook(q.body, q.headers); if (!res.ok) return r.sendStatus(401); getDb().events.push({ at: new Date().toISOString(), ...res.event }); save(); r.sendStatus(200); });

const accountFor = q => { const db = getDb(); const a = Object.hasOwn(db.accounts, q.params.id) ? db.accounts[q.params.id] : null; return a && safeEqual(String(q.query.key ?? q.get('x-dashboard-key') ?? ''), a.key) ? a : null; };
function auth(q, r) { const a = accountFor(q); if (!a) { r.status(403).send('forbidden'); return null; } return a; }
// Magic-link login: always answers the same way so it can't be used to probe which emails exist.
async function login(q, r) { const email = String(q.body?.email || '').trim().toLowerCase(); const a = email && Object.values(getDb().accounts).find(x => x.email === email);
  if (a) await emailMagicLink(a, q.body?.lang); const msg = 'If that email has an account, we sent a sign-in link.'; return wantsJson(q) ? r.json({ ok: true, message: msg }) : r.send(V.message('Check your email', '', msg)); }
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
  await sendEmailSoft({ to: a.email, ...renderTx('cancel', lang, { planName: PLANS[a.plan].name, cancelDate: ymd(now), paidThrough: ymd(a.paidThrough), currency: a.billing?.currency }) });
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
  const hit = freeScanLookup(db, account, q.body);
  if (hit && hit.same) return r.json({ reportId: hit.reportId, existing: true });
  if (hit) return r.status(409).json(freeUsedBody(hit, q.body?.lang));
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
  r.json({ demo: !!s.mock, business: { name: b.name, category: b.category, city: b.city, website: b.website }, scan: s, previousScore: idx > 0 ? hist[idx - 1].summary.score : null, history: hist.slice(0, idx + 1).map(x => x.summary.score) }); });
app.post('/api/checkout', noCardData, captchaUnlessAdminTest, async (q, r) => { const c = await startCheckout(q); if (c?.refused) return refuseCheckout(r, c.refused); if (c?.prelaunch) return r.status(403).json({ error: 'Pre-launch: checkout is not open yet. Join the waitlist.', prelaunch: true }); if (!c) return r.status(400).json({ error: 'Choose a plan and enter your email.' }); r.json(c); });
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
// The checkout page is the only static page with a CSP (card entry): own origin + Turnstile, and the SUMIT script/API origins only while PAYMENTS_PROVIDER=sumit.
const checkoutCspFor = lang => checkoutCsp({ sumit: getPayments().id === 'sumit', turnstile: true, scriptSources: inlineScriptHashes(path.join(OUT, `${lang}/checkout.html`)) });
app.get('/:lang/:page', (q, r, next) => { if (!(LANGS.includes(q.params.lang) && ['scan', 'report', 'login', 'dashboard', 'checkout'].includes(q.params.page))) return next();
  if (q.params.page === 'checkout') { r.set('Content-Security-Policy', checkoutCspFor(q.params.lang)); } return page(r, q.params.lang, q.params.page); });
app.get(['/he.txt', '/en.txt', '/:lang/:page.txt'], (q, r) => { const f = path.join(OUT, q.path); return LANGS.some(l => q.path.startsWith('/' + l)) && fs.existsSync(f) && !q.path.includes('..') ? r.sendFile(f) : r.sendStatus(404); });
// Branded bilingual 404 (RTL Hebrew + English, order follows the URL language or preference). JSON for /api.
app.use((q, r) => { if (wantsJson(q)) return r.status(404).json({ error: 'not found' }); const m = /^\/(he|en)(\/|$)/.exec(q.path); r.status(404).type('html').send(notFoundPage(m ? m[1] : prefLang(q))); });

// Last-resort error handler. Express's default prints err.stack, and a malformed JSON body error can embed a fragment of the body
// (which on the checkout/charge routes could be card-adjacent data). Log only the method, path and error class; never the message.
app.use((err, q, r, next) => { if (r.headersSent) return next(err); const st = Number(err?.status || err?.statusCode) >= 400 && Number(err?.status || err?.statusCode) < 600 ? Number(err.status || err.statusCode) : 500;
  console.error(`[http] ${q.method} ${q.path} -> ${st} (${err?.type || err?.name || 'Error'})`); r.status(st).json({ error: st === 400 ? 'bad_request' : 'server_error' }); });
const port = process.env.PORT || 3000;
if (process.argv[1]?.endsWith('server.js')) { const cfg = (await import('./src/config-check.js')).logConfig(); if (cfg.fatal.length) { console.error('[config] FATAL: ' + cfg.fatal.join('; ')); process.exit(1); } if (!cfg.ok && process.env.CONFIG_STRICT === '1') process.exit(1); }
if (process.argv[1]?.endsWith('server.js') && process.env.BILLING_SYNC_CRON === '1') { startBillingCron(); console.log('billing sync: in-process daily scheduler on'); }
if (process.argv[1]?.endsWith('server.js')) app.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`${BRAND.name} on http://localhost:${port} (scans: ${isMockMode() ? 'MOCK' : 'LIVE'}, payments: ${getPayments().id})`));
export default app;
