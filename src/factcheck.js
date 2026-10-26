import { norm } from './extract.js';
import { isPlatformHost } from './names.js';
import { ISRAELI_CITIES, findCity } from './cities.js';
import { aboutSentences } from './sentiment.js';
// Fact check: what an engine says ABOUT the business vs the facts the owner gave us (city, website), plus claims we cannot verify
// but the owner must (phone numbers, opening hours) and claims that are almost certainly wrong for a business running a scan ("permanently closed").
// Each claim: { type: city|website|status|phone|hours, status: conflict|check|match, said, expected?, quote }.
// Rule-based and conservative: a claim is only a conflict when the sentence clearly names the business AND states a different fact.

const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
const CITY_RX = ISRAELI_CITIES.map(c => ({ c, rx: new RegExp(`${B}[בלמ]?(?:${[c.he, c.en, c.he.split('-')[0], c.en.split('-')[0]].filter((x, i, a) => x.length > 2 && a.indexOf(x) === i).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]?')).join('|')})${E}`, 'iu') }));
const LOCATED = /(?:located|based|situated|found)\s+in\s+([A-Z][\p{L}'.-]+(?:\s[A-Z][\p{L}'.-]+){0,2})/u;
const CLOSED = new RegExp(`${B}(?:permanently closed|closed permanently|closed down for good|closed for good|permanently shut down|shut down permanently|out of business|went out of business|no longer in business|no longer operating|has (?:since )?(?:permanently )?closed (?:down|its doors)|נסגרה לצמיתות|נסגר לצמיתות|סגור לצמיתות|סגורה לצמיתות|נסגר סופית|נסגרה סופית|העסק נסגר|הפסיק לפעול|הפסיקה לפעול|כבר לא פעיל|כבר לא פעילה)${E}`, 'iu');
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const HOURS = new RegExp(`(?:${B}(?:open|opens|hours|until|from)\\s+\\d{1,2}(?::\\d{2})?(?:\\s*[ap]m)?|24\\/7|${B}(?:שעות פתיחה|פתוח|פתוחה|עד השעה|משעה)${E}|\\d{1,2}:\\d{2}\\s*[-–]\\s*\\d{1,2}:\\d{2})`, 'iu');
const DOMAIN = /\b((?:[a-z0-9-]+\.)+(?:com|co\.il|org\.il|net|org|co|io|biz|info|il|us|uk|de|fr))\b/gi;
const hostOf = w => String(w || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
const sameCity = (a, b) => { const fa = findCity(a), fb = findCity(b); if (fa && fb) return fa.en === fb.en; const na = norm(a), nb = norm(b); return !!na && !!nb && (na.includes(nb) || nb.includes(na)); };

/** Claims about the business in one answer. Returns [] when the answer does not mention it. */
export function factCheck(text, business, mentioned) {
  if (!mentioned) return [];
  const claims = []; const own = hostOf(business.website); const ownOk = !!own && !isPlatformHost(own);
  const cityCore = norm(String(business.city || '').split(',')[0]);
  const add = c => { if (!claims.some(x => x.type === c.type && norm(x.said) === norm(c.said))) claims.push(c); };
  for (const s of aboutSentences(text, business)) {
    const quote = s.length > 220 ? s.slice(0, 219) + '…' : s;
    // City: the entered city named in the sentence = match; otherwise a different known Israeli city, or "located in X", = conflict.
    const knownHere = CITY_RX.filter(({ rx }) => rx.test(s)).map(({ c }) => c);
    if (knownHere.some(c => sameCity(c.en, business.city)) || norm(s).includes(cityCore)) add({ type: 'city', status: 'match', said: business.city, quote });
    else {
      const other = knownHere[0]; const loc = s.match(LOCATED)?.[1];
      const said = other ? (/[\u05D0-\u05EA]/.test(business.city) ? other.he : other.en) : loc && !sameCity(loc, business.city) && !norm(business.name).includes(norm(loc)) ? loc : null;
      if (said) add({ type: 'city', status: 'conflict', said, expected: business.city, quote });
    }
    // Website: a business-looking domain in the sentence (directories/social excluded) that is not the owner's site.
    for (const m of s.matchAll(DOMAIN)) { const h = hostOf(m[1]); if (isPlatformHost(h)) continue;
      if (ownOk && (h === own || h.endsWith('.' + own))) add({ type: 'website', status: 'match', said: h, quote });
      else add({ type: 'website', status: ownOk ? 'conflict' : 'check', said: h, ...(ownOk ? { expected: own } : {}), quote }); }
    const closed = s.match(CLOSED); if (closed) add({ type: 'status', status: 'conflict', said: closed[0], quote });
    for (const m of s.matchAll(PHONE)) { const digits = m[0].replace(/\D/g, ''); if (digits.length >= 9 && digits.length <= 13) add({ type: 'phone', status: 'check', said: m[0].trim(), quote }); }
    if (HOURS.test(s)) add({ type: 'hours', status: 'check', said: (s.match(HOURS) || [''])[0], quote });
  }
  return claims;
}

/** Scan-level roll-up: unique conflicts and to-checks (with how many answers / which engines said them) and the number of confirmed facts. */
export function summarizeFacts(results) {
  const ok = results.filter(r => !r.error && Array.isArray(r.facts) && r.facts.length); if (!ok.length) return null;
  const map = new Map(); let matches = 0;
  for (const r of ok) for (const f of r.facts) {
    if (f.status === 'match') { matches++; continue; }
    const k = `${f.status}|${f.type}|${norm(f.said)}`; const e = map.get(k) || { ...f, count: 0, engines: [], question: r.question }; e.count++; if (!e.engines.includes(r.engine)) e.engines.push(r.engine); map.set(k, e);
  }
  const all = [...map.values()].sort((a, b) => b.count - a.count);
  return { conflicts: all.filter(f => f.status === 'conflict').slice(0, 8), checks: all.filter(f => f.status === 'check').slice(0, 8), matches };
}
