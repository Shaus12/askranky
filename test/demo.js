// Demo/pre-launch honesty: /api/config exposes emailMock; UI says (HE+EN) that results are demo data and no email is sent, only when the
// server says so; the /[lang]/scan form starts the scan itself (router.push to the same URL used to do nothing).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module'; import { useTempData } from './helpers.js'; const TD = useTempData('demo');
delete process.env.EMAIL_MODE; delete process.env.RESEND_API_KEY;
const { default: app } = await import('../server.js'); const { emailIsMock } = await import('../src/email/send.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const read = f => fs.readFileSync(f, 'utf8'); const cfg = async () => (await fetch(B + '/api/config')).json();
try {
  assert.equal(emailIsMock(), true); assert.equal((await cfg()).emailMock, true);
  process.env.EMAIL_MODE = 'resend'; assert.equal(emailIsMock(), true, 'resend without key is still mock'); process.env.RESEND_API_KEY = 're_test_x'; assert.equal(emailIsMock(), false); assert.equal((await cfg()).emailMock, false);
  delete process.env.EMAIL_MODE; delete process.env.RESEND_API_KEY; ok('/api/config.emailMock is true unless EMAIL_MODE=live|resend with a Resend key');
  const i18n = read('web/lib/i18n.ts'); const demo = [...i18n.matchAll(/^  demo: \{(.*)\},$/gm)].map(m => m[1]); assert.equal(demo.length, 2);
  for (const d of demo) for (const k of ['banner', 'bannerMock', 'sampleNote', 'emailNote', 'scanNote', 'email', 'privacy', 'privacyMock', 'privacyNoEmail', 'runNoEmail', 'reportNote', 'loginSent']) assert.match(d, new RegExp(`${k}: "`), k);
  ok('i18n demo strings exist in EN and HE');
  // The four flag combinations (mock scans x mock email), decided by web/lib/notices.ts from the /api/config flags.
  const ts = createRequire(import.meta.url)('../web/node_modules/typescript'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-'));
  for (const f of ['i18n', 'notices']) fs.writeFileSync(path.join(tmp, f + '.mjs'), ts.transpileModule(read(`web/lib/${f}.ts`), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace(/from "\.\/i18n"/g, 'from "./i18n.mjs"'));
  const { dict } = await import(path.join(tmp, 'i18n.mjs')); const { demoNotices } = await import(path.join(tmp, 'notices.mjs')); fs.rmSync(tmp, { recursive: true, force: true });
  for (const lang of ['en', 'he']) {
    const t = dict(lang); const N = (mock, emailMock, prelaunch = true) => demoNotices({ mock, emailMock, prelaunch }, t);
    const DEMO = lang === 'en' ? /sample data|no questions are sent to AI engines/i : /נתוני דמו|נתוני דוגמה|לא נשלחות שאלות למנועי AI/; const NOMAIL = lang === 'en' ? /no email is sent|No email was sent|not being sent/i : /לא נשלח מייל|לא נשלחים/; const ENGINES = lang === 'en' ? /AI engines \(ChatGPT, Gemini\) receive only your business category and city/ : /מנועי ה־AI \(ChatGPT, Gemini\) מקבלים רק את תחום העסק והעיר/;
    const all = n => [n.banner, n.formNote, n.privacy, n.progressMock, n.runNote, n.reportNote, n.loginSent].filter(Boolean).join('\n');
    // scans live + email mock (what runs on prod now): no demo-data claim anywhere, only the no-email + pre-launch notes
    let n = N(false, true); assert.doesNotMatch(all(n), DEMO, `${lang} live scan + mock email must not claim demo data`); assert.equal(n.progressMock, null); assert.match(n.banner, lang === 'en' ? /Pre-launch/ : /לפני השקה/); assert.match(n.formNote, NOMAIL); assert.match(n.privacy, ENGINES); assert.match(n.privacy, NOMAIL); assert.match(n.runNote, NOMAIL); assert.match(n.reportNote, NOMAIL);
    // scans mock + email mock: demo data AND no email
    n = N(true, true); assert.match(n.banner, DEMO); assert.match(n.formNote, DEMO); assert.match(n.formNote, NOMAIL); assert.match(n.privacy, DEMO); assert.match(n.privacy, NOMAIL); assert.equal(n.progressMock, t.scan.mock); assert.doesNotMatch(n.privacy, ENGINES);
    // scans mock + real email: demo data but never "no email"
    n = N(true, false); assert.match(n.formNote, DEMO); assert.doesNotMatch(n.formNote, NOMAIL); assert.match(n.privacy, DEMO); assert.doesNotMatch(n.privacy, NOMAIL); assert.equal(n.runNote, null); assert.equal(n.reportNote, null); assert.equal(n.loginSent, t.login.sent); assert.equal(n.progressMock, t.scan.mock);
    // scans live + real email: no notices at all except the pre-launch banner; the privacy text is the normal form text
    n = N(false, false); assert.equal(n.formNote, null); assert.equal(n.progressMock, null); assert.equal(n.runNote, null); assert.equal(n.reportNote, null); assert.equal(n.privacy, t.form.privacy); assert.doesNotMatch(all(n), DEMO); assert.doesNotMatch(all(n), NOMAIL);
    // prelaunch off: no banner in any combination; failed config fetch defaults are the conservative demo ones
    for (const m of [true, false]) for (const e of [true, false]) assert.equal(N(m, e, false).banner, null);
    assert.match(demoNotices({ mock: true, prelaunch: true, emailMock: true }, t).formNote, DEMO);
  }
  ok('EN+HE notices for the 4 flag combinations: demo claims only when mock, "no email" only when emailMock, banner only when prelaunch, live privacy names ChatGPT/Gemini');
  const sf = read('web/components/ScanForm.tsx'), sp = read('web/components/ScanProgress.tsx'), rv = read('web/components/ReportView.tsx'), lg = read('web/components/Login.tsx'), db = read('web/components/DemoBanner.tsx'), api = read('web/lib/api.ts');
  assert.match(sf, /demoNotices\(cfg, t\)/); assert.match(sf, /\{nt\.privacy\}/); assert.match(sf, /nt\.formNote/); assert.match(sp, /demoNotices\(cfg, t\)/); assert.match(sp, /nt\.progressMock/); assert.match(sp, /nt\.runNote/); assert.match(rv, /r\.live && nt\.reportNote/); assert.match(db, /demoNotices\(c, dict\(lang\)\)\.banner/); assert.match(lg, /noEmail \? t\.demo\.loginSent : t\.login\.sent/);
  assert.doesNotMatch(sp, /c\.mock \|\| !!c\.prelaunch/); assert.doesNotMatch(sf, /c\.prelaunch \|\| c\.mock/); ok('components render notices only through demoNotices (no prelaunch-implies-demo shortcut)');
  assert.doesNotMatch(i18n.match(/^  live: \{[^\n]*/gm).join(''), /real: "[^"]*Perplexity/); ok('live badge does not hardcode Perplexity (skipped engines are listed in the engines note)');
  assert.match(api, /mock: !!j\.scan\.mock,/); assert.doesNotMatch(api, /j\.scan\.mock \|\| j\.demo/);
  // server: /api/report.demo follows the stored scan only; pre-launch must not turn a live scan into a "demo" report
  process.env.PRELAUNCH = '1'; process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '100'; assert.equal((await cfg()).prelaunch, true); assert.equal((await cfg()).mock, true);
  const { getDb } = await import('../src/store.js'); const mk = await fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Flag Co', category: 'c', city: 'x', email: 'flag@t.test' }) }).then(r => r.json());
  const rep = async () => (await fetch(B + '/api/report/' + mk.reportId)).json(); let rp = await rep(); assert.equal(rp.scan.mock, true); assert.equal(rp.demo, true, 'old mock report keeps the demo flag');
  getDb().scans[mk.reportId].mock = false; rp = await rep(); assert.equal(rp.demo, false, 'stored live scan is not demo even in pre-launch'); getDb().scans[mk.reportId].mock = true; delete process.env.PRELAUNCH;
  ok('/api/report demo flag = stored scan.mock (live scan under pre-launch: false; old mock report: true)');
  assert.match(sf, /onStart\?: \(p: Record<string, string>\) => void/); assert.match(sf, /if \(onStart\) return onStart\(pending\)/); assert.match(sp, /<ScanForm t=\{t\} lang=\{lang\} onStart=\{/); assert.match(sp, /function run\(p: Pending\)/); ok('/scan form runs the scan directly (no same-URL router.push dead end), and retry after an error works');
  // returning-report note
  const ex = [...i18n.matchAll(/^  existing: \{(.*)\},$/gm)].map(m => m[1]); assert.equal(ex.length, 2);
  for (const d of ex) for (const k of ['formNote', 'runNote', 'reportNote']) assert.match(d, new RegExp(`${k}: "`), k);
  assert.match(ex[0], /no new scan is run and no new email is sent/i); assert.match(ex[1], /לא בוצעה סריקה חדשה|לא מתבצעת סריקה חדשה/); assert.match(ex[1], /לא נשלח מייל חדש/);
  assert.match(sf, /data-existing-note>\{t\.existing\.formNote\}/); assert.match(sp, /setExisting\(!!j\.existing\)/); assert.match(sp, /existing=1/); assert.match(sp, /t\.existing\.runNote/); assert.match(rv, /get\("existing"\) === "1"/); assert.match(rv, /t\.existing\.reportNote/);
  process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '100'; const sc = e => fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', category: 'c', city: 'x', email: e }) }).then(r => r.json());
  const first = await sc('again@t.test'); assert.ok(first.reportId); assert.equal(first.existing, undefined); const second = await sc('again@t.test'); assert.equal(second.reportId, first.reportId); assert.equal(second.existing, true);
  ok('returning email: server returns existing:true + same report (no new scan); UI notes on form, progress and report (HE+EN)');
  console.log(`ALL DEMO TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
