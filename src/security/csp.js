// Content-Security-Policy for the pages that handle card entry: the public checkout page (/{lang}/checkout) and the hidden admin
// 1 ILS test page (/admin/test-checkout). NOT site-wide: every other page is unchanged. The SUMIT origins are listed only on these
// pages and only while PAYMENTS_PROVIDER=sumit:
//   script-src  https://app.sumit.co.il      (payments.js)
//   connect-src https://api.sumit.co.il      (payments.js tokenizes the card straight against SUMIT's API, CORS *)
// jQuery (a hard dependency of payments.js) is self-hosted at /vendor/jquery-<ver>.min.js, so it needs no third-party origin.
// Turnstile (checkout only) needs challenges.cloudflare.com for script, frame and connect.
import crypto from 'node:crypto'; import fs from 'node:fs';
export const SUMIT_SCRIPT_ORIGIN = 'https://app.sumit.co.il', SUMIT_API_ORIGIN = 'https://api.sumit.co.il', TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
export const SUMIT_SCRIPT_URL = `${SUMIT_SCRIPT_ORIGIN}/scripts/payments.js`; export const JQUERY_PATH = '/vendor/jquery-3.7.1.min.js';
// sha256 hashes of the inline <script> blocks in a Next.js static export page (cached by mtime), so the page needs no 'unsafe-inline' scripts.
const hashCache = new Map();
export function inlineScriptHashes(file) {
  let st; try { st = fs.statSync(file); } catch { return []; }
  const c = hashCache.get(file); if (c && c.mtime === st.mtimeMs) return c.hashes;
  const html = fs.readFileSync(file, 'utf8'); const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].trim()) hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  const out = [...hashes]; hashCache.set(file, { mtime: st.mtimeMs, hashes: out }); return out;
}
const policy = d => Object.entries(d).map(([k, v]) => [k, ...v].join(' ')).join('; ');
// opts: sumit (bool: provider is sumit), turnstile (bool), scriptSources (extra script-src tokens: hashes/nonces), styleSources, extraConnect.
// fonts: the site loads its web fonts from Google Fonts (CSS from fonts.googleapis.com, files from fonts.gstatic.com), also on the checkout page.
export function checkoutCsp({ sumit = false, turnstile = false, fonts = true, scriptSources = [], styleSources = ["'unsafe-inline'"] } = {}) {
  return policy({
    'default-src': ["'none'"],
    'script-src': ["'self'", ...scriptSources, ...(sumit ? [SUMIT_SCRIPT_ORIGIN] : []), ...(turnstile ? [TURNSTILE_ORIGIN] : [])],
    'connect-src': ["'self'", ...(sumit ? [SUMIT_API_ORIGIN] : []), ...(turnstile ? [TURNSTILE_ORIGIN] : [])],
    'frame-src': turnstile ? [TURNSTILE_ORIGIN] : ["'none'"],
    'img-src': ["'self'", 'data:'], 'font-src': ["'self'", 'data:', ...(fonts ? ['https://fonts.gstatic.com'] : [])], 'style-src': ["'self'", ...styleSources, ...(fonts ? ['https://fonts.googleapis.com'] : [])], 'manifest-src': ["'self'"],
    'form-action': ["'self'"], 'base-uri': ["'self'"], 'object-src': ["'none'"], 'frame-ancestors': ["'none'"],
  });
}
export const adminNonce = () => crypto.randomBytes(16).toString('base64');
