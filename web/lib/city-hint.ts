// Mirror of cityHint in app/src/cities.js (tested there): a city named in the business name/website that differs from the entered city.
import { ISRAELI_CITIES } from "./cities";
type City = { he: string; en: string; slug: string };
const key = (s: string) => String(s || "").toLowerCase().replace(/[\s\-'׳"]+/g, "");
const hintText = (s: string) => " " + String(s || "").toLowerCase().replace(/https?:\/\//g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
const EXTRA: Record<string, string[]> = { herzliya: ["herzlia", "herzelia", "pituach"], "tel-aviv-yafo": ["tel aviv", "telaviv", "תל אביב", "tlv", "jaffa", "יפו"] };
export function cityHint({ name = "", website = "", city = "" }: { name?: string; website?: string; city?: string }): City | null {
  const text = hintText(`${name} ${website}`); const ec = key(city);
  for (const c of ISRAELI_CITIES) {
    const fs = [c.he, c.en, c.slug.replace(/-/g, " "), c.slug.replace(/-/g, "")].map((f) => hintText(f).trim()).filter((f) => f.length >= 3).concat(EXTRA[c.slug] || []);
    if (fs.some((f) => text.includes(` ${f} `) || (/^[\u05D0-\u05EA]/.test(f) && new RegExp(` [הובלמש]${f} `).test(text)))) {
      const same = ec && (ec === key(c.he) || ec === key(c.en) || (EXTRA[c.slug] || []).some((x) => key(x) === ec) || (c.slug === "tel-aviv-yafo" && ec === key("תל אביב")));
      return same ? null : c;
    }
  }
  return null;
}
