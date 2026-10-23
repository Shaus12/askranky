import { parseFrom } from './email/send.js';
// Startup config check: reports which env vars a mode needs and which are missing or inconsistent. It only ever reports
// variable NAMES and booleans, never values.
export function checkConfig(env = process.env) {
  const E = k => !!env[k] && String(env[k]).trim() !== ''; const V = k => String(env[k] ?? '');
  const errors = [], warnings = [], fatal = [], modes = {};
  const scan = V('SCAN_MODE') || 'mock'; modes.SCAN_MODE = scan;
  if (!['mock', 'live'].includes(scan)) errors.push(`SCAN_MODE must be "mock" or "live"`);
  if (scan === 'live') { const eng = (V('LIVE_ENGINES') || 'chatgpt,gemini').split(',').map(s => s.trim()).filter(Boolean); const key = { chatgpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', perplexity: 'PERPLEXITY_API_KEY' };
    for (const e of eng) { if (!key[e]) errors.push(`LIVE_ENGINES has unknown engine "${e}"`); else if (!E(key[e])) errors.push(`${key[e]} missing (needed for live ${e})`); } }
  const pay = V('PAYMENTS_PROVIDER') || 'mock'; modes.PAYMENTS_PROVIDER = pay;
  if (!['mock', 'sumit'].includes(pay)) errors.push('PAYMENTS_PROVIDER must be "mock" or "sumit"');
  if (pay === 'sumit') { for (const k of ['SUMIT_COMPANY_ID', 'SUMIT_API_KEY', 'SUMIT_PUBLIC_API_KEY', 'SUMIT_WEBHOOK_SECRET']) if (!E(k) && !(k === 'SUMIT_PUBLIC_API_KEY' && E('SUMIT_API_PUBLIC_KEY'))) errors.push(`${k} missing (needed for PAYMENTS_PROVIDER=sumit)`);
    // Embedded Payments JS: the browser gets SUMIT_COMPANY_ID + the PUBLIC key only. Catch the one dangerous misconfiguration: the private key pasted as the public one.
    const pub = V('SUMIT_PUBLIC_API_KEY') || V('SUMIT_API_PUBLIC_KEY');
    if (E('SUMIT_COMPANY_ID') && !/^[1-9]\d{0,12}$/.test(V('SUMIT_COMPANY_ID').trim())) errors.push('SUMIT_COMPANY_ID must be the numeric SUMIT company id');
    if (pub && pub === V('SUMIT_API_KEY')) errors.push('SUMIT_PUBLIC_API_KEY must be the PUBLIC API key, not the private SUMIT_API_KEY (the public key is sent to the browser)');
    if (!E('BASE_URL')) errors.push('BASE_URL missing (dashboard magic links in receipt emails; SUMIT no longer redirects back)'); }
  const usd = ['1', 'true'].includes(V('ENABLE_USD_BILLING')); modes.ENABLE_USD_BILLING = usd;
  if (usd && pay === 'sumit' && V('SUMIT_USD_VERIFIED') !== '1') errors.push('ENABLE_USD_BILLING must be false: USD standing orders via SUMIT are unverified (ILS-only billing enforced)');
  const mail = V('EMAIL_MODE') || 'mock'; modes.EMAIL_MODE = mail;
  if (!['mock', 'live', 'resend'].includes(mail)) errors.push('EMAIL_MODE must be "mock" or "resend"');
  if (mail !== 'mock') { if (!E('RESEND_API_KEY')) errors.push('RESEND_API_KEY missing (needed for EMAIL_MODE=resend)'); if (!E('EMAIL_FROM')) warnings.push('EMAIL_FROM not set (default sender "Ranky <hello@askranky.com>" used; its domain must be verified in Resend)');
    else { const f = parseFrom(V('EMAIL_FROM')); const dom = (V('BRAND_DOMAIN') || 'askranky.com').toLowerCase();
      if (!f) errors.push('EMAIL_FROM must be an address ("hello@askranky.com") or a name plus address ("Ranky <hello@askranky.com>")');
      else if (f.domain !== dom && !f.domain.endsWith('.' + dom)) warnings.push(`EMAIL_FROM domain is not ${dom}: it must be a domain verified in Resend (recommended: hello@${dom}, the root domain)`); } if (!E('UNSUBSCRIBE_SECRET')) errors.push('UNSUBSCRIBE_SECRET missing (signs unsubscribe links; needed for EMAIL_MODE=resend)'); }
  if (!E('EMAIL_REPLY_TO')) warnings.push('EMAIL_REPLY_TO not set (replies go to SUPPORT_EMAIL)');
  const prod = V('NODE_ENV') === 'production'; modes.NODE_ENV = V('NODE_ENV') || 'development'; modes.DATABASE = E('DATABASE_URL') && V('STORE') !== 'json' && !E('FORCE_JSON_STORE') && (V('STORE') === 'postgres' || prod) ? 'postgres' : 'json';
  if (prod) {
    if (!E('DATABASE_URL')) warnings.push('DATABASE_URL not set: JSON file store on an ephemeral disk will lose data on redeploy');
    if (!E('BASE_URL')) warnings.push('BASE_URL not set (magic links and report links will point at localhost)');
    if (!E('TRUST_PROXY')) warnings.push('TRUST_PROXY not set (rate limits see the proxy IP on Render; set TRUST_PROXY=1)');
    // Turnstile guards scan, login, waitlist and checkout. Real go-live mode (production, pre-launch off) must not start without both keys.
    const pl = V('PRELAUNCH').toLowerCase(); const prelaunch = pl === '1' || pl === 'true' ? true : pl === '0' || pl === 'false' ? false : (scan === 'mock' || pay === 'mock');
    const tsSite = E('TURNSTILE_SITE_KEY'), tsSecret = E('TURNSTILE_SECRET_KEY'); modes.TURNSTILE = tsSite && tsSecret ? 'on' : tsSite || tsSecret ? 'partial' : 'off';
    if (tsSite !== tsSecret) warnings.push(`Only ${tsSite ? 'TURNSTILE_SITE_KEY' : 'TURNSTILE_SECRET_KEY'} is set: set both or neither (with only the secret there is no widget and every request is rejected; with only the site key nothing is enforced)`);
    if (!tsSite && !tsSecret) warnings.push('Turnstile keys not set (no CAPTCHA on scan, login, waitlist or checkout)');
    if (!prelaunch && !(tsSite && tsSecret)) { const m = `TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must both be set in live mode (production with pre-launch off); refusing to start without CAPTCHA`; errors.push(m); fatal.push(m); }
    if (scan === 'mock' || pay === 'mock') warnings.push('mock providers in production: pre-launch mode is on unless PRELAUNCH=0');
    if (E('ADMIN_TEST_TOKEN') && V('ADMIN_TEST_TOKEN').length < 16) errors.push('ADMIN_TEST_TOKEN must be at least 16 characters');
    if (!E('SUMIT_WEBHOOK_SECRET')) warnings.push('SUMIT_WEBHOOK_SECRET not set: all billing webhooks are rejected (401)');
    if (mail === 'mock') warnings.push('EMAIL_MODE=mock in production: magic links and reports are not delivered');
  }
  const cap = Number(V('DAILY_SPEND_CAP_USD') || 10); if (!Number.isFinite(cap) || cap < 0) errors.push('DAILY_SPEND_CAP_USD must be a non-negative number'); modes.DAILY_SPEND_CAP_USD = cap;
  return { ok: !errors.length, errors, warnings, fatal, modes };
}
export function logConfig(log = console.log) { const r = checkConfig(); log(`[config] ${Object.entries(r.modes).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  for (const e of r.errors) log(`[config] ERROR ${e}`); for (const w of r.warnings) log(`[config] warn ${w}`); return r; }
