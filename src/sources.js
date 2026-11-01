// Per-source funnel (GET /api/internal/status -> funnel.sources): which post / campaign brought sessions, and how many of them became
// scans, email unlocks, signups and payments. First-party, aggregate only:
//  * The web app keeps the FIRST touch of the tab (utm_source / utm_campaign / utm_medium, or the referrer host when no utm) in
//    sessionStorage and sends it ONCE per tab session to POST /api/v/land (navigator.sendBeacon). The server counts it in memory per
//    UTC day x source x campaign x medium (+ a distinct-visitor count from the same in-memory daily hash as src/funnel.js, never stored)
//    and persists aggregate 'funnel.src_visits' events {day, s, c, m, n, u} together with flushVisits(). Bots, prefetch and our monitors
//    (X-Ranky-Monitor: 1) are excluded with the same rule as page views.
//  * The same attribution travels with POST /api/scan (scan.utm, account.utm first touch), so funnel.scan_started / funnel.email_unlocked
//    events carry {src} and signups / payments use the account's first touch.
// Cardinality: at most MAX_KEYS_PER_DAY keys per day in memory (later new keys fold into 'other'); output = top TOP rows per window, the
// rest summed into one 'other' row. Values are pre-sanitized (src/utm.js: [A-Za-z0-9_.-] / host names only), so no HTML or PII can appear.
import crypto from 'node:crypto'; import { cleanUtm, cleanRef, srcOf } from './utm.js'; import { BOT } from './funnel.js'; import { isOwnerEmail } from './owner.js';
export const TOP = 20; const MAX_KEYS_PER_DAY = 300; const SEP = '\u0001';
let mem = {}; let salt = crypto.randomBytes(16).toString('hex'); const seen = new Map();
const day = (d = new Date()) => d.toISOString().slice(0, 10);
export function countLanding(q, now = new Date()) {
  const ua = String(q.get('user-agent') || ''); const purpose = String(q.get('sec-purpose') || q.get('purpose') || '');
  if (!ua || BOT.test(ua) || /prefetch|prerender/i.test(purpose) || q.get('x-ranky-monitor')) return false;
  const b = q.body && typeof q.body === 'object' ? q.body : {}; const s = cleanUtm(b.utm_source), c = cleanUtm(b.utm_campaign);
  const k = srcOf({ source: s, campaign: c, medium: cleanUtm(b.utm_medium), ref: s || c ? null : cleanRef(b.utm_ref) }); const d = day(now);
  let key = [k.source, k.campaign, k.medium].join(SEP); mem[d] ||= {}; if (!mem[d][key] && Object.keys(mem[d]).length >= MAX_KEYS_PER_DAY) key = ['other', '-', '-'].join(SEP);
  const row = mem[d][key] ||= { n: 0, u: 0 }; row.n++;
  if (!seen.has(d)) { for (const x of seen.keys()) if (x < d) seen.delete(x); seen.set(d, new Set()); }
  const h = crypto.createHash('sha256').update(`${salt}|${d}|${key}|${q.ip || ''}|${ua}`).digest('base64url').slice(0, 16); const set = seen.get(d);
  if (!set.has(h) && set.size < 100000) { set.add(h); row.u++; }
  return true;
}
export function flushSources(db, now = new Date()) { let n = 0; for (const [d, rows] of Object.entries(mem)) for (const [key, v] of Object.entries(rows)) { if (!v.n) continue; const [s, c, m] = key.split(SEP); db.events.push({ at: now.toISOString(), type: 'funnel.src_visits', day: d, s, c, m, n: v.n, u: v.u }); n++; } mem = {}; return n; }
export const resetSourcesMemory = () => { mem = {}; seen.clear(); salt = crypto.randomBytes(16).toString('hex'); };
const STEPS = ['visits', 'visitors', 'scanStarted', 'scanDone', 'emailUnlocked', 'signup', 'paid'];
export function buildSources(db, now = new Date(), test = new Set()) {
  const T = +now, DAY = 864e5; const W = { last7Days: t => t > T - 7 * DAY, sinceTracking: () => true };
  const out = Object.fromEntries(Object.keys(W).map(w => [w, {}]));
  const add = (k, step, at, n = 1) => { const t = Date.parse(at); if (!Number.isFinite(t)) return; const key = [k.source, k.campaign, k.medium].join(SEP); for (const [w, f] of Object.entries(W)) if (f(t)) { const r = out[w][key] ||= Object.fromEntries(STEPS.map(x => [x, 0])); r[step] += n; } };
  const evs = (db.events || []).filter(e => e && !e.test && !e.internal && !test.has(e.account)); const since = evs.filter(e => e.type === 'funnel.src_visits').map(e => `${e.day}T00:00:00.000Z`).sort()[0] || null;
  const accs = db.accounts || {}; const accSrc = id => { let a = accs[id]; for (let i = 0; a?.mergedInto && i < 3; i++) a = accs[a.mergedInto]; return a?.utm ? srcOf(a.utm) : null; };
  const fromRow = e => ({ source: cleanUtm(e.s) || (String(e.s).startsWith('ref:') && cleanRef(String(e.s).slice(4)) ? String(e.s) : e.s === 'other' ? 'other' : 'direct'), campaign: (cleanUtm(e.c) || '-').toLowerCase(), medium: (cleanUtm(e.m) || '-').toLowerCase() });
  for (const e of evs) {
    const at12 = `${e.day}T12:00:00.000Z`;
    if (e.type === 'funnel.src_visits') { const k = fromRow(e); add(k, 'visits', at12, Number(e.n) || 0); add(k, 'visitors', at12, Number(e.u) || 0); }
    else if (e.type === 'funnel.scan_started') add(e.src ? srcOf(e.src) : accSrc(e.account) || srcOf(null), 'scanStarted', e.at);
    else if (e.type === 'funnel.email_unlocked') add(e.src ? srcOf(e.src) : accSrc(e.account) || srcOf(null), 'emailUnlocked', e.at);
    else if (e.type === 'subscription.activated' || e.type === 'order.paid') add(accSrc(e.account) || srcOf(null), 'paid', e.at);
  }
  for (const [d, rows] of Object.entries(mem)) for (const [key, v] of Object.entries(rows)) { const [s, c, m] = key.split(SEP); add({ source: s, campaign: c, medium: m }, 'visits', `${d}T12:00:00.000Z`, v.n); add({ source: s, campaign: c, medium: m }, 'visitors', `${d}T12:00:00.000Z`, v.u); }
  for (const s of Object.values(db.scans || {})) if (s && !s.auto && !s.fixupOrder && !s.internal && !test.has(s.accountId) && (!since || s.at >= since)) add(s.utm ? srcOf(s.utm) : accSrc(s.accountId) || srcOf(null), 'scanDone', s.at);
  for (const a of Object.values(accs)) if (a && !a.guest && !test.has(a.id) && !isOwnerEmail(a.email) && (!since || a.createdAt >= since)) add(srcOf(a.utm), 'signup', a.createdAt);
  const shape = rows => { const list = Object.entries(rows).map(([key, r]) => { const [source, campaign, medium] = key.split(SEP); return { source, campaign, medium, ...r }; })
      .sort((a, b) => b.visits - a.visits || b.scanStarted - a.scanStarted || a.source.localeCompare(b.source) || a.campaign.localeCompare(b.campaign));
    const top = list.filter(r => r.source !== 'other').slice(0, TOP); const rest = list.filter(r => !top.includes(r));
    if (rest.length) { const o = { source: 'other', campaign: '-', medium: '-', ...Object.fromEntries(STEPS.map(x => [x, 0])), groupedRows: rest.length }; for (const r of rest) for (const x of STEPS) o[x] += r[x]; top.push(o); }
    return top; };
  return { trackingSince: since, top: TOP, last7Days: shape(out.last7Days), sinceTracking: shape(out.sinceTracking),
    note: 'first touch per browser tab session: utm_source/utm_campaign/utm_medium, else ref:HOST (referrer host name), else direct; visits = tab sessions (one landing beacon each), visitors = distinct browsers per UTC day per source (in-memory hash, never stored); scanStarted/emailUnlocked/paid from events, scanDone/signup from records since trackingSince; owner/test/monitor/bot traffic excluded; top 20 rows per window, the rest in "other"' };
}
