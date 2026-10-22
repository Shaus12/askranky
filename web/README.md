# Ranky web UI (Next.js 15 App Router + TS + Tailwind 4)
Part of the single Ranky app: built as a static export (`npm run build` → `out/`) and served by `../server.js`, which also serves the API. See `../README.md` → Architecture.
    npm install && npm run build        # from app/: npm run build
    npm run dev                         # :3001, proxies /api /auth /billing to Express on :3000 (API_URL)
Pages: /he, /en · /:lang/scan · /:lang/r/:id (real report) · /:lang/report (sample) · /:lang/login · /:lang/dashboard/:id · /:lang/checkout · /:lang/legal
Motion: Lenis (components/SmoothScroll), GSAP ScrollTrigger (Reveal, Bars, TrendChart, CountUp), ScoreGauge, BlurText. Disabled under prefers-reduced-motion.
API client: lib/api.ts · copy: lib/i18n.ts · sample report: lib/mock.ts · cities: lib/cities.ts (generated from ../src/cities.js)
