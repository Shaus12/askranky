// Scan form: a submit before the Turnstile token is ready must not reset the in-progress challenge.
// The server check (src/security/turnstile.js) is unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { turnstileSubmitAction } from '../web/lib/turnstile-gate.js';
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const form = fs.readFileSync('web/components/ScanForm.tsx', 'utf8');
const progress = fs.readFileSync('web/components/ScanProgress.tsx', 'utf8');
const server = fs.readFileSync('src/security/turnstile.js', 'utf8');

assert.equal(turnstileSubmitAction(null, '', 'loading'), 'send');
assert.equal(turnstileSubmitAction('pk', 'token', 'ready'), 'send');
assert.equal(turnstileSubmitAction('pk', '', 'loading'), 'wait');
assert.equal(turnstileSubmitAction('pk', '', 'off'), 'wait');
assert.equal(turnstileSubmitAction('pk', '', 'failed'), 'reset');
assert.equal(turnstileSubmitAction('pk', '', 'ready'), 'reset');
ok('gate: no site key or a token sends; loading/off waits; failed or ready-without-token resets');

const wait = form.slice(form.indexOf('action === "wait"'), form.indexOf('action === "reset"'));
const reset = form.slice(form.indexOf('action === "reset"'), form.indexOf('resume.current = false;\n    send(d)'));
assert.ok(wait.includes('resume.current = true') && !wait.includes('setTsReset'), wait);
assert.ok(reset.includes('setTsReset'));
assert.match(form, /if \(!resume\.current \|\| !root\.current\) return;\n\s*resume\.current = false;/);
assert.match(form, /try \{ sessionStorage\.setItem\(PENDING/);
assert.match(form, /catch \{ return setErr\(TSB\[lang\]\.storage\)/);
assert.match(form, /if \(onStart\) return onStart\(pending\)/);
assert.match(form, /track\("turnstile_missing"\)/);
assert.match(form, /track\("turnstile_blocked"\)/);
assert.match(form, /The security check isn't complete yet/);
assert.match(form, /בדיקת האבטחה עוד לא הושלמה/);
ok('form: an early submit waits once and auto-sends when the token arrives; only a failed/empty-ready widget is reset; storage failure is visible');

assert.match(progress, /function run\(p: Pending\) \{\n\s*if \(waiting\.current\) return;/);
assert.match(progress, /body: \{ \.\.\.p, lang, \.\.\.getUtm\(\) \}/);
ok('a second tap while the scan request is in flight does not send a second POST');

assert.match(server, /siteverify/);
assert.doesNotMatch(server, /turnstileSubmitAction|resume\.current/);
ok('server Turnstile verification is untouched');
console.log(`fbsubmit: ${n} passed`);
