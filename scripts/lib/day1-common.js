// Shared constants and helpers for scripts/day1-scan.js and scripts/day1-analyze.js (spec: marketing/day1-scan-spec.md).
// Pure module: imports no provider and does no I/O at import time.
import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ENGINES = ['chatgpt', 'gemini'];
export const QUESTIONS_PER_SCAN = 5;
export const OWN_SPEND_LIMIT_USD = 0.85;   // script hard-stops above this (own spend, across invocations)
export const CAP_HEADROOM_USD = 1.00;      // never push the site into the daily cap: keep >= $1 for visitors
// Exact scan list (spec §2). `questions` is the verbatim output of buildQuestions for templates #1-#5.
export const MARKETS = {
  'IL-1': { id: 'IL-1', category: 'רופא שיניים', city: 'תל אביב', cityResolved: 'תל אביב-יפו', lang: 'he', questions: [
    'מי העסקים הטובים ביותר בתחום רופא שיניים בתל אביב-יפו?',
    'תמליץ לי על עסק אמין בתחום רופא שיניים בתל אביב-יפו.',
    'אילו עסקים בתחום רופא שיניים עם הדירוג הכי גבוה יש באזור תל אביב-יפו?',
    'אני מחפש עסק בתחום רופא שיניים במחיר סביר בתל אביב-יפו, למי כדאי להתקשר?',
    'לאילו עסקים בתחום רופא שיניים בתל אביב-יפו יש את הביקורות הכי טובות?' ] },
  'US-1': { id: 'US-1', category: 'dentist', city: 'Austin, TX', cityResolved: 'Austin, TX', lang: 'en', questions: [
    'What are the best businesses for dentist in Austin, TX?',
    'Recommend a reliable dentist business in Austin, TX.',
    'Who are the top-rated dentist businesses near Austin, TX?',
    'I need affordable dentist in Austin, TX, who should I call?',
    'Which dentist businesses in Austin, TX have the best reviews?' ] },
};
// Order of execution (spec §2): IL-1 run 1 -> PAUSE (compare token usage with provider dashboards) -> US-1 run 1 -> IL-1 run 2 -> US-1 run 2.
export const ORDER = [{ id: 'IL-1', run: 1 }, { id: 'US-1', run: 1, pauseBefore: true }, { id: 'IL-1', run: 2 }, { id: 'US-1', run: 2 }];
export const probeBusiness = id => ({ id: `day1-${id}`, name: 'day1-probe', category: MARKETS[id].category, city: MARKETS[id].city, lang: MARKETS[id].lang });
export const round4 = n => +Number(n).toFixed(4);
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const runFile = (dir, id, run) => path.join(dir, `${id}-run${run}.json`);
export const defaultOutDir = () => process.env.DAY1_DIR || path.resolve(ROOT, '..', 'research', 'scans', 'day1');
// ISO timestamp with the Israel offset ("2026-10-24T09:30:00+03:00"), as the spec asks for startedAt / analyzedAt.
export function isoIsrael(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' }).formatToParts(d).find(x => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off}`;
}
export const dateEn = iso => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', year: 'numeric' });
// Checks the generated questions equal the spec table (abort if templates changed). Returns [] when identical.
export function questionProblems(id, questions) {
  const want = MARKETS[id].questions; const out = [];
  if (!Array.isArray(questions) || questions.length !== want.length) out.push(`${id}: expected ${want.length} questions, got ${questions?.length}`);
  want.forEach((q, i) => { if (questions?.[i] !== q) out.push(`${id}: question ${i + 1} differs from the spec table`); });
  return out;
}
// Validity of one saved/returned scan (spec §1.1, §5): no mock, no skipped/failed engine, no errors, exactly the 5 spec questions x 2 engines.
// Returns a list of reasons; empty = valid.
export function validateScan(scan, id) {
  const r = []; const res = scan?.results; const s = scan?.summary;
  if (!scan || !Array.isArray(res) || !s) return ['scan object is missing or malformed'];
  if (scan.mock) r.push('scan.mock is true');
  if (res.some(x => x.mock === true)) r.push('a result has mock:true');
  if (res.some(x => x.error)) r.push(`${res.filter(x => x.error).length} result(s) have an error`);
  if ((s.errors || 0) > 0) r.push(`summary.errors = ${s.errors}`);
  if ((s.engines?.skipped || []).length) r.push(`engine(s) skipped: ${s.engines.skipped.map(x => `${x.engine}:${x.reason}`).join(', ')}`);
  for (const e of ENGINES) if (!(s.engines?.ran || []).includes(e)) r.push(`engine ${e} did not run`);
  const expected = QUESTIONS_PER_SCAN * ENGINES.length;
  if (res.length !== expected) r.push(`expected ${expected} results, got ${res.length}`);
  if (s.checks !== expected) r.push(`expected ${expected} successful checks, got ${s.checks}`);
  for (const e of ENGINES) if (res.filter(x => x.engine === e && !x.error).length !== QUESTIONS_PER_SCAN) r.push(`engine ${e} did not answer all ${QUESTIONS_PER_SCAN} questions`);
  if (res.some(x => x.engine === 'perplexity')) r.push('a perplexity result is present');
  if (MARKETS[id]) { const qs = [...new Set(res.map(x => x.question))]; r.push(...questionProblems(id, qs)); }
  return r;
}
