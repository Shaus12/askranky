// Startup config check: reports which env vars a mode needs and which are missing or inconsistent. It only ever reports
// variable NAMES and booleans, never values.
export function checkConfig(env = process.env) {
  const E = k => !!env[k] && String(env[k]).trim() !== ''; const V = k => String(env[k] ?? '');
  const errors = [], warnings = [], modes = {};
  const scan = V('SCAN_MODE') || 'mock'; modes.SCAN_MODE = scan;
  if (!['mock', 'live'].includes(scan)) errors.push(`SCAN_MODE must be "mock" or "live"`);
  if (scan === 'live') { const eng = (V('LIVE_ENGINES') || 'chatgpt,gemini').split(',').map(s => s.trim()).filter(Boolean); const key = { chatgpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', perplexity: 'PERPLEXITY_API_KEY' };
    for (const e of eng) { if (!key[e]) errors.push(`LIVE_ENGINES has unknown engine "${e}"`); else if (!E(key[e])) errors.push(`${key[e]} missing (needed for live ${e})`); } }
  const pay = V('PAYMENTS_PROVIDER') || 'mock'; modes.PAYMENTS_PROVIDER = pay;
  if (!['mock', 'sumit'].includes(pay)) errors.push('PAYMENTS_PROVIDER must be "mock" or "sumit"');
  if (pay === 'sumit') { for (const k of ['SUMIT_COMPANY_ID', 'SUMIT_API_KEY', 'SUMIT_PUBLIC_API_KEY', 'SUMIT_WEBHOOK_SECRET']) if (!E(k) && !(k === 'SUMIT_PUBLIC_API_KEY' && E('SUMIT_API_PUBLIC_KEY'))) errors.push(`${k} missing (needed for PAYMENTS_PROVIDER=sumit)`);
    if (!E('BASE_URL')) errors.push('BASE_URL missing (SUMIT return URL)'); }
  const usd = ['1', 'true'].includes(V('ENABLE_USD_BILLING')); modes.ENABLE_USD_BILLING = usd;
  if (usd && pay === 'sumit' && V('SUMIT_USD_VERIFIED') !== '1') errors.push('ENABLE_USD_BILLING must be false: USD standing orders via SUMIT are unverified (ILS-only billing enforced)');
  const mail = V('EMAIL_MODE') || 'mock'; modes.EMAIL_MODE = mail;
  if (!['mock', 'live', 'resend'].includes(mail)) errors.push('EMAIL_MODE must be "mock" or "resend"');
  if (mail !== 'mock') { if (!E('RESEND_API_KEY')) errors.push('RESEND_API_KEY missing (needed for EMAIL_MODE=resend)'); if (!E('EMAIL_FROM')) warnings.push('EMAIL_FROM not set (default sender used)'); }
  const prod = V('NODE_ENV') === 'production'; modes.NODE_ENV = V('NODE_ENV') || 'development'; modes.DATABASE = E('DATABASE_URL') && V('STORE') !== 'json' && !E('FORCE_JSON_STORE') && (V('STORE') === 'postgres' || prod) ? 'postgres' : 'json';
  if (prod) {
    if (!E('DATABASE_URL')) warnings.push('DATABASE_URL not set: JSON file store on an ephemeral disk will lose data on redeploy');
    if (!E('BASE_URL')) warnings.push('BASE_URL not set (magic links and report links will point at localhost)');
    if (!E('TRUST_PROXY')) warnings.push('TRUST_PROXY not set (rate limits see the proxy IP on Render; set TRUST_PROXY=1)');
    if (!E('TURNSTILE_SECRET_KEY') || !E('TURNSTILE_SITE_KEY')) warnings.push('Turnstile keys not set (no CAPTCHA on scans)');
    if (scan === 'mock' || pay === 'mock') warnings.push('mock providers in production: pre-launch mode is on unless PRELAUNCH=0');
    if (mail === 'mock') warnings.push('EMAIL_MODE=mock in production: magic links and reports are not delivered');
  }
  const cap = Number(V('DAILY_SPEND_CAP_USD') || 10); if (!Number.isFinite(cap) || cap < 0) errors.push('DAILY_SPEND_CAP_USD must be a non-negative number'); modes.DAILY_SPEND_CAP_USD = cap;
  return { ok: !errors.length, errors, warnings, modes };
}
export function logConfig(log = console.log) { const r = checkConfig(); log(`[config] ${Object.entries(r.modes).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  for (const e of r.errors) log(`[config] ERROR ${e}`); for (const w of r.warnings) log(`[config] warn ${w}`); return r; }
