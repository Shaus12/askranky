"use client";
import { useEffect, useState } from "react";
import { getConfig } from "@/lib/api";
// Site-wide strip shown while the server runs in pre-launch / demo mode.
export default function DemoBanner({ lang }: { lang: "he" | "en" }) {
  const [on, setOn] = useState(false);
  useEffect(() => { getConfig().then((c) => setOn(!!c.prelaunch)); }, []);
  if (!on) return null;
  return <div role="note" data-demo-banner className="relative z-50 bg-[#e8b04b]/15 px-4 py-2 text-center text-xs text-amber-100">
    {lang === "he" ? "גרסת הדגמה לפני השקה: הסריקות מבוססות על נתוני דמו ולא נגבה תשלום." : "Pre-launch demo: scans use sample data and no payments are taken."}</div>;
}
