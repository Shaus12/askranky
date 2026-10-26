// Google sign-in: OAuth 2.0 authorization code + PKCE (S256) + OpenID Connect, hand-written (no new dependency).
// Feature-off unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set. The id_token is verified here (RS256 against Google's
// JWKS, iss, aud, exp, nonce); an account is matched by Google subject, else by email only when Google says email_verified.
import crypto from 'node:crypto';
export const googleEnabled = (env = process.env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const EP = () => ({ auth: process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth', token: process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token', jwks: process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs' });
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const redirectUri = base => `${String(base).replace(/\/+$/, '')}/auth/google/callback`;
const b64u = b => Buffer.from(b).toString('base64url');
export function startAuth(base) {
  const state = b64u(crypto.randomBytes(24)), nonce = b64u(crypto.randomBytes(24)), verifier = b64u(crypto.randomBytes(48));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const u = new URL(EP().auth); for (const [k, v] of Object.entries({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(base), response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' })) u.searchParams.set(k, v);
  return { url: u.toString(), state, nonce, verifier };
}
let jwksCache = null;
async function jwks(force) { if (!force && jwksCache && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys; const r = await fetch(EP().jwks); if (!r.ok) throw new Error('jwks'); const j = await r.json(); jwksCache = { at: Date.now(), keys: j.keys || [] }; return jwksCache.keys; }
export const _resetJwks = () => { jwksCache = null; };
export async function verifyIdToken(idt, { nonce, now = Date.now() }) {
  const parts = String(idt || '').split('.'); if (parts.length !== 3) throw new Error('id_token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url')); const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
  if (header.alg !== 'RS256') throw new Error('alg');
  let key = (await jwks()).find(k => k.kid === header.kid); if (!key) key = (await jwks(true)).find(k => k.kid === header.kid); if (!key) throw new Error('kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('signature');
  if (!ISSUERS.includes(claims.iss)) throw new Error('iss');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]; if (!aud.includes(process.env.GOOGLE_CLIENT_ID)) throw new Error('aud');
  if (aud.length > 1 && claims.azp !== process.env.GOOGLE_CLIENT_ID) throw new Error('azp');
  if (!(Number(claims.exp) * 1000 > now - 60e3)) throw new Error('exp');
  if (!nonce || typeof claims.nonce !== 'string' || claims.nonce.length !== nonce.length || !crypto.timingSafeEqual(Buffer.from(claims.nonce), Buffer.from(nonce))) throw new Error('nonce');
  if (!claims.sub) throw new Error('sub');
  return claims;
}
export async function exchangeCode(code, verifier, base) {
  const body = new URLSearchParams({ code: String(code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(base), grant_type: 'authorization_code', code_verifier: verifier });
  const r = await fetch(EP().token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
  if (!r.ok) throw new Error('token_exchange'); const j = await r.json(); if (!j.id_token) throw new Error('no_id_token'); return j.id_token;
}
