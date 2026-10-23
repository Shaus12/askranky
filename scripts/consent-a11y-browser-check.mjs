// Manual browser check of the cookie notice + accessibility menu (NOT part of `npm test`: needs Chrome via playwright from ./web).
//   CHROME=/usr/bin/google-chrome SHOTS=/path/to/dir node scripts/consent-a11y-browser-check.mjs
// Runs the real app in-process (mock scans, fake SUMIT keys so the checkout CSP is the real one) and drives it in headless Chrome:
// he/en x desktop 1280 / mobile 390, notice + menu behaviour, RTL placement, no overlap, 44px targets, persistence, modes, motion, CSP.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ranky-consentbrowser-')); process.env.FORCE_JSON_STORE = '1'; process.env.DISABLE_IP_LIMIT = '1';
Object.assign(process.env, { PAYMENTS_PROVIDER: 'sumit', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'FAKE-PRIVATE-KEY-0000', SUMIT_PUBLIC_API_KEY: 'FAKE-PUBLIC-KEY-1111', ADMIN_TEST_TOKEN: 'adm-0123456789abcdef-TOKEN', PRELAUNCH: '0', SCAN_MODE: 'mock', EMAIL_MODE: 'mock', TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' });
const { default: app } = await import('../server.js'); const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const { chromium } = createRequire(import.meta.url)(path.resolve('web/node_modules/playwright'));
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); let fails = 0; const say = m => process.stdout.write(m + '\n');
const SHOTS = process.env.SHOTS; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
const VPS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
async function session(name, { lang = 'en', vp = 'desktop', reduced = false } = {}, fn) {
  const ctx = await browser.newContext({ locale: lang === 'he' ? 'he-IL' : 'en-US', viewport: VPS[vp], reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: vp === 'mobile' }); const page = await ctx.newPage(); const csp = [], errs = [];
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp ||= []).push(`${e.violatedDirective} ${e.blockedURI}`)); });
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); }); page.on('pageerror', e => errs.push(String(e)));
  await page.route(/challenges\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|app\.sumit\.co\.il/, r => r.abort());
  try { await fn(page, { lang, vp }); const v = await page.evaluate(() => window.__csp || []); assert.deepEqual([...v, ...csp], [], 'CSP violations'); assert.deepEqual(errs, [], 'page errors'); say(`  ✓ ${name} [${lang} ${vp}]`); }
  catch (e) { fails++; say(`  ✗ ${name} [${lang} ${vp}]\n    ` + (e.stack || e).toString().split('\n').slice(0, 7).join('\n    ')); await page.screenshot({ path: path.join(os.tmpdir(), `consent-fail-${fails}.png`) }).catch(() => {}); }
  await ctx.close();
}
const box = async (page, sel) => (await page.locator(sel).first().boundingBox());
const overlap = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
const T = { en: { ok: 'OK, got it', settings: 'Cookie settings', menu: 'Accessibility menu' }, he: { ok: 'אישור, הבנתי', settings: 'הגדרות עוגיות', menu: 'תפריט נגישות' } };
for (const lang of ['en', 'he']) for (const vp of ['desktop', 'mobile']) {
  await session('cookie notice: shown, non-blocking, no overlap with the menu button, OK persists, footer link reopens, Escape closes', { lang, vp }, async (page) => {
    await page.goto(`${B}/${lang}`); await page.waitForSelector('[data-testid=consent-banner]');
    assert.equal(await page.evaluate(() => localStorage.getItem('ranky_consent_v1')), null, 'nothing stored before the visitor acts');
    assert.equal(await page.evaluate(() => document.cookie), '', 'no cookies set by just visiting');
    const b = await box(page, '[data-testid=consent-banner]'), w = await box(page, '[data-testid=a11y-button]'); assert.ok(!overlap(b, w), `banner overlaps the accessibility button ${JSON.stringify([b, w])}`);
    assert.ok(w.width >= 44 && w.height >= 44, 'menu button target >= 44px'); const ok = await box(page, '[data-testid=consent-ok]'); assert.ok(ok.height >= 44 && ok.width >= 44, 'OK target >= 44px');
    const vw = VPS[vp].width; const cx = w.x + w.width / 2; if (lang === 'he') assert.ok(cx > vw / 2, 'RTL: menu button on the right'); else assert.ok(cx < vw / 2, 'LTR: menu button on the left');
    assert.equal(await page.locator('[data-testid=consent-banner]').getAttribute('dir'), lang === 'he' ? 'rtl' : 'ltr');
    assert.ok(await page.locator('a[href$="/legal/cookies"]').first().isVisible(), 'policy link visible');
    await page.click('h1, main, body', { position: { x: 5, y: 5 }, force: true }).catch(() => {}); // page stays usable: banner does not block
    await shot(page, `${lang}-${vp}-1-notice`);
    await page.click('[data-testid=consent-ok]'); await page.waitForSelector('[data-testid=consent-banner]', { state: 'detached' });
    const rec = JSON.parse(await page.evaluate(() => localStorage.getItem('ranky_consent_v1'))); assert.equal(rec.v, 1); assert.ok(!Number.isNaN(Date.parse(rec.at))); assert.equal(await page.evaluate(() => document.cookie), '', 'consent is not a cookie');
    await page.reload(); await page.waitForTimeout(400); assert.equal(await page.locator('[data-testid=consent-banner]').count(), 0, 'stays dismissed after reload');
    await page.locator('footer [data-testid=cookie-settings]').scrollIntoViewIfNeeded(); assert.equal((await page.locator('footer [data-testid=cookie-settings]').innerText()).trim(), T[lang].settings);
    assert.ok(await page.locator(`footer a[href="/${lang}/legal/cookies"]`).count(), 'footer cookies link');
    await page.click('footer [data-testid=cookie-settings]'); await page.waitForSelector('[data-testid=consent-detail]'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'rc-title', 'focus moves to the reopened notice');
    await shot(page, `${lang}-${vp}-2-notice-reopened`);
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-testid=consent-banner]', { state: 'detached' });
  });
  await session('accessibility menu: open/close, aria, focus trap, modes apply + persist, reset', { lang, vp }, async (page) => {
    await page.addInitScript(() => localStorage.setItem('ranky_consent_v1', JSON.stringify({ v: 1, at: new Date().toISOString(), essential: true, optional: {} })));
    await page.goto(`${B}/${lang}`); const btn = page.locator('[data-testid=a11y-button]'); await btn.waitFor(); assert.equal(await btn.getAttribute('aria-label'), T[lang].menu); assert.equal(await btn.getAttribute('aria-expanded'), 'false');
    await btn.click(); await page.waitForSelector('[data-testid=a11y-panel]'); assert.equal(await btn.getAttribute('aria-expanded'), 'true'); const pid = await page.locator('[data-testid=a11y-panel]').getAttribute('id'); assert.equal(await btn.getAttribute('aria-controls'), pid);
    const inPanel = () => page.evaluate(() => !!document.activeElement?.closest('[data-testid=a11y-panel]'));
    assert.ok(await inPanel(), 'focus moves into the panel'); for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); assert.ok(await inPanel(), 'Tab stays trapped in the panel'); } for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); assert.ok(await inPanel(), 'Shift+Tab stays trapped'); }
    const pb = await box(page, '[data-testid=a11y-panel]'); assert.ok(pb.x >= 0 && pb.x + pb.width <= VPS[vp].width && pb.y >= 0, 'panel inside the viewport');
    for (const id of ['a11y-hc', 'a11y-larger', 'a11y-reset']) { const b = await box(page, `[data-testid=${id}]`); assert.ok(b.height >= 44 && b.width >= 44, `${id} >= 44px`); }
    await shot(page, `${lang}-${vp}-3-menu`);
    const fs0 = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)); await page.click('[data-testid=a11y-larger]'); await page.click('[data-testid=a11y-larger]');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('a11y-t2')), true); assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) > fs0 * 1.2, 'text enlarged');
    await page.click('[data-testid=a11y-smaller]'); await page.click('[data-testid=a11y-textreset]'); assert.equal(await page.evaluate(() => /a11y-t\d|a11y-tm1/.test(document.documentElement.className)), false);
    await page.click('[data-testid=a11y-hc]'); assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)'); assert.equal(await page.locator('[data-testid=a11y-hc]').getAttribute('aria-pressed'), 'true');
    await shot(page, `${lang}-${vp}-4-high-contrast`);
    await page.click('[data-testid=a11y-lc]'); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('a11y-hc')), false, 'light contrast replaces dark'); assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
    await shot(page, `${lang}-${vp}-5-light-contrast`);
    await page.click('[data-testid=a11y-lc]'); await page.click('[data-testid=a11y-gray]'); await page.click('[data-testid=a11y-links]'); await page.click('[data-testid=a11y-font]'); await page.click('[data-testid=a11y-cursor]');
    const cls = await page.evaluate(() => document.documentElement.className); for (const c of ['a11y-gray', 'a11y-links', 'a11y-font', 'a11y-cursor']) assert.ok(cls.includes(c), c);
    assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Arial/); assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).filter), 'grayscale(1)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('a[href*="/legal/"], footer a')).backgroundColor), 'rgb(255, 255, 0)', 'links highlighted');
    await shot(page, `${lang}-${vp}-6-links-font-gray`);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('ranky_a11y_v1'))); assert.equal(stored.gray, true); assert.equal(await page.evaluate(() => document.cookie), '', 'settings are not cookies');
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-testid=a11y-panel]', { state: 'detached' }); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'a11y-button', 'focus returns to the button'); assert.equal(await btn.getAttribute('aria-expanded'), 'false');
    await page.reload(); await page.waitForSelector('[data-testid=a11y-button]'); await page.waitForTimeout(200); assert.ok((await page.evaluate(() => document.documentElement.className)).includes('a11y-gray'), 'persists after reload');
    await page.click('[data-testid=a11y-button]'); await page.click('[data-testid=a11y-reset]'); assert.equal(await page.evaluate(() => /a11y-/.test(document.documentElement.className)), false, 'reset clears every mode'); assert.equal(await page.evaluate(() => localStorage.getItem('ranky_a11y_v1')), null);
    assert.equal(await page.locator(`.ra-panel a[href="/${lang}/legal/accessibility"]`).count(), 1, 'statement link');
  });
}
await session('stop animations: GSAP reveals completed + Lenis off at runtime; persists; honors prefers-reduced-motion by default', { lang: 'en', vp: 'desktop' }, async (page) => {
  await page.addInitScript(() => localStorage.setItem('ranky_consent_v1', JSON.stringify({ v: 1, at: new Date().toISOString(), essential: true, optional: {} })));
  await page.goto(`${B}/en`); await page.waitForSelector('[data-testid=a11y-button]'); await page.waitForTimeout(1500);
  const hidden = () => page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity !== '1').length);
  assert.ok(await hidden() > 0, 'precondition: some reveal items are still hidden below the fold');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), true, 'precondition: Lenis running');
  await page.click('[data-testid=a11y-button]'); await page.click('[data-testid=a11y-motion]'); await page.waitForTimeout(300);
  assert.equal(await hidden(), 0, 'all reveal items visible once animations are stopped'); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false, 'Lenis destroyed');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.dot, .shimmer') || document.body).animationName), 'none');
  await page.reload(); await page.waitForTimeout(1200); assert.equal(await hidden(), 0, 'stays stopped after reload (GSAP never started the reveals)'); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false, 'Lenis not started after reload');
});
await session('prefers-reduced-motion: default on (menu shows it)', { lang: 'en', vp: 'desktop', reduced: true }, async (page) => {
  await page.goto(`${B}/en`); await page.waitForSelector('[data-testid=a11y-button]'); await page.click('[data-testid=a11y-button]'); assert.equal(await page.locator('[data-testid=a11y-motion]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false); assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity !== '1').length), 0);
});
for (const lang of ['he', 'en']) for (const vp of ['desktop', 'mobile']) await session('checkout page (strict CSP): notice + menu + every mode, no CSP violations, card inputs unnamed', { lang, vp }, async (page) => {
  await page.goto(`${B}/${lang}/checkout?plan=starter`); await page.waitForSelector('[data-testid=consent-banner]'); await page.waitForSelector('input[name=email]');
  const resp = await page.request.get(`${B}/${lang}/checkout`); const csp = resp.headers()['content-security-policy']; assert.ok(csp && !/script-src[^;]*unsafe-inline/.test(csp) && !/script-src[^;]*unsafe-eval/.test(csp), 'script-src stays strict');
  await shot(page, `${lang}-${vp}-7-checkout-notice`); await page.click('[data-testid=consent-ok]');
  await page.click('[data-testid=a11y-button]'); for (const k of ['hc', 'links', 'font', 'cursor', 'motion', 'gray']) await page.click(`[data-testid=a11y-${k}]`); await page.click('[data-testid=a11y-larger]');
  await page.keyboard.press('Escape'); await shot(page, `${lang}-${vp}-8-checkout-modes`);
  assert.equal(await page.locator('input[name=email]').count(), 1);
  await page.click('[data-testid=a11y-button]'); await page.click('[data-testid=a11y-reset]'); await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
});
await session('legal cookies doc + footer', { lang: 'he', vp: 'desktop' }, async (page) => {
  await page.goto(`${B}/he/legal/cookies`); await page.waitForSelector('[data-legal-doc=cookies] h1'); const txt = await page.locator('[data-legal-doc=cookies]').innerText(); for (const s of ['ranky_lang', 'ranky_consent_v1', 'Turnstile', '12 חודשים']) assert.ok(txt.includes(s), s); await shot(page, 'he-desktop-9-cookies-doc');
  await page.goto(`${B}/en/legal/cookies`); const en = await page.locator('[data-legal-doc=cookies]').innerText(); assert.ok(en.includes('ranky_a11y_v1') && en.includes('Global Privacy Control'));
});
await browser.close(); srv.close(); say(fails ? `\nBROWSER CHECK FAILED (${fails})` : '\nBROWSER CHECK PASSED'); process.exit(fails ? 1 : 0);
