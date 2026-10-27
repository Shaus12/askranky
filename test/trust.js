// Trust basics: founder section (placeholder photo slot, neutral copy), WhatsApp button wired to WHATSAPP_NUMBER (validated, hidden until
// set, via /api/config) and the 390px hero fix (entrance animation never starts invisible/blurred; none on phones).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('trust');
for (const k of ['PRELAUNCH', 'WHATSAPP_NUMBER']) delete process.env[k]; process.env.DISABLE_IP_LIMIT = '1';
const { default: app } = await import('../server.js'); const { whatsappNumber } = await import('../src/whatsapp.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
try {
  for (const v of ['972501234567', '15551234567']) assert.equal(whatsappNumber(v), v);
  for (const v of ['', '+972501234567', '050-1234567', '0501234567', '97250 1234567', '1234567', '1234567890123456', 'abc', '972501234567<script>']) assert.equal(whatsappNumber(v), null, v);
  ok('WHATSAPP_NUMBER: digits only, international (no +, no leading 0), 8-15 digits; anything else = hidden');
  let c = await (await fetch(B + '/api/config')).json(); assert.equal(c.whatsapp, null); process.env.WHATSAPP_NUMBER = '972501234567'; c = await (await fetch(B + '/api/config')).json(); assert.equal(c.whatsapp, '972501234567');
  process.env.WHATSAPP_NUMBER = '+972-50'; c = await (await fetch(B + '/api/config')).json(); assert.equal(c.whatsapp, null); delete process.env.WHATSAPP_NUMBER; ok('/api/config exposes the validated number only (null when unset/invalid)');
  const wa = fs.readFileSync('web/components/WhatsAppLink.tsx', 'utf8'); assert.ok(wa.includes('if (!n) return null') && wa.includes('https://wa.me/') && wa.includes('rel="noopener noreferrer"'));
  for (const l of ['he', 'en']) { const h = await (await fetch(B + '/' + l)).text(); assert.ok(h.includes('data-founder') && h.includes('/founder-placeholder.svg') && h.includes('data-placeholder="1"'), l); assert.ok(!h.includes('data-whatsapp'), 'no WhatsApp link in static HTML'); }
  assert.ok(fs.existsSync('public/founder-placeholder.svg')); const f = fs.readFileSync('web/lib/founder.ts', 'utf8'); assert.ok(/PLACEHOLDER/.test(f)); assert.ok(!/years of experience|award|expert|שנות ניסיון|מומחה/i.test(f));
  ok('home (HE/EN): founder section with a clearly marked placeholder photo slot, neutral copy (no invented bio claims); WhatsApp button not in static HTML (shown client-side only when set)');
  const css = fs.readFileSync('web/components/home.css', 'utf8'); const kf = css.match(/@keyframes hm-in \{[^}]*\}[^}]*\}/)[0];
  assert.ok(!/opacity: 0[;\s]/.test(kf) && !/blur/.test(kf)); assert.match(css, /@media \(max-width: 768px\) \{ \.hm-in \{ animation: none; \} \}/); ok('hero: entrance animation never starts invisible or blurred; disabled on phones (390px)');
  assert.ok(fs.readFileSync('.env.example', 'utf8').includes('WHATSAPP_NUMBER='));
  console.log(`ALL TRUST TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
