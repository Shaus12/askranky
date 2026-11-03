import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import ScanForm from "@/components/ScanForm";
import HomeSample from "@/components/HomeSample";
import { SAMPLE_COPY } from "@/lib/sample-copy";
import { LANDING_HE as c } from "@/lib/landing-he";
import "./landing-dark.css";

/** landing-redesign-dark: /he homepage only. Dark style scoped to `.lpd` (this file's CSS is imported only here), so no other page changes.
 *  Server-rendered; the only client pieces are the existing ScanForm (Turnstile, UTM, funnel `track` hooks) and HomeSample. Aurora is CSS-only. */
const Arrow = () => <span aria-hidden="true" className="lpd-arrow">←</span>;
export default function HeLanding({ t }: { t: Dict }) {
  const base = "/he";
  return (
    <div className="lpd" dir="rtl">
      <section className="lpd-hero" aria-labelledby="lpd-h1">
        <div className="lpd-aurora" aria-hidden="true" />
        <div className="lpd-wrap lpd-hero-in">
          <h1 id="lpd-h1" className="lpd-h1">{c.h1}</h1>
          <p className="lpd-sub">{c.sub.split("2–3").flatMap((x, i) => i ? [<span key={i} className="lpd-nw" dir="ltr">2–3</span>, x] : [x])}</p>
          <div className="lpd-acts">
            <Link href={`${base}/scan`} className="lpd-btn" data-cta="hero">{c.cta} <Arrow /></Link>
            <a href="#how" className="lpd-ghost">{c.how}</a>
          </div>
          <p className="lpd-note">{c.note}</p>
        </div>
      </section>

      <main className="lpd-main">
        <section id="data" className="lpd-sec scroll-mt-16" aria-labelledby="lpd-proof-t" data-proof>
          <div className="lpd-wrap">
            <p className="lpd-label" id="lpd-proof-t">{c.proofEy}</p>
            <ul className="lpd-proof">
              {c.proof.map((p) => (
                <li key={p.big} className="lpd-card">
                  <p className="lpd-big" dir="ltr">{p.big}</p>
                  <p className="lpd-ptext">{p.text}</p>
                  <p className="lpd-src">{c.sourceLabel}: <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" data-source>{p.src}</a></p>
                </li>))}
            </ul>
            <p className="lpd-fine">{c.proofNote}</p>
          </div>
        </section>

        <section className="lpd-sec" aria-labelledby="lpd-prob-t">
          <div className="lpd-wrap">
            <h2 id="lpd-prob-t" className="lpd-h2">{c.probT}</h2>
            <ol className="lpd-grid3">
              {c.prob.map((p, i) => (<li key={i} className="lpd-card"><span className="lpd-num" dir="ltr">{String(i + 1).padStart(2, "0")}</span><p className="lpd-ptext">{p}</p></li>))}
            </ol>
          </div>
        </section>

        <section id="how" className="lpd-sec scroll-mt-16" aria-labelledby="lpd-how-t">
          <div className="lpd-wrap">
            <h2 id="lpd-how-t" className="lpd-h2">{c.stepsT}</h2>
            <ol className="lpd-grid3">
              {c.steps.map(([b, r], i) => (<li key={i} className="lpd-card"><span className="lpd-num" dir="ltr">{i + 1}</span><p className="lpd-ptext"><b>{b}</b> {r}</p></li>))}
            </ol>
            <div className="lpd-card lpd-who"><h3 className="lpd-h3">{c.whoT}</h3><p className="lpd-ptext">{c.who}</p></div>
          </div>
        </section>

        <section id="sample" className="lpd-sec scroll-mt-16" aria-labelledby="home-sample-t">
          <div className="lpd-wrap"><h2 id="home-sample-t" className="lpd-h2">{SAMPLE_COPY.he.title}</h2><p className="lpd-lede">{SAMPLE_COPY.he.sub}</p>
            <div className="lpd-sample"><HomeSample lang="he" /></div></div>
        </section>

        <section id="scan-form" className="lpd-sec scroll-mt-20" aria-labelledby="lpd-form-t">
          <div className="lpd-wrap lpd-formgrid">
            <div>
              <h2 id="lpd-form-t" className="lpd-h2">{c.formT}</h2>
              <ul className="lpd-bullets">{c.formBullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <p className="lpd-note">{c.note}</p>
            </div>
            <div className="lpd-formbox"><ScanForm t={t} lang="he" /></div>
          </div>
        </section>

        <section id="pricing" className="lpd-sec scroll-mt-16" aria-labelledby="lpd-price-t">
          <div className="lpd-wrap">
            <h2 id="lpd-price-t" className="lpd-h2">{c.pricingT}</h2>
            <p className="lpd-lede">{c.pricingIntro}</p>
            <div className="lpd-card lpd-hl lpd-fixup" data-plan="fixup">
              <div><h3 className="lpd-h3">{c.fixup.name}</h3><p className="lpd-ptext">{c.fixup.body}</p>
                <p className="lpd-fine" data-fixup-guarantee>{c.fixup.refund} <Link href={`${base}/legal/refunds`}>{c.fixup.refundLink}</Link></p></div>
              <div className="lpd-fixup-r"><p className="lpd-price" dir="ltr">{c.fixup.price}</p><Link href={`${base}/checkout?plan=fixup`} className="lpd-btn">{c.fixup.cta}</Link></div>
            </div>
            <div className="lpd-grid3 lpd-plans">
              {c.plans.map((p) => (
                <div key={p.id} className={`lpd-card${p.id === "pro" ? " lpd-hl" : ""}`} data-plan={p.id}>
                  <h3 className="lpd-h3">{p.name} <span className="lpd-en" dir="ltr">{p.en}</span></h3>
                  <p className="lpd-price"><span dir="ltr">{p.price}</span><span className="lpd-mo">{c.mo}</span></p>
                  <ul className="lpd-feat">{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
                  <Link href={`${base}/checkout?plan=${p.id}`} className="lpd-ghost lpd-planbtn">{p.cta}</Link>
                </div>))}
            </div>
            <div className="lpd-card lpd-honest"><h3 className="lpd-h3">{c.honestT}</h3><p className="lpd-ptext">{c.honest}</p></div>
          </div>
        </section>

        <section id="faq" className="lpd-sec scroll-mt-16" aria-labelledby="lpd-faq-t">
          <div className="lpd-wrap lpd-narrow">
            <h2 id="lpd-faq-t" className="lpd-h2">{c.faqT}</h2>
            <div className="lpd-faq">{c.faq.map(([q, a]) => (
              <details key={q} className="lpd-card lpd-q"><summary>{q}<span aria-hidden="true" className="lpd-plus">+</span></summary><p className="lpd-ptext">{a}</p></details>))}</div>
          </div>
        </section>

        <section className="lpd-sec lpd-final" aria-labelledby="lpd-final-t">
          <div className="lpd-wrap lpd-narrow">
            <h2 id="lpd-final-t" className="lpd-h2">{c.finalT}</h2>
            <div className="lpd-acts lpd-center"><Link href={`${base}/scan`} className="lpd-btn">{c.cta} <Arrow /></Link></div>
            <p className="lpd-note">{c.note}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
