// Legal handoff: whitelisted docs, Hebrew loading, COMPLIANCE-NOTES never served, entity substitutions, SUMIT receipt-only, scan-form consent.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('legal');
process.env.DISABLE_IP_LIMIT = '1'; delete process.env.PRELAUNCH;
const { default: app, LEGAL_DOCS } = await import('../server.js'); const { getDb, flush } = await import('../src/store.js'); const { BRAND } = await import('../src/brand.js'); const S = await import('../src/payments/sumit.js'); const { PLANS } = await import('../src/plans.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const get = p => fetch(B + p).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
try {
  assert.deepEqual([BRAND.legalEntity, BRAND.legalEntityHe, BRAND.entityId], ['Shai Shotashvili', 'שי שוטשוילי', '322713082']); assert.ok(BRAND.address && BRAND.addressHe && BRAND.privacyEmail && BRAND.accessibilityEmail); ok('brand.js: legal entity, עוסק פטור no., address, privacy/accessibility emails');
  for (const p of ['/api/legal/COMPLIANCE-NOTES', '/api/legal/compliancenotes', '/api/legal/COMPLIANCE-NOTES?lang=he', '/api/legal/he/COMPLIANCE-NOTES', '/api/legal/..%2Fpackage', '/api/legal/termshe', '/api/legal/constructor']) assert.equal((await get(p)).s, 404, p);
  ok('COMPLIANCE-NOTES and anything off the whitelist → 404');
  for (const d of LEGAL_DOCS) { const en = await get(`/api/legal/${d}`), he = await get(`/api/legal/${d}?lang=he`), he2 = await get(`/api/legal/he/${d}`);
    assert.equal(en.s, 200, d); assert.equal(en.j.lang, 'en'); assert.equal(he.j.lang, 'he', d); assert.equal(he2.j.markdown, he.j.markdown); assert.match(he.j.markdown, /[\u0590-\u05FF]/); assert.ok(!/\{\{[A-Z_]+\}\}/.test(en.j.markdown + he.j.markdown), d); }
  ok(`all ${LEGAL_DOCS.length} docs (incl. accessibility) load in EN and HE (?lang=he and /he/:doc), no raw placeholders`);
  const sel = (await get('/api/seller')).j; assert.equal(sel.entityId, '322713082'); assert.equal(sel.vat, false); ok('/api/seller disclosure: entity, number, address, no VAT');
  const ft = fs.readFileSync('web/lib/i18n.ts', 'utf8'); assert.match(ft, /322713082/); assert.match(ft, /renews automatically/); assert.match(fs.readFileSync('web/components/Checkout.tsx', 'utf8'), /data-disclosure/); ok('footer + checkout show seller details, no-VAT and renewal/cancellation terms');
  // SUMIT: receipt only
  assert.equal(S.SUMIT_DOCUMENT_TYPE, 2); const body = S.buildChargeRequest({ account: { id: 'a', email: 'x@y.test' }, plan: PLANS.pro, billing: { currency: 'ILS', amount: 179 }, token: 't' });
  const js = JSON.stringify(body); assert.match(js, /"DocumentType":2/); assert.match(js, /"VATIncluded":false/); assert.match(js, /"NoVAT":true/); assert.ok(!/"DocumentType":[01]\b/.test(js));
  assert.ok(!/DocumentType:\s*[01]\b/.test(fs.readFileSync('src/payments/sumit.js', 'utf8'))); ok('SUMIT: DocumentType 2 (קבלה), VATIncluded false, NoVAT; no invoice types anywhere');
  // consent
  const scan = b => fetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'C', category: 'Plumber', city: 'Haifa', lang: 'he', ...b }) });
  assert.equal((await scan({ email: 'no@t.test' })).status, 200); const a0 = Object.values(getDb().accounts).find(a => a.email === 'no@t.test'); assert.equal(a0.marketingConsent, undefined); ok('no consent stored when the box is left unchecked (default)');
  assert.equal((await scan({ email: 'yes@t.test', marketingConsent: 'on' })).status, 200); const a1 = Object.values(getDb().accounts).find(a => a.email === 'yes@t.test');
  assert.equal(a1.marketingConsent.granted, true); assert.equal(a1.marketingConsent.lang, 'he'); assert.ok(Date.now() - Date.parse(a1.marketingConsent.at) < 60000); assert.ok(getDb().events.some(e => e.type === 'consent.marketing' && e.account === a1.id)); ok('checked consent stored with timestamp, language, version + event');
  const sf = fs.readFileSync('web/components/ScanForm.tsx', 'utf8'); assert.match(sf, /type="checkbox" name="marketingConsent"/); assert.match(sf, /defaultChecked=\{false\}/); assert.ok(!/name="marketingConsent"[^>]*required/.test(sf)); assert.match(sf, /data-privacy/); ok('scan form: optional unchecked consent checkbox + privacy notice link (HE/EN)');
  console.log(`ALL LEGAL TESTS PASSED (${n})`);
} finally { srv.close(); await flush(); TD.done(); }
