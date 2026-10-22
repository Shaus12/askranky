// Pull mentions, rank position, competitors and citations out of an engine answer (English or Hebrew).
// Strips bidi control marks, Hebrew niqqud and geresh/gershayim, keeps Unicode letters, and tolerates
// Hebrew one-letter prefixes (ה/ו/ב/ל/מ/ש/כ) glued to a business name ("באינסטלציה אקמה").
const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g;
const NIQQUD = /[\u0591-\u05C7]/g;
export const clean = s => String(s).replace(BIDI, '').replace(NIQQUD, '');
export const norm = s => clean(s).toLowerCase().replace(/[׳״'"`’”“]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['here', 'always', 'note', 'tip', 'conclusion', 'summary', 'top', 'best', 'option', 'options',
  'הנה', 'טיפ', 'הערה', 'סיכום', 'לסיכום', 'חשוב', 'מומלץ', 'שימו', 'בהצלחה', 'אפשרויות']);
// List item: "1." "1)" "-" "*" "•" or Hebrew letter numbering "א." / "ב)"; name ends at ":" "–" "—" " - " or end of line.
const ITEM = /^\s*(?:\d+[.)]|[-*•]|[\u05D0-\u05EA][.)])\s*\*{0,2}([^*:\n]{2,60}?)\*{0,2}\s*(?:[:–—]|\s-\s|$)/u;
// Headings after which bullets are advice, not businesses ("כמה טיפים פרקטיים:", "Tips:").
const TIPS_HEAD = /^(?![-*•\d])(?:#+\s*)?(?:\*\*)?[^\n:]{0,25}(?:טיפים|הערות|tips|notes|things to know)[^\n:]{0,15}:\s*(?:\*\*)?$/iu;
const tidy = n => n.replace(/\*+/g, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
export function extractNamedEntities(text) {
  const names = []; let inTips = false;
  for (const raw of clean(text).split('\n')) {
    const line = raw.trim();
    if (TIPS_HEAD.test(line)) { inTips = true; continue; }
    const m = line.match(ITEM);
    if (m) { if (inTips) continue; const n = tidy(m[1]); if (n && n.split(' ').length <= 6 && !STOP.has(norm(n).split(' ')[0])) names.push(n); continue; }
    for (const b of line.matchAll(/\*\*([^*]{2,60})\*\*/g)) names.push(b[1].trim());
  }
  return [...new Set(names)];
}
const PREFIX = /^[הובלמשכ]{1,2}(?=\p{L})/u;
function sameBusiness(entity, target) {
  const e = norm(entity); if (!e || !target) return false;
  if (e.includes(target) || target.includes(e)) return true;
  const e2 = e.split(' ').map(w => w.replace(PREFIX, '')).join(' '), t2 = target.split(' ').map(w => w.replace(PREFIX, '')).join(' ');
  return /[\u05D0-\u05EA]/.test(e + target) && t2.length > 2 && (e2.includes(t2) || t2.includes(e2));
}
export function analyzeAnswer(answer, business) {
  const target = norm(business.name);
  const domain = (business.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const entities = extractNamedEntities(answer.text);
  let rank = null;
  entities.forEach((e, i) => { if (rank === null && sameBusiness(e, target)) rank = i + 1; });
  const body = norm(answer.text);
  // Real engines often name the top pick in prose before the list: rank by order of first mention.
  const pos = n => { const k = norm(n).split(' ').slice(0, 3).join(' '); return k ? body.indexOf(k) : -1; };
  const tPos = [norm(business.name), ...(business.aliases || []).map(norm)].map(t => t && body.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  if (tPos !== undefined && entities.length) rank = 1 + entities.filter(e => !sameBusiness(e, target)).map(pos).filter(i => i >= 0 && i < tPos).length;
  const mentioned = rank !== null || (!!target && (body.includes(target) || body.split(' ').some((w, i, ws) => sameBusiness(ws.slice(i, i + target.split(' ').length).join(' '), target))));
  const competitors = entities.filter(e => !sameBusiness(e, target));
  const citations = (answer.citations || []).map(u => { let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {} return { url: u, host, isOwnSite: !!domain && host.endsWith(domain) }; });
  return { mentioned, rank, competitors, citations, ownSiteCited: citations.some(c => c.isOwnSite) };
}
