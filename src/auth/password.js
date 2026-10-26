// Password hashing: Node's built-in scrypt, 16-byte per-user salt, parameters stored with the hash so they can be raised later.
// Verification is timing-safe; a dummy hash is checked when the account has no password so timing does not reveal it.
import crypto from 'node:crypto';
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
export const MIN_PASSWORD = 10, MAX_PASSWORD = 256;
const scrypt = (pw, salt, { N, r, p, keylen }) => new Promise((res, rej) => crypto.scrypt(String(pw).normalize('NFKC'), salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 + 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)));
// Policy (NIST 800-63B style): length only, no composition rules; a short blocklist of the most common choices.
const COMMON = new Set(['1234567890', '0123456789', '12345678910', 'password12', 'password123', 'qwertyuiop', '1111111111', 'askranky123', 'ranky12345', 'aaaaaaaaaa', 'abcdefghij', 'iloveyou12']);
export function passwordProblem(pw) {
  if (typeof pw !== 'string') return 'password_required';
  const n = [...pw].length; if (n < MIN_PASSWORD) return 'password_short'; if (n > MAX_PASSWORD) return 'password_long';
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return 'password_common';
  return null;
}
export async function hashPassword(pw, params = SCRYPT) {
  const salt = crypto.randomBytes(16); const k = await scrypt(pw, salt, params);
  return { alg: 'scrypt', N: params.N, r: params.r, p: params.p, keylen: params.keylen, salt: salt.toString('base64'), hash: k.toString('base64') };
}
let dummy = null; const dummyHash = () => (dummy ||= hashPassword('dummy-password-for-timing'));
export async function verifyPassword(stored, pw) {
  if (typeof pw !== 'string' || pw.length > MAX_PASSWORD * 4) return false;
  const s = stored && stored.alg === 'scrypt' && stored.salt && stored.hash ? stored : await dummyHash();
  const N = Number(s.N), r = Number(s.r), p = Number(s.p), keylen = Number(s.keylen);
  if (!(N >= 2 ** 14 && N <= 2 ** 20 && r >= 1 && r <= 32 && p >= 1 && p <= 16 && keylen >= 32 && keylen <= 128)) return false;
  const k = await scrypt(pw, Buffer.from(s.salt, 'base64'), { N, r, p, keylen }); const h = Buffer.from(s.hash, 'base64');
  return h.length === k.length && crypto.timingSafeEqual(h, k) && stored === s;
}
