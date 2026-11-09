// First-touch landing buckets for GET /api/internal/status -> funnel.landing.
// The browser sends only a bucket name (he, en, blog, report, agencies, other), never a URL, query string, or report id.
// Visits are the same once-per-tab POST /api/v/land beacon as src/sources.js (bots, prefetch, and X-Ranky-Monitor excluded there).
// Counts stay in memory per UTC day and flush as aggregate funnel.path_visits events {day, p, n, u}. Nothing about the visitor is stored.
import crypto from 'node:crypto';
import { isOwnerEmail } from './owner.js';

export const BUCKETS = ['he', 'en', 'blog', 'report', 'agencies', 'other'];
export const cleanBucket = v => { const s = typeof v === 'string' ? v.trim() : ''; return BUCKETS.includes(s) ? s : null; };
export const landFrom = body => cleanBucket(body?.path);
// First touch only: a later page in the same account never overwrites the bucket.
export function applyLand(account, body) { if (!account || account.land) return false; const p = landFrom(body); if (!p) return false; account.land = p; return true; }

let mem = {}; let salt = crypto.randomBytes(16).toString('hex'); const seen = new Map();
const day = (d = new Date()) => d.toISOString().slice(0, 10);
export function countPath(q, raw, now = new Date()) {
  const p = cleanBucket(raw); if (!p) return false;
  const d = day(now); mem[d] ||= {}; const row = mem[d][p] ||= { n: 0, u: 0 }; row.n++;
  if (!seen.has(d)) { for (const x of seen.keys()) if (x < d) seen.delete(x); seen.set(d, new Set()); }
  const ua = String(q.get?.('user-agent') || '');
  const h = crypto.createHash('sha256').update(`${salt}|${d}|${p}|${q.ip || ''}|${ua}`).digest('base64url').slice(0, 16); const set = seen.get(d);
  if (!set.has(h) && set.size < 100000) { set.add(h); row.u++; }
  return true;
}
export function flushPaths(db, now = new Date()) {
  let n = 0;
  for (const [d, rows] of Object.entries(mem)) for (const [p, v] of Object.entries(rows)) {
    if (!v?.n || !cleanBucket(p)) continue;
    db.events.push({ at: now.toISOString(), type: 'funnel.path_visits', day: d, p, n: v.n, u: v.u }); n++;
  }
  mem = {}; return n;
}
export const resetPathsMemory = () => { mem = {}; seen.clear(); salt = crypto.randomBytes(16).toString('hex'); };

const STEPS = ['visits', 'visitors', 'scanStarted', 'scanDone', 'emailUnlocked', 'signup', 'paid'];
const row0 = () => Object.fromEntries(STEPS.map(s => [s, 0]));
export function buildLanding(db, now = new Date(), test = new Set()) {
  const T = +now, DAY = 864e5, today = day(now);
  const W = { today: d => d === today, last7Days: (d, t) => t > T - 7 * DAY, sinceTracking: () => true };
  const out = Object.fromEntries(Object.keys(W).map(w => [w, Object.fromEntries(BUCKETS.map(p => [p, row0()]))]));
  const add = (p, step, at, n = 1) => { const b = cleanBucket(p); const t = Date.parse(at); if (!b || !Number.isFinite(t) || !Number.isFinite(n)) return; const d = String(at).slice(0, 10); for (const [w, f] of Object.entries(W)) if (f(d, t)) out[w][b][step] += n; };
  const evs = (db.events || []).filter(e => e && !e.test && !e.internal && !test.has(e.account));
  const since = evs.filter(e => e.type === 'funnel.path_visits').map(e => `${e.day}T00:00:00.000Z`).sort()[0] || null;
  // Before the first flush, only buckets recorded from the start of this UTC day count. Older rows have no stored bucket.
  const sinceCut = since || `${today}T00:00:00.000Z`;
  const accs = db.accounts || {};
  const accLand = id => { let a = accs[id]; for (let i = 0; a?.mergedInto && i < 3; i++) a = accs[a.mergedInto]; return cleanBucket(a?.land); };
  for (const e of evs) {
    const at12 = `${e.day}T12:00:00.000Z`;
    if (e.type === 'funnel.path_visits') { add(e.p, 'visits', at12, Number(e.n) || 0); add(e.p, 'visitors', at12, Number(e.u) || 0); }
    else if (e.type === 'funnel.scan_started' && e.at >= sinceCut) add(e.land, 'scanStarted', e.at);
    else if (e.type === 'funnel.email_unlocked' && e.at >= sinceCut) add(e.land, 'emailUnlocked', e.at);
    else if ((e.type === 'subscription.activated' || e.type === 'order.paid') && e.at >= sinceCut) add(accLand(e.account), 'paid', e.at);
  }
  for (const [d, rows] of Object.entries(mem)) for (const [p, v] of Object.entries(rows)) { add(p, 'visits', `${d}T12:00:00.000Z`, v.n); add(p, 'visitors', `${d}T12:00:00.000Z`, v.u); }
  for (const s of Object.values(db.scans || {})) if (s && !s.auto && !s.fixupOrder && !s.internal && !test.has(s.accountId) && s.at >= sinceCut) add(s.land, 'scanDone', s.at);
  for (const a of Object.values(accs)) if (a && !a.guest && !test.has(a.id) && !isOwnerEmail(a.email) && a.createdAt >= sinceCut) add(a.land, 'signup', a.createdAt);
  const shape = rows => BUCKETS.map(path => ({ path, ...rows[path] }));
  return { trackingSince: since, today: shape(out.today), last7Days: shape(out.last7Days), sinceTracking: shape(out.sinceTracking),
    note: 'First-touch page bucket of the browser tab (the first page that sent POST /api/v/land). Buckets only: he (/he), en (/en), blog (either language), report (/r/ pages; the report id is never stored), agencies, other. Historical visits from before this field existed have no bucket and are omitted. visits = tab sessions, visitors = distinct browsers per UTC day per bucket (in-memory hash, never stored). scanStarted, scanDone, emailUnlocked, signup and paid count only records that stored a bucket, since trackingSince. Owner, test, monitor and bot traffic excluded. No full URLs or query strings.' };
}
