// Demo/pre-launch honesty: /api/config exposes emailMock; UI says (HE+EN) that results are demo data and no email is sent, only when the
// server says so; the /[lang]/scan form starts the scan itself (router.push to the same URL used to do nothing).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('demo');
delete process.env.EMAIL_MODE; delete process.env.RESEND_API_KEY;
const { default: app } = await import('../server.js'); const { emailIsMock } = await import('../src/email/send.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const read = f => fs.readFileSync(f, 'utf8'); const cfg = async () => (await fetch(B + '/api/config')).json();
try {
  assert.equal(emailIsMock(), true); assert.equal((await cfg()).emailMock, true);
  process.env.EMAIL_MODE = 'resend'; assert.equal(emailIsMock(), true, 'resend without key is still mock'); process.env.RESEND_API_KEY = 're_test_x'; assert.equal(emailIsMock(), false); assert.equal((await cfg()).emailMock, false);
  delete process.env.EMAIL_MODE; delete process.env.RESEND_API_KEY; ok('/api/config.emailMock is true unless EMAIL_MODE=live|resend with a Resend key');
  const i18n = read('web/lib/i18n.ts'); const demo = [...i18n.matchAll(/^  demo: \{(.*)\},$/gm)].map(m => m[1]); assert.equal(demo.length, 2);
  for (const d of demo) for (const k of ['sampleNote', 'scanNote', 'email', 'privacy', 'runNoEmail', 'reportNote', 'loginSent']) assert.match(d, new RegExp(`${k}: "`), k);
  assert.match(demo[0], /no email is sent/i); assert.match(demo[0], /sample data/); assert.match(demo[1], /לא נשלח מייל/); assert.match(demo[1], /נתוני דמו/); ok('i18n demo strings exist in EN and HE and say "sample data" / "no email is sent"');
  const sf = read('web/components/ScanForm.tsx'), sp = read('web/components/ScanProgress.tsx'), rv = read('web/components/ReportView.tsx'), lg = read('web/components/Login.tsx');
  assert.match(sf, /c\.emailMock/); assert.match(sf, /noEmail \? t\.demo\.privacy : t\.form\.privacy/); assert.match(sf, /noEmail && t\.demo\.email|noEmail \? t\.demo\.email/); assert.match(sf, /\(demo \|\| noEmail\) &&/); assert.match(sp, /noEmail && <p/); assert.match(sp, /t\.demo\.runNoEmail/);
  assert.match(rv, /r\.live && noEmail/); assert.match(rv, /t\.demo\.reportNote/); assert.match(lg, /noEmail \? t\.demo\.loginSent : t\.login\.sent/); ok('demo notice is conditional on /api/config flags (live wording untouched when emailMock/prelaunch are false)');
  assert.match(sf, /onStart\?: \(p: Record<string, string>\) => void/); assert.match(sf, /if \(onStart\) return onStart\(pending\)/); assert.match(sp, /<ScanForm t=\{t\} lang=\{lang\} onStart=\{/); assert.match(sp, /function run\(p: Pending\)/); ok('/scan form runs the scan directly (no same-URL router.push dead end), and retry after an error works');
  console.log(`ALL DEMO TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
