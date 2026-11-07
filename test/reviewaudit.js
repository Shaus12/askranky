// Review audit: HE/EN copy matches the handlers (free result = 3 actions, no required email), paid plans stay distinct,
// the hero illustration is fictional, agencies is linked, and the Turnstile client changes do not touch the server check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildActions } from '../src/actions.js';

let n = 0;
const ok = (m) => { n++; console.log('  ✓', m); };
const read = (f) => fs.readFileSync(f, 'utf8');
const vis = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

const i18n = read('web/lib/i18n.ts');
const gate = read('web/lib/gate.ts');
const intro = read('web/lib/scan-intro.ts');
const form = read('web/components/ScanForm.tsx');
const turn = read('web/components/Turnstile.tsx');
const demo = read('web/lib/home-v3.ts');
const nav = read('web/components/Nav.tsx');
const srv = read('server.js');
const tsSrv = read('src/security/turnstile.js');

assert.match(i18n, /formNote: "The free plan includes one scan per email\./);
assert.match(i18n, /formNote: "התוכנית החינמית כוללת סריקה אחת לכל אימייל\./);
assert.match(i18n, /That limit applies only if you add an email/);
assert.match(i18n, /המגבלה חלה רק אם מוסיפים אימייל/);
assert.match(i18n, /privacy: "We use your details to run the scan\. Adding an email is optional; if you add one, we email the fuller report/);
assert.match(i18n, /privacy: "נשתמש בפרטים כדי להריץ את הסריקה\. הוספת אימייל אינה חובה; אם מוסיפים כתובת, נשלח את הדוח המלא/);
assert.doesNotMatch(i18n, /privacy: "We use your details to run the scan and email your report/);
assert.doesNotMatch(i18n, /privacy: "נשתמש בפרטים כדי להריץ את הסריקה ולשלוח לך את הדוח במייל/);
assert.match(i18n, /Do I have to sign up or pay to see what to do\?/);
assert.match(i18n, /ready-to-copy texts, the sites AI cited, your place in each engine, and a copy of the report/);
assert.match(i18n, /טקסטים מוכנים להעתקה, את האתרים ש־AI ציטט, את המקום בכל מנוע ועותק של הדוח/);
assert.match(i18n, /3 steps on screen, no email/);
assert.match(i18n, /3 צעדים על המסך, בלי מייל/);
assert.match(i18n, /3 ready-to-copy fixes per report/);
assert.match(i18n, /3 תיקונים מוכנים להעתקה לכל דוח/);
assert.equal((i18n.match(/"Re-scan from the dashboard within a monthly check budget"/g) || []).length, 3);
assert.equal((i18n.match(/"סריקה חוזרת מהדשבורד, במסגרת תקציב בדיקות חודשי"/g) || []).length, 3);
assert.match(gate, /with no email and no subscription/);
assert.match(gate, /בלי מייל ובלי מנוי/);
assert.match(gate, /emailOptional: "Email \(optional, you can add it after the scan\)"/);
assert.match(gate, /emailOptional: "מייל \(לא חובה, אפשר גם אחרי הסריקה\)"/);
assert.match(intro, /one scan per email address/);
assert.match(intro, /סריקה אחת לכל כתובת אימייל/);
assert.match(intro, /No email is required/);
assert.match(intro, /Starter asks 15 questions, Pro and Agency ask 20/);
assert.match(intro, /Starter שואל 15 שאלות, Pro ו-Agency שואלים 20/);
assert.match(intro, /Automatic rescans are off/);
assert.match(intro, /סריקות חוזרות אוטומטיות כבויות/);
ok('HE/EN: free result needs no email; one-scan-per-email applies only when an address is added; paid question counts and dashboard re-scan stay');

assert.doesNotMatch(form, /name="email"[^>]*required|required[^>]*name="email"/);
assert.match(form, /type=\{f === "email" \? "email"/);
assert.ok(!/required/.test(form.slice(form.indexOf('extra.map'), form.indexOf('data-other-names'))));
assert.match(form, /IntersectionObserver/);
assert.ok(form.indexOf('track("scan_form_viewed")') > form.indexOf('IntersectionObserver'));
assert.match(form, /track\("turnstile_blocked"\)/);
assert.match(form, /data-ts-submit=/);
ok('public form: email is not required; scan_form_viewed fires only after the form is on screen; submit without a token is counted');

const named = buildActions({ summary: { score: 40, checks: 4, mentionRate: 0.5, engines: { ran: ['chatgpt', 'gemini'] }, byEngine: { chatgpt: { checks: 2, mentions: 2 }, gemini: { checks: 2, mentions: 0 } }, topCompetitors: [{ name: 'A' }], ownSiteCited: false }, results: [] }, { name: 'Acme Pipes', city: 'Haifa', category: 'plumber', website: 'https://example.com' }, 'en');
const missing = buildActions({ summary: { score: 0, checks: 4, mentionRate: 0, engines: { ran: ['chatgpt', 'gemini'] }, byEngine: { chatgpt: { checks: 2, mentions: 0 }, gemini: { checks: 2, mentions: 0 } }, topCompetitors: [], ownSiteCited: false }, results: [] }, { name: 'צינורות לדוגמה', city: 'חיפה', category: 'אינסטלטור' }, 'he');
assert.equal(named.length, 3); assert.equal(missing.length, 3);
for (const a of named) assert.ok(a.title && a.what && a.why && a.effort);
assert.ok(JSON.stringify(named).includes('Acme Pipes') && JSON.stringify(named).includes('Haifa'));
assert.ok(JSON.stringify(missing).includes('צינורות לדוגמה') && JSON.stringify(missing).includes('חיפה'));
assert.match(read('web/components/LockedReport.tsx'), /data-free-actions/);
assert.match(read('src/actions.js'), /slice\(0, 3\)/);
assert.match(srv, /actions: freeActions/);
ok('free result is exactly 3 personalized actions, with no email gate in the generator');

assert.match(read('src/plans.js'), /starter:[\s\S]*?questionsPerBusiness: 15/);
assert.match(read('src/plans.js'), /agency:[\s\S]*?questionsPerBusiness: 20/);
assert.match(srv, /freeScanLookup/);
assert.match(srv, /guest: true/);
assert.match(tsSrv, /siteverify/);
assert.doesNotMatch(tsSrv, /turnstile_timeout|RENDER_TIMEOUT_MS|scan_form_viewed/);
ok('plan question counts, guest scan, one-scan-per-email lookup, and server Turnstile check are unchanged');

assert.match(read('web/lib/sample-real.ts'), /he: null, en: null/);
assert.match(demo, /Fictional illustration, not a scan and not a result/);
assert.match(demo, /המחשה פיקטיבית, לא סריקה ולא תוצאה/);
assert.doesNotMatch(demo, /Pick a project|בחרו פרויקט|תחת „אחרונים”|under Recents/);
assert.doesNotMatch(demo, /35 \/ 100|8 of 20|14 of 40|עלה מ־28/);
assert.match(demo, /Illustration · fictional business/);
assert.match(demo, /המחשה · עסק פיקטיבי/);
assert.match(demo, /illustration with example numbers|המחשה עם מספרים לדוגמה/);
ok('no authorized real sample; hero illustration is fictional in HE and EN, with no pick-a-project instruction and no fabricated scan scores');

assert.match(nav, /data-nav="agencies"/);
assert.match(read('web/lib/agencies.ts'), /by hand/);
assert.match(read('web/lib/agencies.ts'), /ידנית/);
assert.match(read('web/lib/agencies.ts'), /Automatic rescans are off/);
assert.match(read('web/lib/agencies.ts'), /20 questions per business/);
assert.match(read('web/lib/agencies.ts'), /Starter runs 15/);
assert.doesNotMatch(read('web/lib/agencies.ts'), /weekly|שבוע/);
ok('agencies link is in the nav; pilot stays manual; question budgets are the real 20 / 15 / 5');

assert.equal((turn.match(/RENDER_TIMEOUT_MS = 12000/g) || []).length, 1);
assert.doesNotMatch(turn, /RENDER_TIMEOUT_MS = 9000/);
assert.match(turn, /"expired-callback": \(\) => \{ once\("turnstile_expired"\); clear\(\)/);
assert.match(turn, /"timeout-callback": \(\) => \{ once\("turnstile_timeout"\)/);
assert.match(turn, /data-turnstile-retry/);
assert.match(turn, /mailto:\$\{CONTACT_EMAIL\}/);
assert.match(turn, /WhatsAppLink/);
assert.match(turn, /בדיקת האבטחה \(Cloudflare\) לא נטענה/);
assert.match(turn, /The security check \(Cloudflare\) didn't load/);
for (const e of ['turnstile_timeout', 'turnstile_blocked', 'scan_form_viewed']) {
  assert.ok(read('web/lib/track.ts').includes(`"${e}"`), e);
  assert.ok(read('src/dropoff.js').includes(`'${e}'`), e);
}
ok('Turnstile client: 12s render budget (not 9s), expiry clears the token, HE/EN retry uses the existing contact and WhatsApp');

for (const l of ['he', 'en']) {
  const html = read(`web/out/${l}.html`);
  const text = vis(html);
  assert.ok(html.includes('data-hero-scan') && html.includes('data-nav="agencies"') && html.includes(`href="/${l}/agencies"`));
  assert.equal((html.match(/name="trade"/g) || []).length, 1);
  assert.ok(html.indexOf('data-hero-scan') < html.indexOf('id="data"'));
  assert.doesNotMatch(text, /Pick a project|בחרו פרויקט/);
  assert.match(text, l === 'he' ? /המחשה פיקטיבית, לא סריקה ולא תוצאה/ : /Fictional illustration, not a scan and not a result/);
  assert.match(text, l === 'he' ? /בלי מייל ובלי מנוי/ : /no email and no subscription/);
  assert.match(text, l === 'he' ? /3 צעדים על המסך, בלי מייל/ : /3 steps on screen, no email/);
  assert.match(text, l === 'he' ? /3 תיקונים מוכנים להעתקה לכל דוח/ : /3 ready-to-copy fixes per report/);
  const email = html.match(/<input[^>]*name="email"[^>]*>/);
  assert.ok(email && !/required/.test(email[0]), 'email input is optional');
}
ok('built /he and /en: one hero form, agencies link, fictional demo, free vs paid wording, email not required');

console.log(`reviewaudit: ${n} checks passed`);
