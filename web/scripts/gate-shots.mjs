// gate1 screenshots + Facebook in-app browser check (mock mode, local only). BASE=http://localhost:3077 OUT=... node web/scripts/gate-shots.mjs
import { chromium } from "playwright"; import path from "node:path"; import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3077"; const OUT = path.resolve(process.env.OUT || "screenshots"); fs.mkdirSync(OUT, { recursive: true });
const FB = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0;FBBV/600000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/he_IL;FBOP/5]";
const views = { desktop: { viewport: { width: 1440, height: 900 } }, m390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, fb: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: FB } };
const BIZ = { he: { name: "סטודיו לדוגמה", city: "תל אביב-יפו" }, en: { name: "Sample Studio", city: "Haifa" } };
const b = await chromium.launch(); const report = [];
for (const [v, opts] of Object.entries(views)) for (const lang of ["he", "en"]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const tag = `${v}-${lang}`;
  await p.goto(`${BASE}/${lang}/scan`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  const consent = p.locator("text=/אישור|Accept|מאשר|OK/i").first();
  const noHScroll = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const covered = (sel) => p.evaluate(async (sel) => { const el = document.querySelector(sel); if (!el) return "missing"; el.scrollIntoView({ block: "center", behavior: "instant" }); await new Promise((r) => setTimeout(r, 400)); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && (el === top || el.contains(top)) ? "ok" : "covered by " + (top?.tagName + "." + top?.className).slice(0, 60); }, sel);
  const cName = await covered('input[name="name"]'), cCity = await covered('input[name="city"]');
  const ts = await p.evaluate(() => { const el = document.querySelector("[data-testid=turnstile]"); if (!el) return "missing"; const r = el.getBoundingClientRect(); const f = el.querySelector("iframe"); return (r.right <= window.innerWidth + 1 && r.left >= -1 ? `ok ${Math.round(r.width)}x${Math.round(r.height)}` : "overflow") + (f ? " widget-iframe" : " no-iframe"); });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/gate1-${tag}-form.png`, fullPage: true });
  await p.fill('input[name="name"]', BIZ[lang].name); await p.fill('input[name="city"]', BIZ[lang].city);
  await p.waitForFunction(() => { const i = document.querySelector('input[name="cf-turnstile-response"]'); return !i || i.value; }, null, { timeout: 20000 }).catch(() => {});
  await p.locator('[data-submit-bar] button').click();
  const kept = await p.locator("[data-city-confirm] button").first(); if (await kept.count()) await p.locator("[data-city-confirm] button").nth(1).click();
  await p.waitForSelector("[data-locked-report]", { timeout: 60000 }); await p.waitForTimeout(1500);
  const h1 = await noHScroll(); const cEmail = await covered('[data-unlock-form] input[name="email"]');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/gate1-${tag}-partial.png`, fullPage: true });
  await p.fill('[data-unlock-form] input[name="email"]', `shot-${tag}@example.test`); await p.locator('[data-unlock-form] button').click();
  await p.waitForSelector("[data-locked-report]", { state: "detached", timeout: 20000 }); await p.waitForTimeout(2500);
  const h2 = await noHScroll(); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/gate1-${tag}-unlocked.png`, fullPage: true });
  report.push({ tag, formNoHScroll: await noHScroll(), nameField: cName, cityField: cCity, turnstile: ts, partialNoHScroll: h1, emailField: cEmail, unlocked: true, fullNoHScroll: h2 });
  await ctx.close();
}
await b.close(); console.log(JSON.stringify(report, null, 1));
