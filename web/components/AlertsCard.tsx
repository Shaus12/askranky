import type { Locale } from "@/lib/i18n";
import "./perception.css";

// Alerts = what got worse between a scan and the one before it (computed server-side in src/alert-detect.js). Same sentences as the alert email.
export type Alert = { type: "wrong_fact" | "score_drop" | "engine_lost" | "competitor_overtook" | "tone_drop"; severity: "high" | "medium"; at?: string; scanId?: string;
  fact?: { type: string; said: string; expected?: string; quote: string; engines: string[] }; from?: number; to?: number; engine?: string; before?: number; checks?: number;
  name?: string; them?: number; you?: number; themBefore?: number; youBefore?: number; example?: { text: string; engine: string } | null };

const ENG: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
const engs = (e?: string[]) => (e || []).map((x) => ENG[x] || x).join(", ");
const sign = (n?: number) => (n != null && n > 0 ? `+${n}` : String(n ?? ""));
const T = {
  en: { title: "Alerts", sub: "What got worse since the scan before", none: "Nothing got worse since your previous scan.", first: "Alerts start after your second scan: they compare each scan with the one before.",
    email: "Alerts appear here after each re-scan. Email alerts are coming soon.", high: "Important", medium: "Worth a look", quote: "Quote",
    fact: { city: "city", website: "website", status: "status", phone: "phone number", hours: "opening hours" } as Record<string, string>,
    s: { wrong_fact: (a: Alert, b: string) => a.fact!.type === "status" ? `${engs(a.fact!.engines)} now says ${b} is "${a.fact!.said}".` : `${engs(a.fact!.engines)} now gives the wrong ${T.en.fact[a.fact!.type] || a.fact!.type}: "${a.fact!.said}"${a.fact!.expected ? ` (you told us ${a.fact!.expected})` : ""}.`,
      score_drop: (a: Alert) => `Your score dropped from ${a.from} to ${a.to}.`,
      engine_lost: (a: Alert) => `${ENG[a.engine!] || a.engine} stopped naming you (0 of ${a.checks} answers; ${a.before} before).`,
      competitor_overtook: (a: Alert) => `${a.name} is now named more often than you: ${a.them} vs ${a.you} (before: ${a.themBefore} vs ${a.youBefore}).`,
      tone_drop: (a: Alert) => ((a.from ?? 0) - (a.to ?? 0) >= 20 ? `Tone of answers about you fell from ${sign(a.from)} to ${sign(a.to)}.` : "An answer about you is now negative.") } },
  he: { title: "התראות", sub: "מה החמיר מאז הסריקה הקודמת", none: "שום דבר לא החמיר מאז הסריקה הקודמת.", first: "ההתראות מתחילות מהסריקה השנייה: הן משוות כל סריקה לזו שלפניה.",
    email: "ההתראות מופיעות כאן אחרי כל סריקה חוזרת. התראות במייל בקרוב.", high: "חשוב", medium: "כדאי לבדוק", quote: "ציטוט",
    fact: { city: "העיר", website: "האתר", status: "הסטטוס", phone: "הטלפון", hours: "שעות הפתיחה" } as Record<string, string>,
    s: { wrong_fact: (a: Alert, b: string) => a.fact!.type === "status" ? `${engs(a.fact!.engines)} אומר עכשיו ש${b} „${a.fact!.said}”.` : `${engs(a.fact!.engines)} מציג עכשיו את ${T.he.fact[a.fact!.type] || a.fact!.type} הלא נכון: „${a.fact!.said}”${a.fact!.expected ? ` (אצלך: ${a.fact!.expected})` : ""}.`,
      score_drop: (a: Alert) => `הציון שלך ירד מ־${a.from} ל־${a.to}.`,
      engine_lost: (a: Alert) => `${ENG[a.engine!] || a.engine} הפסיק להזכיר אותך (0 מתוך ${a.checks} תשובות; קודם ${a.before}).`,
      competitor_overtook: (a: Alert) => `${a.name} מוזכר עכשיו יותר ממך: ${a.them} מול ${a.you} (קודם: ${a.themBefore} מול ${a.youBefore}).`,
      tone_drop: (a: Alert) => ((a.from ?? 0) - (a.to ?? 0) >= 20 ? `הטון של התשובות עליך ירד מ־${a.from} ל־${a.to}.` : "תשובה עליך הפכה לשלילית.") } },
};

/** Alerts card for the dashboard (all recent scans) and the report (that scan only). `scans` = how many scans exist, for the empty state. */
export default function AlertsCard({ alerts, business, lang, scans = 2, id = "al" }: { alerts?: Alert[] | null; business: string; lang: Locale; scans?: number; id?: string }) {
  const t = T[lang]; const list = alerts || [];
  const fmt = (s?: string) => (s ? new Date(s).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" }) : "");
  return (
    <section className="card pc-card al" aria-labelledby={`${id}-t`} data-alerts>
      <div className="al-head"><h3 id={`${id}-t`} className="pc-h">{t.title}{list.length > 0 && <span className="al-count" dir="ltr">{list.length}</span>}</h3><p className="pc-sub">{t.sub}</p></div>
      {list.length === 0 ? <p className="pc-meta al-empty">{scans < 2 ? t.first : t.none}</p> : (
        <ul className="al-list">{list.map((a, i) => (
          <li key={`${a.scanId}-${i}`} className={`al-item al-${a.severity}`} data-alert={a.type}>
            <span className="al-sev">{a.severity === "high" ? t.high : t.medium}</span>
            <p className="al-text">{(t.s[a.type] as (x: Alert, b: string) => string)(a, business)}</p>
            {(a.fact?.quote || a.example?.text) && <p className="pc-meta">{t.quote}: “{a.fact?.quote || a.example?.text}”</p>}
            {a.at && <p className="pc-meta" dir="ltr">{fmt(a.at)}</p>}
          </li>))}</ul>)}
      <p className="pc-how">{t.email}</p>
    </section>
  );
}
