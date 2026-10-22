"use client";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
// Renders app/legal/*.md (served by /api/legal/:doc) as plain pre-wrapped text; no HTML injection path.
export default function Legal({ t, lang }: { t: Dict; lang: Locale }) {
  const [md, setMd] = useState("");
  useEffect(() => { const doc = new URLSearchParams(location.search).get("doc") || location.pathname.split("/").filter(Boolean)[2] || "terms"; api(`/api/legal/${encodeURIComponent(doc)}?lang=${lang}`).then((j) => setMd(j.markdown)).catch(() => setMd("Not found")); }, [lang]);
  return <main className="mx-auto max-w-3xl px-4 py-12"><article dir={lang === "he" ? "rtl" : "ltr"} className="card whitespace-pre-wrap p-8 text-start text-slate-800">{md || t.live.loading}</article></main>;
}
