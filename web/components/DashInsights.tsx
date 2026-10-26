"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

// Dashboard insights (v2): per-engine trend, competitor leaderboard, question explorer, cited-source gaps, CSV export.
// Data comes only from /api/dashboard (the account's own stored scans); nothing here calls an engine.
type EngineRow = { checks: number; mentions: number; mentionRate: number; avgRank: number | null; score: number | null };
type Trend = { scanId: string; at: string; score: number | null; byEngine: Record<string, EngineRow> };
type Comp = { name: string; total: number; scans: number; counts: number[]; last: number; prev: number | null; trend: number };
type QE = { error?: boolean; excerpt?: string; mentioned?: boolean; rank?: number | null; competitors?: string[]; change?: { mentionedBefore: boolean; rankBefore: number | null; delta: number } | null };
type Src = { host: string; cited: number; missing: number; engines: string[] };
export type Insights = { businessId: string; scanCount: number; engineTrend: Trend[]; competitors: Comp[]; questions: { question: string; engines: Record<string, QE> }[]; sources: Src[]; lastScanAt: string | null; prevScanAt: string | null };

const ENG: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
const COL: Record<string, string> = { chatgpt: "#2563eb", gemini: "#93c5fd", perplexity: "#a1a1aa" };
const band = (s: number | null | undefined) => s == null ? "" : s < 40 ? "di-low" : s < 70 ? "di-mid" : "di-high";
const T = {
  en: { trend: "Score by engine over time", trendOne: "One scan so far: the trend appears after your next scan.", mention: "mentioned", rank: "avg. rank", comps: "Who AI recommends instead", compSub: "Businesses named most often across your scans", name: "Business", times: "Mentions", inScans: "Scans", tr: "Trend", noComps: "No competitors were named yet.",
    qs: "Question explorer", qsSub: "Every question from your latest scan, with each engine's answer", yes: "Mentioned", no: "Not mentioned", rankN: "Rank", alsoNamed: "Also named", err: "Engine error", since: "Since last scan", better: "Improved", worse: "Dropped", same: "No change", newQ: "New question", noQs: "No answers stored for this scan.",
    src: "Where AI gets its information", srcSub: "Sites the engines cited in answers that did not mention you", cited: "cited", missing: "without you", todo: "To do", todoT: (h: string) => `Get listed on ${h}: claim or create your profile with the same name, category and city as your website.`, noSrc: "No outside sources were cited in answers that missed you.",
    csv: "Download CSV", csvBusy: "Preparing…", scanN: "Scan", empty: "Your insights will appear here after your first scan." },
  he: { trend: "ציון לפי מנוע לאורך זמן", trendOne: "יש עד עכשיו סריקה אחת: המגמה תופיע אחרי הסריקה הבאה.", mention: "אזכור", rank: "דירוג ממוצע", comps: "את מי ה-AI ממליץ במקומך", compSub: "העסקים שהוזכרו הכי הרבה בסריקות שלך", name: "עסק", times: "אזכורים", inScans: "סריקות", tr: "מגמה", noComps: "עדיין לא הוזכרו מתחרים.",
    qs: "סייר השאלות", qsSub: "כל שאלה מהסריקה האחרונה, עם התשובה של כל מנוע", yes: "מוזכר", no: "לא מוזכר", rankN: "מקום", alsoNamed: "הוזכרו גם", err: "שגיאת מנוע", since: "מאז הסריקה הקודמת", better: "השתפר", worse: "ירד", same: "ללא שינוי", newQ: "שאלה חדשה", noQs: "אין תשובות שמורות לסריקה הזאת.",
    src: "מאיפה ה-AI לוקח את המידע", srcSub: "אתרים שהמנועים ציטטו בתשובות שלא הזכירו אותך", cited: "ציטוטים", missing: "בלעדייך", todo: "לביצוע", todoT: (h: string) => `להירשם ב-${h}: לפתוח או לעדכן פרופיל עם אותו שם, תחום ועיר כמו באתר שלך.`, noSrc: "לא צוטטו מקורות חיצוניים בתשובות שבהן לא הוזכרת.",
    csv: "הורדת CSV", csvBusy: "מכין…", scanN: "סריקה", empty: "התובנות יופיעו כאן אחרי הסריקה הראשונה." },
};

function EngineChart({ rows, lang }: { rows: Trend[]; lang: Locale }) {
  const engines = [...new Set(rows.flatMap((r) => Object.keys(r.byEngine)))];
  const W = 560, H = 200, P = 28; const x = (i: number) => P + (rows.length > 1 ? (i * (W - 2 * P)) / (rows.length - 1) : (W - 2 * P) / 2); const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const fmt = (s: string) => new Date(s).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: "ltr" }} role="img" aria-label={engines.map((e) => `${ENG[e] || e}: ${rows.map((r) => r.byEngine[e]?.score ?? "–").join(", ")}`).join("; ")} data-engine-chart>
      {[0, 50, 100].map((g) => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,.08)" /><text x={4} y={y(g) + 4} fill="#71717a" fontSize="10">{g}</text></g>)}
      {rows.map((r, i) => <text key={r.scanId} x={x(i)} y={H - 6} fill="#71717a" fontSize="10" textAnchor="middle">{fmt(r.at)}</text>)}
      {engines.map((e) => { const pts = rows.map((r, i) => [x(i), r.byEngine[e]?.score] as const).filter((p) => p[1] != null) as [number, number][];
        return <g key={e}><path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ")} fill="none" stroke={COL[e] || "#fff"} strokeWidth="2.5" strokeDasharray={e === "gemini" ? "6 4" : undefined} strokeLinecap="round" />
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={y(p[1])} r="3.5" fill="#000" stroke={COL[e] || "#fff"} strokeWidth="2" />)}</g>; })}
    </svg>);
}

export default function DashInsights({ ins, lang, auth }: { ins?: Insights; lang: Locale; auth: { id: string; key: string } | null }) {
  const t = T[lang]; const [busy, setBusy] = useState(false); const [open, setOpen] = useState<number | null>(0);
  if (!ins || !ins.scanCount) return <p className="di-empty" data-dash-empty>{t.empty}</p>;
  const last = ins.engineTrend.at(-1)!; const engines = Object.keys(last.byEngine);
  async function csv() {
    if (!auth || !ins) return; setBusy(true);
    try { const r = await fetch(`/api/dashboard/${encodeURIComponent(auth.id)}/export.csv?businessId=${encodeURIComponent(ins.businessId)}`, { credentials: "same-origin", headers: auth.key ? { "x-dashboard-key": auth.key } : {} }); if (!r.ok) throw new Error(String(r.status));
      const u = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = u; a.download = `ranky-${ins.businessId}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); } catch { /* button stays usable */ } finally { setBusy(false); }
  }
  const delta = (c: QE["change"]) => c == null ? <span className="di-chip">{t.newQ}</span> : c.delta > 0 ? <span className="di-chip di-up">▲ {t.better}</span> : c.delta < 0 ? <span className="di-chip di-down">▼ {t.worse}</span> : <span className="di-chip">{t.same}</span>;
  return (
    <div className="di" data-insights>
      <section className="di-card" aria-labelledby={`tr-${ins.businessId}`}>
        <div className="di-head"><h3 id={`tr-${ins.businessId}`}>{t.trend}</h3><button type="button" onClick={csv} disabled={busy} className="btn-outline !py-1.5 !px-4 text-sm" data-csv>{busy ? t.csvBusy : t.csv}</button></div>
        <div className="di-eng">{engines.map((e) => { const r = last.byEngine[e]; return (
          <div key={e} className="di-stat"><span className="di-dot" style={{ background: COL[e] }} aria-hidden /> <b dir="ltr">{ENG[e] || e}</b>
            <span className={`di-num ${band(r.score)}`} dir="ltr">{r.score ?? "–"}</span>
            <span className="di-mut">{t.mention} <span dir="ltr">{Math.round(r.mentionRate * 100)}%</span> · {t.rank} <span dir="ltr">{r.avgRank ?? "–"}</span></span></div>); })}</div>
        {ins.engineTrend.length > 1 ? <EngineChart rows={ins.engineTrend} lang={lang} /> : <p className="di-mut mt-3">{t.trendOne}</p>}
      </section>

      <section className="di-card" aria-labelledby={`cp-${ins.businessId}`} data-competitors>
        <h3 id={`cp-${ins.businessId}`}>{t.comps}</h3><p className="di-mut">{t.compSub}</p>
        {ins.competitors.length ? <div className="di-tw"><table className="di-t"><thead><tr><th>#</th><th>{t.name}</th><th>{t.times}</th><th>{t.inScans}</th><th>{t.tr}</th></tr></thead><tbody>
          {ins.competitors.map((c, i) => <tr key={c.name}><td dir="ltr">{i + 1}</td><td><bdi>{c.name}</bdi></td><td dir="ltr">{c.total}</td><td dir="ltr">{c.scans}/{ins.scanCount}</td>
            <td dir="ltr" className="di-spark" aria-label={c.counts.join(", ")}>{c.counts.map((n, k) => <i key={k} style={{ height: `${Math.min(100, 12 + n * 12)}%` }} />)} <span className={c.trend > 0 ? "di-down" : c.trend < 0 ? "di-up" : "di-mut"}>{c.prev == null ? "" : c.trend > 0 ? "▲" : c.trend < 0 ? "▼" : "–"}</span></td></tr>)}
        </tbody></table></div> : <p className="di-mut mt-3">{t.noComps}</p>}
      </section>

      <section className="di-card" aria-labelledby={`qs-${ins.businessId}`} data-questions>
        <h3 id={`qs-${ins.businessId}`}>{t.qs}</h3><p className="di-mut">{t.qsSub}</p>
        {!ins.questions.length && <p className="di-mut mt-3">{t.noQs}</p>}
        <ul className="di-qs">{ins.questions.map((q, i) => (
          <li key={q.question} className="di-q">
            <button type="button" className="di-qb" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <bdi>{q.question}</bdi><span className="di-qm">{Object.entries(q.engines).map(([e, r]) => <span key={e} className={`di-chip ${r.error ? "" : r.mentioned ? "di-up" : "di-down"}`} dir="ltr">{ENG[e] || e} {r.error ? "!" : r.mentioned ? (r.rank ? `#${r.rank}` : "✓") : "✕"}</span>)}</span></button>
            {open === i && <div className="di-qa">{Object.entries(q.engines).map(([e, r]) => (
              <div key={e} className="di-ans"><div className="di-ah"><b dir="ltr">{ENG[e] || e}</b>
                {r.error ? <span className="di-chip">{t.err}</span> : <><span className={`di-chip ${r.mentioned ? "di-up" : "di-down"}`}>{r.mentioned ? t.yes : t.no}{r.mentioned && r.rank ? ` · ${t.rankN} ${r.rank}` : ""}</span><span className="di-mut text-xs">{t.since}:</span> {delta(r.change)}</>}</div>
                {r.excerpt && <p className="di-ex"><bdi>{r.excerpt}</bdi></p>}
                {!!r.competitors?.length && <p className="di-mut text-sm">{t.alsoNamed}: <bdi>{r.competitors.join(" · ")}</bdi></p>}</div>))}</div>}
          </li>))}</ul>
      </section>

      <section className="di-card" aria-labelledby={`sr-${ins.businessId}`} data-sources>
        <h3 id={`sr-${ins.businessId}`}>{t.src}</h3><p className="di-mut">{t.srcSub}</p>
        {ins.sources.length ? <ol className="di-src">{ins.sources.map((s) => (
          <li key={s.host}><div className="di-sh"><b dir="ltr">{s.host}</b><span className="di-mut text-sm"><span dir="ltr">{s.cited}</span> {t.cited} · <span dir="ltr">{s.missing}</span> {t.missing} · <span dir="ltr">{s.engines.map((e) => ENG[e] || e).join(", ")}</span></span></div>
            <p className="di-todo"><span className="di-chip di-blue">{t.todo}</span> {t.todoT(s.host)}</p></li>))}</ol> : <p className="di-mut mt-3">{t.noSrc}</p>}
      </section>
    </div>);
}
