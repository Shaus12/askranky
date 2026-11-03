// home-sample (trade1 C): sample report above the home scan form. Real anonymized data only; with none available it is a numberless,
// clearly labelled placeholder. The anonymizer replaces every name, strips URLs and refuses dental scans.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync, spawnSync } from 'node:child_process';
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const copy = fs.readFileSync('web/lib/sample-copy.ts', 'utf8'); const comp = fs.readFileSync('web/components/HomeSample.tsx', 'utf8'); const real = fs.readFileSync('web/lib/sample-real.ts', 'utf8');
const ph = [...copy.matchAll(/(?:badgePlaceholder|phBusiness|phMeta|phChecks|phNamed|phQuestion|phAnswer|notePlaceholder): (\[[^\]]*\]|"[^"]*")/g)].map(m => m[1]);
assert.ok(ph.length >= 16); for (const x of ph) assert.ok(!/\d/.test(x), `placeholder has a number: ${x}`); assert.ok(!/dent|שיניים/i.test(copy + comp + real));
ok('placeholder copy (HE+EN) has no numbers, no dentist wording');
assert.match(real, /he: null, en: null/); assert.match(comp, /data-home-sample=\{s \? "real" : "placeholder"\}/); assert.match(comp, /s \? s\.score : "—"/); ok('no real sample set -> placeholder mode, score shows "—"');
const page = fs.readFileSync('web/app/[lang]/page.tsx', 'utf8'); assert.ok(page.indexOf('<HomeSample') > 0 && page.indexOf('<HomeSample') < page.indexOf('<ScanForm')); ok('home: sample section sits above the scan form');
for (const l of ['he', 'en']) { const h = fs.readFileSync(`web/out/${l}.html`, 'utf8'); assert.ok(h.indexOf('data-home-sample') > 0 && h.indexOf('data-home-sample') < h.indexOf('name="trade"')); }
ok('built /he and /en: sample rendered before the form');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-'));
const scan = { business: { name: 'Acme Pipes' }, scan: { at: '2026-11-01T10:00:00Z', summary: { score: 40, checks: 2, engines: { ran: ['chatgpt', 'gemini'] }, topCompetitors: [{ name: 'Blue Flow', count: 2 }, { name: 'Red Valve', count: 1 }] },
  results: [{ question: 'Best plumbing in Haifa?', engine: 'chatgpt', answer: '1. **Blue Flow** ([blueflow.co.il](https://blueflow.co.il/x)) 2. Red Valve, see https://redvalve.com 3. Acme Pipes', mentioned: true, competitors: [{ name: 'Blue Flow' }] }] } };
fs.writeFileSync(path.join(tmp, 's.json'), JSON.stringify(scan)); const out = JSON.parse(execFileSync('node', ['scripts/anonymize-sample.mjs', path.join(tmp, 's.json'), 'en', 'Plumber', 'Haifa'], { encoding: 'utf8' }));
const t = JSON.stringify(out); for (const bad of ['Blue Flow', 'Red Valve', 'Acme', 'http', '.co.il', '.com']) assert.ok(!t.includes(bad), `leaks ${bad}`);
assert.equal(out.score, 40); assert.deepEqual(out.named, [{ label: 'Business A', count: 2 }, { label: 'Business B', count: 1 }]); assert.match(out.qa[0].excerpt, /Business A.*Business B.*The scanned business/s);
ok('anonymizer: names -> neutral labels (also inside answers), URLs/domains stripped, real numbers copied unchanged');
const dental = structuredClone(scan); dental.scan.results[0].answer = 'Best dentist'; fs.writeFileSync(path.join(tmp, 'd.json'), JSON.stringify(dental));
assert.equal(spawnSync('node', ['scripts/anonymize-sample.mjs', path.join(tmp, 'd.json'), 'en'], { encoding: 'utf8' }).status, 1); ok('anonymizer refuses dental scans');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`homesample: ${n} checks passed`);
