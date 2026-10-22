// Pricing screenshots (he/en × desktop/mobile): pricing section in the detected currency, the toggled currency, and checkout.
// Usage: DATA_DIR=$(mktemp -d) PORT=3056 node server.js &  BASE=http://localhost:3056 OUT=../screenshots/ranky/pricing node web/scripts/pricing-shots.mjs
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path";
const BASE = process.env.BASE || "http://localhost:3000"; const OUT = path.resolve(process.env.OUT || "screenshots"); fs.mkdirSync(OUT, { recursive: true });
const views = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 } };
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [v, o] of Object.entries(views)) for (const lang of ["he", "en"]) {
  const ctx = await b.newContext({ ...o, locale: lang === "he" ? "he-IL" : "en-US" }); const p = await ctx.newPage(); const tag = `${lang}-${v}`;
  const sec = async (name) => { await p.waitForTimeout(600); const el = p.locator("#pricing"); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500); const f = path.join(OUT, `${name}-${tag}.png`); await el.screenshot({ path: f }); console.log(f); };
  await p.goto(`${BASE}/${lang}#pricing`, { waitUntil: "networkidle" }); await sec("pricing");
  const other = lang === "he" ? "USD" : "ILS"; await p.click(`[data-currency=${other}]`); await p.waitForTimeout(500); await sec(`pricing-${other.toLowerCase()}`);
  await p.click(`[data-currency=${other === "USD" ? "ILS" : "USD"}]`); // restore detected currency
  await p.goto(`${BASE}/${lang}/checkout?plan=pro`, { waitUntil: "networkidle" }); await p.waitForTimeout(800); const f = path.join(OUT, `checkout-pro-${tag}.png`); await p.screenshot({ path: f, fullPage: true }); console.log(f);
  await ctx.close();
}
await b.close();
