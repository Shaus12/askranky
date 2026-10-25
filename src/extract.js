import { nameVariants, domainStem, skeleton, skeletonOk, isPlatformHost } from './names.js';
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
const tidy = n => n.replace(/\*+/g, '').replace(/\s*\([^)]*\)?\s*/g, ' ').replace(/\s+/g, ' ').trim();

// ---- Items that are NOT businesses: questions, section headings, field labels, advice fragments, streets/areas. ----
// Real example (live scan): ChatGPT asked "מה בדיוק אתה מחפש?" with bullets "- טווח מחיר רצוי (זול/בינוני/יוקרתי)?" and Gemini
// grouped businesses under "### 1. **תכשיטי יוקרה ויהלומים (High-End)**"; all of those were counted as competitors.
const HE_PREFIX = /^[הובלמשכ](?=\p{L}{3,})/u;
const LABELS = new Set(['מחפש ת', 'מחפש ים', 'טלפון', 'כתובת', 'שעות', 'שעות פתיחה', 'אתר', 'מחיר', 'מחירים', 'דירוג', 'ביקורות', 'אימייל', 'מייל', 'התמחות', 'מיקום', 'הערה', 'טיפ',
  'phone', 'tel', 'address', 'hours', 'opening hours', 'website', 'site', 'price', 'prices', 'rating', 'reviews', 'email', 'location', 'specialty', 'note', 'tip']);
// Words that describe a category / attribute rather than name a business. A phrase made only of these is a heading.
const GENERIC = new Set(['תכשיטי', 'תכשיטים', 'יוקרה', 'יוקרתי', 'יוקרתיים', 'יהלומים', 'יהלום', 'זהב', 'כסף', 'מעצבים', 'מעצבות', 'עצמאיים', 'עצמאיות', 'וטרנדיים', 'טרנדיים',
  'עיצוב', 'אמנותי', 'ייחודי', 'קלאסי', 'קלאסיים', 'מודרני', 'עדינים', 'רומנטיים', 'טבעות', 'אירוסין', 'נישואין', 'אמינות', 'מחיר', 'מחירים', 'ביקורות', 'דירוג', 'שירות', 'איכות', 'חנויות', 'חנות', 'עסקים',
  'סגנון', 'סגנונות', 'סוג', 'סוגי', 'טווח', 'תקציב', 'אפשרויות', 'המלצות', 'קטגוריה', 'קטגוריות', 'ו', 'או', 'עם', 'של', 'בעיר', 'במרכז', 'העיר', 'מובילים', 'מומלצים', 'מוכרים',
  'luxury', 'high', 'end', 'highend', 'budget', 'affordable', 'style', 'styles', 'options', 'option', 'categories', 'category', 'price', 'range', 'and', 'or', 'with', 'the', 'best', 'top', 'local', 'stores', 'shops', 'businesses', 'services', 'jewelry', 'designers', 'independent']);
// (JS \b does not work for Hebrew letters, so word ends are matched with a lookahead.)
const AREA_LEAD = /^(?:רחוב|שדרות|שדרת|מדרחוב|כיכר|שוק|שכונת|שכונות|אזור|אזורים|רשימות|רשימת|street|st\.?|avenue|square|market|neighborhood|district|area|lists?)(?=\s|$)/iu;
const SENTENCE_LEAD = /^(?:אם|כדי|ציין|ציינו|מומלץ|שימו|שים|תבדקו|בדוק|ודא|if|ask|call|check|make sure|consider|note|remember)(?=\s|$)/iu;
// "If you are looking for **reliability and price**, try **X**": the bold right after "looking for" names a need, not a business.
// Well-known places that LLMs list next to businesses.
const PLACE = /(?:שוק הפשפשים|יפו העתיקה|נחלת בנימין|flea market|old jaffa)/iu;
const NEED_BEFORE = /(?:מחפשים|מחפש|מחפשת|מעוניינים|looking for|want|need|seeking)\s*$/iu;
const SENTENCE_MID = /(?:^|\s)(?:עם|לפי|כדי|אם)(?:\s|$)/u;
export function isNonBusiness(raw, category = '') {
  const name = String(raw).replace(/\*+/g, '').trim(); if (!name) return true;
  if (/[?？]/.test(name) || /[:：]\s*$/.test(name)) return true;
  const base = tidy(name); const w = norm(base).split(' ').filter(Boolean); if (!w.length) return true;
  if (LABELS.has(norm(base)) || STOP.has(w[0])) return true;
  if (PLACE.test(name) || /high.?end/i.test(name) || AREA_LEAD.test(base) || SENTENCE_LEAD.test(base)) return true;
  if (norm(category) && norm(base) === norm(category)) return true;
  if (w.every(x => GENERIC.has(x) || GENERIC.has(x.replace(HE_PREFIX, '')))) return true;
  if (/[\u05D0-\u05EA]/.test(base) && !/[A-Za-z]/.test(base) && w.length >= 3 && SENTENCE_MID.test(base)) return true;
  return false;
}
// "Before I answer: what are you looking for?" replies: no usable names, and the answer asks the user a question instead.
const CLARIFY_CUE = /(?:קודם שאלה|שאלה קצרה|שאלת הבהרה|במה הכוונה|מה בדיוק|רוצה שאמשיך|האם להמשיך|רוצה שאעשה|תוכל\/י לחדד|before i (?:answer|search|recommend)|clarif|what exactly|could you (?:tell|specify)|can you (?:tell|specify)|which (?:one )?do you mean|do you want me to)/iu;
// Hosts that are only redirectors (Gemini grounding links): never a meaningful "source", excluded from cited-host stats and fixes.
export const OPAQUE_HOSTS = new Set(['vertexaisearch.cloud.google.com']);
export const isOpaqueHost = h => OPAQUE_HOSTS.has(String(h || '').toLowerCase().replace(/^www\./, ''));
export function isClarifying(text, entities) {
  if (entities.length) return false;
  const t = clean(text).trim(); if (!/[?？]/.test(t)) return false;
  return CLARIFY_CUE.test(t) || /[?？]\s*$/.test(t);
}
export function extractNamedEntities(text, { category = '' } = {}) {
  const names = []; let inTips = false;
  const lines = clean(text).split('\n').map(l => l.trim());
  const add = n => { if (n && !isNonBusiness(n, category)) names.push(n); };
  lines.forEach((line, idx) => {
    if (TIPS_HEAD.test(line)) { inTips = true; return; }
    const m = line.match(ITEM);
    if (m) { if (inTips || /[?？]\s*$/.test(line)) return; const n = tidy(m[1]); if (n && n.split(' ').length <= 6) add(n); return; }
    // Bold text on a markdown heading line ("### 1. **Section title**") that is followed by a list is a section title, not a business.
    const heading = /^#{1,6}\s/.test(line); const nextItem = lines.slice(idx + 1).find(Boolean); const sectionTitle = heading && nextItem && ITEM.test(nextItem);
    if (sectionTitle) return;
    for (const b of line.matchAll(/\*\*([^*]{2,60})\*\*/g)) { if (NEED_BEFORE.test(line.slice(0, b.index))) continue; add(b[1].trim()); }
  });
  return [...new Set(names)];
}
const PREFIX = /^[הובלמשכ]{1,2}(?=\p{L})/u;
const dePrefix = s => s.split(' ').map(w => w.replace(PREFIX, '')).join(' ');
// One target variant (already normalized). Reverse containment (entity inside the target) needs the entity to cover
// most of the target, so "Carlton" or "קרלטון" alone never matches "ritz carlton".
function sameOne(e, target) {
  if (!e || !target) return false;
  if (e.includes(target)) return true;
  if (target.includes(e) && e.length >= Math.max(4, 0.6 * target.length)) return true;
  const e2 = dePrefix(e), t2 = dePrefix(target);
  if (/[\u05D0-\u05EA]/.test(e + target) && t2.length > 2 && (e2.includes(t2) || (t2.includes(e2) && e2.length >= 0.6 * t2.length))) return true;
  // Cross-script / spelling variants: the target's consonant skeleton as consecutive words of the entity.
  if (skeletonOk(target)) { const ts = skeleton(target), n = target.split(' ').length, ew = e.split(' ');
    for (let i = 0; i + n <= ew.length; i++) { const win = ew.slice(i, i + n); if (skeleton(win.join(' ')) === ts || skeleton([win[0].replace(PREFIX, ''), ...win.slice(1)].join(' ')) === ts) return true; } }
  return false;
}
export function sameBusiness(entity, targets) { const e = norm(entity); const ts = Array.isArray(targets) ? targets : [targets]; return !!e && ts.some(t => sameOne(e, t)); }
// Domain stem ("ritzcarlton") written in the answer: as a URL/host, or as 1-3 joined words ("Ritz Carlton", "Ritz-Carlton").
export function stemInText(text, stem) {
  if (!stem) return false; const low = clean(text).toLowerCase();
  if (new RegExp(`(?:^|[^a-z0-9])${stem}(?:\\.[a-z]{2,}|[^a-z0-9]|$)`).test(low)) return true;
  const w = norm(text).split(' '); for (let i = 0; i < w.length; i++) for (let n = 2; n <= 3 && i + n <= w.length; n++) if (w.slice(i, i + n).join('') === stem) return true;
  return false;
}
export const stemInHost = (host, stem) => !!stem && String(host || '').toLowerCase().replace(/^www\./, '').split('.').some(l => l.replace(/-/g, '') === stem);
export function analyzeAnswer(answer, business) {
  const targets = nameVariants(business); const target = targets[0] || norm(business.name);
  const domain0 = (business.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const domain = isPlatformHost(domain0) ? '' : domain0;
  const stem = domainStem(business.website);
  const entities = extractNamedEntities(answer.text, { category: business.category });
  const clarifying = isClarifying(answer.text, entities);
  let rank = null;
  entities.forEach((e, i) => { if (rank === null && (sameBusiness(e, targets) || (stem && stemInText(e, stem)))) rank = i + 1; });
  const body = norm(answer.text); const words = body.split(' ');
  // Real engines often name the top pick in prose before the list: rank by order of first mention.
  const pos = n => { const k = norm(n).split(' ').slice(0, 3).join(' '); return k ? body.indexOf(k) : -1; };
  // Prose matching (position + inBody) only with the main name or multi-word variants: a one-word alias such as "דיוק"
  // is often a dictionary word ("precision") and matched descriptions of competitors (scan EP-gH7iPGUvY). One-word aliases still match list entities above.
  const proseTargets = targets.filter((t, i) => i === 0 || t.includes(' '));
  const tPos = proseTargets.map(t => t && body.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  const isOwn = e => sameBusiness(e, targets) || (stem && stemInText(e, stem));
  if (tPos !== undefined && entities.length) rank = 1 + entities.filter(e => !isOwn(e)).map(pos).filter(i => i >= 0 && i < tPos).length;
  const inBody = proseTargets.some(t => body.includes(t) || words.some((w, i, ws) => sameOne(ws.slice(i, i + t.split(' ').length).join(' '), t)));
  // A citation is a URL string or {url, host} (Gemini: the real site's domain when only a redirect link is available).
  const citations = (answer.citations || []).map(c => { const u = typeof c === 'string' ? c : c.url; let host = (typeof c === 'object' && c.host) || u; if (!(typeof c === 'object' && c.host)) try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {} return { url: u, host, isOwnSite: (!!domain && host.endsWith(domain)) || stemInHost(host, stem), ...(isOpaqueHost(host) ? { opaque: true } : {}) }; });
  const byStem = !!stem && (stemInText(answer.text, stem) || citations.some(c => c.isOwnSite));
  const mentioned = !clarifying && (rank !== null || (!!target && inBody) || byStem);
  const competitors = entities.filter(e => !isOwn(e));
  // A citation is a URL string or {url, host} (Gemini: the real site's domain when only a redirect link is available).
  return { mentioned, rank: clarifying ? null : rank, competitors, citations, ownSiteCited: citations.some(c => c.isOwnSite), ...(clarifying ? { clarifying: true } : {}) };
}
