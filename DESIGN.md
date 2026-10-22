# Ranky design system (v2)
Brand: **Ranky** · askranky.com · tagline "Ask Ranky if AI recommends you." Configured in `src/brand.js` (backend) and the `Wordmark` component in `web/src/App.jsx`.

## Audience and goal
Local business owners (dentists, plumbers, lawyers, agencies): busy, skeptical of "marketing tools", and paying out of their own pocket. The design must say **trustworthy, clear, and here to help you grow**, not "hype AI startup".

## Palette and color psychology
| Token | Hex | Role | Why |
|---|---|---|---|
| Navy 950 / 900 / 800 | `#071331` / `#0B1B3F` / `#132A5C` | Hero, nav, report header, logo tile | Deep blue is the most widely associated color with **trust, stability and competence** (banks, insurance, B2B). It frames the product as a serious measurement tool. |
| Blue 700 | `#1D4ED8` | Links, step numbers, focus rings on inputs, spotlight hover | A brighter blue in the same family signals **clarity and intelligence** without competing with the CTA. |
| Blue 300 | `#93C5FD` | Eyebrows and secondary accents on dark | Soft, calm contrast on navy. |
| **Growth green 700** | `#047857` | **Primary CTAs**, "most popular" plan, fix numbers | Green means **go, growth and money**, exactly the promise ("climb the AI ranking"). This darker shade keeps white button text at **5.5:1** (AA). |
| Green 600 / 400 | `#059669` / `#34D399` | Score gauge (good), score gains ▲, bars, wordmark "y", logo's top bar | The same hue carries meaning: *green = you're winning*. 400 is used only on navy, at 9.9:1. |
| **Amber 700 / 500 / 50** | `#B45309` / `#F59E0B` / `#FFFBEB` | Mid scores (30–59), "Example" badges, mock-mode notice, usage cap ≥80% | Amber means **caution or attention without alarm**. It also clearly flags placeholder testimonials as examples, which is honest and builds trust. |
| **Red 700** | `#B91C1C` | Errors, scores <30 only | **Used sparingly.** Red on a business owner's own score causes anxiety and churn, so it is reserved for genuinely bad states and form errors. Competitor mentions are neutral, not red. |
| Ink / Slate 600 / Slate 300 | `#0F172A` / `#475569` / `#CBD5E1` | Text | Slate 600 on white is 7.6:1, and Slate 300 on navy is about 11:1. |
| Background / Line | `#F7F9FC` / `#E2E8F0` | Page, cards, borders | A cool off-white keeps the long reports calm and readable. |

**Score semantics (consistent everywhere):** ≥60 green · 30–59 amber · <30 red. The same rule drives the gauge, engine bars and pills.

## Logo / wordmark
- **Mark:** a navy rounded tile with three rising bars (light blue → blue → green) and a green "spark" on top. It reads as "climbing the rank, and getting picked".
- **Wordmark:** "Rank" in ink (or white on dark) plus **"y" in growth green**, so the name itself reads as *rank → yes*.

## Typography and layout
- **Type:** the system UI stack (Inter if installed), weight 800 for headlines with tight tracking, and an 18–19px lead. Large, plain-English copy for non-technical owners.
- **Layout:** 1160px container, 18px radius cards, soft layered shadows, generous 88px section rhythm.

## Motion (GSAP + ScrollTrigger + Lenis + React Bits)
- **Lenis smooth scrolling,** synced to the GSAP ticker and ScrollTrigger (`web/src/motion.js`).
- **Hero:**
  - React Bits **SplitText** (GSAP) word-rise on the headline.
  - React Bits **ShinyText** eyebrow with the tagline.
  - Parallax orbs (ScrollTrigger scrub).
  - An animated **score demo** (GSAP timeline): a question, the AI answer lines, a "you" highlight, engine chips, and a gauge counting to 72. It is clearly labelled *Example*.
- **Sections:** staggered fade-up reveals on scroll (`[data-reveal-group]`). Stats use React Bits **CountUp**, and step, plan, engine and CTA cards use React Bits **SpotlightCard** (cursor light).
- **Report:**
  - Animated semicircle **gauge** (GSAP tween of stroke-dashoffset plus the number).
  - CountUp mention rate.
  - Engine cards with mention bars.
  - Copy-to-clipboard fixes.
- **Dashboard:** score-history bars grow in (GSAP).

## Accessibility
- **Reduced motion:** `prefers-reduced-motion: reduce` disables Lenis and all GSAP reveals and parallax (`gsap.matchMedia`). The gauge and CountUp jump straight to their final values, and the React Bits components respect it internally. A CSS fallback kills remaining transitions.
- **Contrast:** all text pairs meet WCAG AA (see the table).
- **Not color alone:** score state is also given as a number, "▲/▼", or Yes/No text.
- **Structure:**
  - A skip link and visible focus rings (green on dark, blue on inputs).
  - Semantic landmarks and real `<label>`s.
  - `aria-label` on the gauge and bars, and `role="alert"` on errors.
  - Table headers with `scope`, and FAQ built on native `<details>`.
- **Responsive:** a single column below 900px.

## Files
- `web/src/styles.css`: tokens and all styles.
- `web/src/motion.js`: GSAP, ScrollTrigger and Lenis setup.
- `web/src/rb/`: React Bits components (SpotlightCard, CountUp, SplitText, ShinyText), copied from DavidHDev/react-bits (MIT + Commons Clause, so use is allowed but reselling the components themselves is not).
- `web/src/components/`: Gauge, ScoreDemo, PricingCards.
- `web/src/pages/`: Landing, Report, Pricing, Dashboard, Legal, MockCheckout.

> **Update 2026-10-21:** the React+Vite frontend described above was replaced by the Next.js UI in `web/` (see `README.md` → Architecture and `web/README.md`). File paths under `web/src/` above refer to the old frontend (backup: `../app.backup-20261021-1743/web`). Design principles (indigo trust colour, amber CTAs only, low score framed as opportunity, Lenis + GSAP) carry over.
