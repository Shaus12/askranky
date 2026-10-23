"use client";
import { useEffect, useState } from "react";
import { getConfig } from "@/lib/api";
import { dict } from "@/lib/i18n";
import { demoNotices } from "@/lib/notices";
// Site-wide strip shown while the server runs in pre-launch mode (wording depends on whether scans are also demo data).
export default function DemoBanner({ lang }: { lang: "he" | "en" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { getConfig().then((c) => setText(demoNotices(c, dict(lang)).banner)); }, [lang]);
  if (!text) return null;
  return <div role="note" data-demo-banner className="relative z-50 bg-[#e8b04b]/15 px-4 py-2 text-center text-xs text-amber-100">
    {text}</div>;
}
