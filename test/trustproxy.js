// TRUST_PROXY from the environment is a string: "1" must mean "trust one proxy hop" (so per-IP limits see the real client), not the IP 0.0.0.1.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('trustproxy');
process.env.TRUST_PROXY = '1'; process.env.DISABLE_IP_LIMIT = '1';
const { default: app, trustProxySetting } = await import('../server.js'); const { flush } = await import('../src/store.js');
assert.equal(trustProxySetting('1'), 1); assert.equal(trustProxySetting(' 2 '), 2); assert.equal(trustProxySetting('true'), true); assert.equal(trustProxySetting('false'), false); assert.equal(trustProxySetting('loopback'), 'loopback'); assert.equal(trustProxySetting('10.0.0.0/8, 127.0.0.1'), '10.0.0.0/8, 127.0.0.1');
assert.equal(app.get('trust proxy fn')('127.0.0.1', 0), true, 'first hop trusted'); assert.equal(app.get('trust proxy fn')('127.0.0.1', 1), false, 'second hop not');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
try {
  // Two different visitors behind the same proxy must be counted separately: 3 free scans each would exhaust a shared IP bucket.
  delete process.env.DISABLE_IP_LIMIT; const codes = []; const go = (ip, i) => fetch(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ name: 'B' + i, category: 'Cafe', city: 'Haifa', email: `u${ip.replaceAll('.', '')}${i}@t.test`, lang: 'en' }) }).then(r => r.status);
  for (let i = 0; i < 4; i++) codes.push(await go('198.51.100.1', i)); for (let i = 0; i < 3; i++) codes.push(await go('198.51.100.2', i));
  assert.deepEqual(codes, [200, 200, 200, 429, 200, 200, 200], 'limit is per real client IP (X-Forwarded-For via TRUST_PROXY=1)');
  console.log('  ✓ TRUST_PROXY="1" → one trusted proxy hop: per-IP limits see the client IP from X-Forwarded-For (not the proxy)'); console.log('ALL TRUST-PROXY TESTS PASSED (1)');
} finally { srv.close(); await flush(); TD.done(); }
process.exit(0);
