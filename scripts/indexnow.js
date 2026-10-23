#!/usr/bin/env node
// IndexNow submission (Bing, Yandex, Seznam, Naver; Google does not support IndexNow). NOT run automatically and never at test time.
//   node scripts/indexnow.js            → prints the payload it WOULD send (dry run)
//   node scripts/indexnow.js --send     → POSTs it to https://api.indexnow.org/indexnow
// The key is public by design: it is the name and the content of public/{key}.txt, served at https://askranky.com/{key}.txt
// (proves we own the host). The URL list is every <loc> of the sitemap (src/seo.js), so new blog posts are included automatically.
// Submit after a deploy that adds or changes pages; at most once per change (do not resubmit unchanged URLs repeatedly).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { SITE, sitemapXml } from '../src/seo.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOST = 'askranky.com'; export const ENDPOINT = 'https://api.indexnow.org/indexnow';
export function indexNowKey() {
  const f = fs.readdirSync(path.join(ROOT, 'public')).filter(n => /^[0-9a-f]{32}\.txt$/.test(n)); if (f.length !== 1) throw new Error('expected exactly one public/{32-hex}.txt key file');
  const key = f[0].slice(0, -4); if (fs.readFileSync(path.join(ROOT, 'public', f[0]), 'utf8').trim() !== key) throw new Error('key file content must equal its name'); return key;
}
export function buildPayload() {
  const key = indexNowKey(); const urlList = [...sitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&')).filter(u => u.startsWith(`https://${HOST}/`));
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const p = buildPayload(); if (!process.argv.includes('--send')) { console.log(`dry run (${p.urlList.length} URLs; use --send to submit)\n` + JSON.stringify(p, null, 2)); process.exit(0); }
  if (SITE() !== `https://${HOST}`) { console.error(`SITE_URL is ${SITE()}, refusing to submit`); process.exit(1); }
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(p) });
  console.log('IndexNow', r.status, r.statusText); process.exit(r.status === 200 || r.status === 202 ? 0 : 1);
}
