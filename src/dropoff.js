// Scan drop-off tracking (aggregate counts only, no cookies, no personal data). Shows where people who try the free scan stop:
// form submit attempts, Turnstile not solved / failed / expired, the city-confirm prompt, the scan request, leaving the progress page while
// a scan runs, the error screen, and the report view. Client events arrive at POST /api/funnel/e as {e, iab} where e is one of
// CLIENT_EVENTS and iab is a coarse 0/1 "in-app browser" flag computed in the browser (Facebook/Instagram/LinkedIn/short-video apps... UA) - the raw
// user agent, IP, page, business or any id is never sent or stored. Bots, prefetches and our monitors (X-Ranky-Monitor) are ignored,
// cross-site posts are ignored, and each IP gets at most CLIENT_EVENT_MAX events per 10 minutes (silently dropped beyond that).
// Counted in memory per UTC day x event x iab (bounded keys) and persisted with flushVisits() as 'funnel.client' events {day, e, iab, n}.
// Server-side event: scan_client_left = POST /api/scan connection closed before the scan answered (the scan itself still finishes and is
// stored; the visitor just never sees it).
import { BOT } from './funnel.js';
export const CLIENT_EVENTS = ['form_submit_attempted', 'turnstile_missing', 'turnstile_error', 'turnstile_expired', 'turnstile_unsupported', 'turnstile_load_failed', 'turnstile_timeout', 'turnstile_blocked', 'scan_form_viewed', 'city_confirm_shown', 'scan_request_sent', 'scan_progress_left', 'scan_error_shown', 'scan_report_ready', 'report_viewed', 'locked_report_viewed'];
export const SERVER_EVENTS = ['scan_client_left'];
const ALL = new Set([...CLIENT_EVENTS, ...SERVER_EVENTS]);
let mem = {}; // "day|e|iab" -> n
const day = (d = new Date()) => d.toISOString().slice(0, 10);
export function countEvent(e, iab = 0, now = new Date()) { if (!ALL.has(e)) return false; const k = `${day(now)}|${e}|${iab ? 1 : 0}`; if (!(k in mem) && Object.keys(mem).length > 500) return false; mem[k] = (mem[k] || 0) + 1; return true; }
export function flushEvents(db, now = new Date()) { let n = 0; for (const [k, v] of Object.entries(mem)) { if (!v) continue; const [d, e, iab] = k.split('|'); db.events.push({ at: now.toISOString(), type: 'funnel.client', day: d, e, iab: Number(iab), n: v }); n++; } mem = {}; return n; }
export const resetEventsMemory = () => { mem = {}; };
const hits = new Map(); let hitsWindow = 0;
const allowed = (ip, max = Number(process.env.CLIENT_EVENT_MAX || 40), now = Date.now()) => { if (now - hitsWindow > 600000) { hits.clear(); hitsWindow = now; } const c = (hits.get(ip) || 0) + 1; if (hits.size > 50000 && c === 1) return false; hits.set(ip, c); return c <= max; };
// Express handler: always answers 204 with no body (nothing to learn from probing it).
export function eventHandler(q, r) {
  r.set('Cache-Control', 'no-store'); r.status(204);
  try {
    const ua = String(q.get('user-agent') || ''); const site = String(q.get('sec-fetch-site') || '');
    const origin = q.get('origin'); const host = q.get('host');
    const sameOrigin = (!site || site === 'same-origin') && (!origin || (() => { try { return new URL(origin).host === host; } catch { return false; } })());
    let b = q.body; if (typeof b === 'string') { try { b = JSON.parse(b.slice(0, 200)); } catch { b = null; } }
    const e = typeof b?.e === 'string' ? b.e : '';
    if (ua && !BOT.test(ua) && !q.get('x-ranky-monitor') && !/prefetch|prerender/i.test(String(q.get('sec-purpose') || '')) && sameOrigin && CLIENT_EVENTS.includes(e) && allowed(q.ip || '')) countEvent(e, b.iab === 1 || b.iab === true);
  } catch { /* never fails the client */ }
  r.end();
}
// Mark a POST /api/scan whose client went away before we answered (closed tab, in-app browser killed, proxy timeout).
export const scanClientLeftMiddleware = (q, r, next) => { if (!q.get('x-ranky-monitor')) r.on('close', () => { if (!r.writableFinished) countEvent('scan_client_left'); }); next(); };
const W = ['today', 'last7Days', 'last30Days', 'total'];
// funnel.clientEvents for GET /api/internal/status: { today|last7Days|last30Days|total: { event: { all, inApp } } } plus trackingSince.
export function buildClientEvents(db, now = new Date()) {
  const T = +now, DAY = 864e5; const today = day(now); const out = Object.fromEntries(W.map(w => [w, Object.fromEntries([...CLIENT_EVENTS, ...SERVER_EVENTS].map(e => [e, { all: 0, inApp: 0 }]))]));
  const add = (d, e, iab, n) => { if (!ALL.has(e) || !Number.isFinite(n)) return; const t = Date.parse(`${d}T12:00:00.000Z`); if (!Number.isFinite(t)) return;
    for (const w of W) if (w === 'total' || (w === 'today' && d === today) || (w === 'last7Days' && t > T - 7 * DAY) || (w === 'last30Days' && t > T - 30 * DAY)) { out[w][e].all += n; if (iab) out[w][e].inApp += n; } };
  let since = null;
  for (const ev of db.events || []) if (ev && ev.type === 'funnel.client' && !ev.test) { add(ev.day, ev.e, ev.iab, Number(ev.n) || 0); if (!since || ev.at < since) since = ev.at; }
  for (const [k, v] of Object.entries(mem)) { const [d, e, iab] = k.split('|'); add(d, e, Number(iab), v); }
  return { ...out, trackingSince: since, note: 'browser-reported counts (ad blockers / closed tabs can drop some); inApp = in-app browser (Facebook/Instagram/LinkedIn/short-video apps...); scan_client_left is server-side; no cookies, no personal data; days are UTC' };
}
