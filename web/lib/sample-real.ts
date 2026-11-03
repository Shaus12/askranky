import type { Locale } from "@/lib/i18n";
// home-sample (trade1 C): the sample report above the home scan form. It must come from a REAL past Ranky scan, anonymized
// (neutral labels for the business and every competitor, no URLs, no excluded categories). Generate it with scripts/anonymize-sample.mjs from a
// stored scan JSON. As of 2026-11-03 no usable real scan exists on the box: the only stored live scans are in a category excluded by product
// rule) and the rest are mock. So REAL_SAMPLE is null and the component shows a numberless placeholder structure, labelled as such.
export type RealSample = { lang: Locale; trade: string; city: string; at: string; score: number; checks: number; engines: string[];
  named: { label: string; count: number }[]; qa: { question: string; engine: string; excerpt: string; mentioned: boolean }[] };
export const REAL_SAMPLE: Record<Locale, RealSample | null> = { he: null, en: null };
