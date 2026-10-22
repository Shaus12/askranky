// Renders public/og-he.png, public/og-en.png (1200x630) and public/logo.png (512x512). Run: node scripts/og-images.mjs
import { chromium } from "playwright"; import path from "node:path";
const OUT = path.resolve("../public");
const page = (dir, lang, title, sub) => `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;width:1200px;height:630px;background:radial-gradient(120% 90% at 50% 0%,#0a1b4d 0%,#01061a 65%);color:#fff;font-family:Heebo,Inter,Arial,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="font-size:40px;font-weight:800;letter-spacing:-.02em">Ranky</div><div style="height:1px;width:220px;background:rgba(255,255,255,.35);margin:26px 0"></div>
<div style="font-size:72px;font-weight:800;line-height:1.05;letter-spacing:-.03em;max-width:1000px">${title}</div><div style="font-size:30px;color:#b9c4e4;margin-top:28px">${sub}</div>
<div style="margin-top:40px;display:inline-block;align-self:flex-start;background:#22c55e;color:#03140a;font-weight:800;font-size:26px;padding:14px 30px;border-radius:999px">askranky.com</div></body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(page("rtl", "he", "הלקוח הבא שלך שואל את ChatGPT", "בדקו בחינם אם AI ממליץ על העסק שלכם")); await p.screenshot({ path: `${OUT}/og-he.png` });
await p.setContent(page("ltr", "en", "Your next customer is asking ChatGPT", "Free scan: does AI recommend your business?")); await p.screenshot({ path: `${OUT}/og-en.png` });
await p.setViewportSize({ width: 512, height: 512 });
await p.setContent(`<body style="margin:0;width:512px;height:512px;background:#01061a;display:flex;align-items:center;justify-content:center"><div style="width:400px;height:400px;border-radius:96px;background:linear-gradient(135deg,#1d4ed8,#0B1B3F);display:flex;align-items:center;justify-content:center;color:#fff;font:800 260px Inter,Arial,sans-serif">R</div></body>`);
await p.screenshot({ path: `${OUT}/logo.png` }); await b.close(); console.log("ok");
