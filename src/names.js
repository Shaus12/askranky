// Name variants + matching helpers for mention detection (see analyzeAnswer in extract.js).
// Variants: the name and the user's "other names", with hyphens/punctuation, "the"/"ה" articles, generic type words
// ("hotel", "מלון") and trailing city names removed, and a joined form ("ritzcarlton"). Cross-script names
// ("Ritz Carlton" vs "ריץ קרלטון") are matched by a consonant skeleton, never by a single short word.
import { ISRAELI_CITIES } from './cities.js';
const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g, NIQQUD = /[\u0591-\u05C7]/g;
export const normName = s => String(s || '').replace(BIDI, '').replace(NIQQUD, '').toLowerCase().replace(/[׳״'"`’”“]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
// Words that describe a type of business, not its name: dropped to form a shorter variant, and never a match on their own.
export const TYPE_WORDS = new Set(['the', 'hotel', 'hotels', 'resort', 'spa', 'restaurant', 'cafe', 'bar', 'shop', 'store', 'clinic', 'center', 'centre', 'group', 'ltd', 'inc', 'co', 'and', 'of', 'israel', 'il', 'tlv', 'boutique',
  'מלון', 'מלונות', 'בית', 'מסעדת', 'מסעדה', 'קפה', 'בר', 'חנות', 'מרפאת', 'מרפאה', 'מרכז', 'בע', 'מ', 'בעמ', 'קבוצת', 'ישראל', 'ספא', 'בוטיק', 'ו', 'של']);
const CITY_WORDS = (() => { const out = []; for (const c of ISRAELI_CITIES) for (const f of [c.he, c.en, 'tel aviv', 'תל אביב', 'jaffa', 'יפו', 'pituach', 'פיתוח']) out.push(normName(f)); return [...new Set(out)].filter(Boolean).sort((a, b) => b.length - a.length); })();
const stripCity = s => { let t = ` ${s} `; for (const c of CITY_WORDS) t = t.split(` ${c} `).join(' '); return t.replace(/\s+/g, ' ').trim(); };
const HE = /[\u05D0-\u05EA]/;
// Parse the optional "other names" field: comma/newline separated, at most 5 names of up to 60 chars each.
export const MAX_ALIASES = 5, MAX_ALIAS_LEN = 60;
export function parseOtherNames(v) {
  const raw = Array.isArray(v) ? v : String(v ?? '').slice(0, 400).split(/[,\n،;]+/);
  return [...new Set(raw.map(x => String(x).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ALIAS_LEN)).filter(x => x.length >= 2))].slice(0, MAX_ALIASES);
}
const substantial = v => { const w = v.split(' ').filter(Boolean); return w.length && !w.every(x => TYPE_WORDS.has(x)) && v.replace(/ /g, '').length >= 3; };
export function nameVariants(business) {
  const out = new Set();
  for (const n of [business.name, ...(business.aliases || [])]) {
    const base = normName(n); if (!base) continue; out.add(base);
    const noArticle = base.split(' ').filter(w => w !== 'the').join(' ');
    const noCity = stripCity(noArticle);
    const core = noCity.split(' ').filter(w => !TYPE_WORDS.has(w)).join(' ');
    for (const v of [noArticle, noCity, core]) if (v) out.add(v);
    // Hebrew article "ה" before a multi-word name ("הריץ קרלטון"): also try without it.
    for (const v of [...out]) if (HE.test(v) && /^ה\p{L}{3,}/u.test(v) && v.includes(' ')) out.add(v.slice(1));
  }
  return [...out].filter(substantial);
}
// Consonant skeleton shared by Hebrew and Latin spellings: "Ritz Carlton" and "ריץ קרלטון" -> "rs krltn".
const LAT = [[/ck|q|c(?=[aouklrt]|$)|k/g, 'k'], [/tz|ts|z|c|s|x/g, 's'], [/ph|f|p/g, 'p'], [/v|w|b/g, 'b'], [/sh/g, 's'], [/ch|kh|h|j(?=$)/g, ''], [/j/g, 'g'], [/[aeiouy]/g, '']];
const HEB = { 'ק': 'k', 'כ': 'k', 'ך': 'k', 'ס': 's', 'ש': 's', 'צ': 's', 'ץ': 's', 'ז': 's', 'פ': 'p', 'ף': 'p', 'ב': 'b', 'ו': '', 'ח': '', 'ה': '', 'א': '', 'ע': '', 'י': '', 'ג': 'g', 'ד': 'd', 'ט': 't', 'ת': 't', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ר': 'r' };
export function skeletonWord(w) {
  if (HE.test(w)) return [...w.replace(/ג׳|ג'/g, 'ג')].map(ch => HEB[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '')).join('');
  let s = w.replace(/sh/g, 'S').replace(/ch/g, 'H'); s = s.replace(/S/g, 's').replace(/H/g, ''); for (const [re, rep] of LAT) s = s.replace(re, rep); return s.replace(/(.)\1+/g, '$1');
}
export const skeleton = phrase => phrase.split(' ').filter(Boolean).map(skeletonWord).join(' ');
// A variant may be compared by skeleton only when it is distinctive enough: >= 2 words with >= 5 consonants, or one word with >= 6.
export const skeletonOk = v => { const sk = skeleton(v).replace(/ /g, ''); return v.includes(' ') ? sk.length >= 5 : sk.length >= 6; };
// Website domain stem: "https://www.ritzcarlton.com/x" -> "ritzcarlton". Too short or generic stems are ignored.
const GENERIC_STEMS = new Set(['hotel', 'hotels', 'booking', 'google', 'facebook', 'instagram', 'linktr', 'wixsite', 'business', 'israel', 'telaviv', 'restaurant', 'clinic', 'store', 'online', 'website', 'mysite', 'example', 'best', 'local']);
export function domainStem(website) {
  const host = String(website || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];
  if (!host || !host.includes('.')) return null;
  const labels = host.split('.'); while (labels.length > 1 && /^(com|co|org|net|il|io|biz|info|gov|ac|me|app|site|shop|online|store|uk|us|de)$/.test(labels.at(-1))) labels.pop();
  const stem = labels.at(-1).replace(/-/g, '');
  return stem.length >= 5 && /^[a-z0-9]+$/.test(stem) && !GENERIC_STEMS.has(stem) && !/^\d+$/.test(stem) ? stem : null;
}
// A "website" on a shared platform (booking.com/x, facebook.com/x, ...) is not the business's own site: never "own site cited".
const PLATFORMS = /(?:^|\.)(?:booking|facebook|instagram|google|tripadvisor|linktr|wolt|10bis|easy|tiktok|youtube|airbnb|expedia|waze|yelp)\.[a-z.]+$/;
export const isPlatformHost = host => PLATFORMS.test(String(host || '').toLowerCase());
