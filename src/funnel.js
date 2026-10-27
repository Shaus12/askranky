// First-party conversion funnel (aggregate counts only) for GET /api/internal/status. No cookies, no client-side storage, no third
// parties, no personal data: nothing about the visitor (IP, user agent, id) is stored, so it runs without the consent banner.
// Steps: visit -> scan started -> scan done -> signup -> checkout started -> paid.
//  * visit: server-side counter of 200 GET responses for public HTML pages (/he, /en, /{lang}/pricing|scan|report|blog...), skipping
//    obvious bots and prefetches. Counted in memory per UTC day and persisted as aggregate 'funnel.visits' events {day, n} at most every
//    FUNNEL_FLUSH_MS (default 10 min; the events list is an existing table, so no DB migration is needed).
//  * scan started: 'funnel.scan_started' event per accepted scan request (after CAPTCHA). scan done: stored scans (not automatic re-scans
//    or Fix-up scans). signup: accounts created. checkout started: 'checkout.started' events. paid: 'subscription.activated' + 'order.paid'.
// Test/admin activity is excluded.
import { getDb, save } from './store.js';
const BOT = /^node$|undici|bot|crawl|spider|slurp|preview|monitor|facebookexternalhit|curl|wget|python|httpclient|axios|node-fetch|headless|lighthouse|pingdom|uptime/i;
export const PAGE = /^\/(?:he|en)(?:\/(?:pricing|scan|report|blog(?:\/[^/]+)?|legal(?:\/[^/]+)?))?\/?$/;
let mem = {}; let lastFlush = Date.now();
const day = (d = new Date()) => d.toISOString().slice(0, 10);
export function flushVisits(now = new Date()) {
  const entries = Object.entries(mem).filter(([, n]) => n > 0); if (!entries.length) return 0; const db = getDb();
  for (const [d, n] of entries) db.events.push({ at: now.toISOString(), type: 'funnel.visits', day: d, n }); mem = {}; lastFlush = +now; save(); return entries.length;
}
export function countVisit(q, now = new Date()) {
  if (q.method !== 'GET' || !PAGE.test(q.path)) return false;
  const ua = String(q.get('user-agent') || ''); const purpose = String(q.get('sec-purpose') || q.get('purpose') || '');
  if (!ua || BOT.test(ua) || /prefetch|prerender/i.test(purpose)) return false;
  mem[day(now)] = (mem[day(now)] || 0) + 1;
  if (+now - lastFlush >= Number(process.env.FUNNEL_FLUSH_MS || 600000)) flushVisits(now);
  return true;
}
export const visitMiddleware = (q, r, next) => { if (q.method === 'GET' && PAGE.test(q.path)) r.on('finish', () => { if (r.statusCode === 200) countVisit(q); }); next(); };
export const resetFunnelMemory = () => { mem = {}; lastFlush = Date.now(); };
const STEPS = ['visit', 'scanStarted', 'scanDone', 'signup', 'checkoutStarted', 'paid'];
export function buildFunnel(db, now = new Date()) {
  const T = +now, DAY = 864e5; const windows = { today: d => d === day(now), last7Days: (d, t) => t > T - 7 * DAY, last30Days: (d, t) => t > T - 30 * DAY, total: () => true };
  const out = Object.fromEntries(Object.keys(windows).map(k => [k, Object.fromEntries(STEPS.map(s => [s, 0]))]));
  const add = (step, at, n = 1) => { const t = Date.parse(at); if (!Number.isFinite(t)) return; const d = String(at).slice(0, 10); for (const [k, f] of Object.entries(windows)) if (f(d, t)) out[k][step] += n; };
  const test = new Set(Object.values(db.accounts || {}).filter(a => a.testSubscription || a.adminTest || a.pendingTest).map(a => a.id));
  for (const e of db.events || []) {
    if (!e || test.has(e.account) || e.test) continue;
    if (e.type === 'funnel.visits') add('visit', `${e.day}T12:00:00.000Z`, Number(e.n) || 0);
    else if (e.type === 'funnel.scan_started') add('scanStarted', e.at);
    else if (e.type === 'checkout.started') add('checkoutStarted', e.at);
    else if (e.type === 'subscription.activated' || e.type === 'order.paid') add('paid', e.at);
  }
  for (const [d, n] of Object.entries(mem)) add('visit', `${d}T12:00:00.000Z`, n);
  for (const s of Object.values(db.scans || {})) if (s && !s.auto && !s.fixupOrder && !test.has(s.accountId)) add('scanDone', s.at);
  for (const a of Object.values(db.accounts || {})) if (a && !test.has(a.id)) add('signup', a.createdAt);
  const pct = (a, b) => (a > 0 ? Math.round((b / a) * 1000) / 10 : null); const m = out.last30Days;
  out.conversionLast30DaysPct = { visitToScan: pct(m.visit, m.scanStarted), scanStartToDone: pct(m.scanStarted, m.scanDone), scanToSignup: pct(m.scanDone, m.signup), signupToCheckout: pct(m.signup, m.checkoutStarted), checkoutToPaid: pct(m.checkoutStarted, m.paid) };
  const since = (db.events || []).filter(e => e && /^funnel\./.test(e.type)).map(e => e.at).sort()[0] || null;
  out.trackingSince = since; // visit/scanStarted only exist from this moment (first deploy of the funnel); scanDone/signup are backfilled from stored records
  out.note = 'visit and scanStarted are counted only since trackingSince; scanDone and signup include older records; visit = server-side count of public page views (bots/prefetch excluded, no cookies, no personal data); days are UTC';
  return out;
}
