// Blog posts are filled in by the server per request (src/blog.js), so post links are plain <a> (full load), never next/link (no RSC prefetch of a .txt that does not exist).
import Link from "next/link";
import LangLink from "@/components/LangLink";
import Logo from "@/components/Logo";
import NavCloser from "@/components/NavCloser";
import AccountMenu from "@/components/AccountMenu";
import type { Dict, Locale } from "@/lib/i18n";
import { SHELL } from "@/lib/shell";
import { postsFor } from "@/lib/blog";
import "./shell.css";

const Chev = () => (<svg className="rk-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.4" /></svg>);

/** Site header (redesign stage 1): logo, Product / Resources menus (native <details>, server-rendered links), Pricing, language, sign-in, free-scan CTA.
 *  Below 960px the menus collapse into one "Menu" panel. All links target existing pages/sections only. */
export default function Nav({ t, lang, path = "" }: { t: Dict; lang: Locale; path?: string; dark?: boolean }) {
  const other = lang === "en" ? "he" : "en"; const base = `/${lang}`; const s = SHELL[lang];
  const posts = postsFor(lang).slice(0, 3);
  const product = [
    { href: `${base}#how`, b: t.nav.how, d: s.howD },
    { href: `${base}#sample`, b: t.nav.sample, d: s.sampleD },
    { href: `${base}#faq`, b: t.nav.faq, d: s.faqD },
  ];
  const lang2 = <LangLink to={other} hrefTo={`/${other}${path}`} hard={path.startsWith("/legal/")} className="rk-navlink">{other === "he" ? "עברית" : "English"}</LangLink>;
  const productMenu = (<div className="rk-mega">
    <div><h6>{s.product}</h6>{product.map((p) => <Link key={p.href} className="rk-mlink" href={p.href}><b>{p.b}</b><span>{p.d}</span></Link>)}</div>
    <Link className="rk-mfeat" href={`${base}/scan`}><b>{s.feat}</b><span>{s.featD}</span></Link>
  </div>);
  const resMenu = (<div className="rk-mega">
    <div><h6>{s.latest}</h6>{posts.map((p) => <a key={p.slug} className="rk-mlink" href={p.path}><b>{p.title}</b></a>)}</div>
    <div><h6>{s.blog}</h6><Link className="rk-mlink" href={`${base}/blog`}><b>{s.allPosts}</b></Link></div>
  </div>);
  return (
    <header className="rk-nav text-white">
      <NavCloser />
      <div className="rk-nav-in">
        <Link href={base} className="rk-brand" aria-label={t.brand}><Logo brand={t.brand} /></Link>
        <nav aria-label="primary" className="rk-menu">
          <details data-rk-menu className="rk-mi"><summary>{s.product}<Chev /></summary>{productMenu}</details>
          <details data-rk-menu className="rk-mi"><summary>{s.resources}<Chev /></summary>{resMenu}</details>
          <Link className="rk-navlink" href={`${base}/pricing`}>{t.nav.pricing}</Link>
        </nav>
        <div className="rk-navr">
          <span className="rk-desk">{lang2}</span>
          <AccountMenu lang={lang} label={t.login.nav} />
          <Link href={`${base}/scan`} className="rk-cta">{t.nav.cta}</Link>
          <details data-rk-menu className="rk-burger"><summary aria-label={s.menu}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></summary>
            <div className="rk-mobile-panel">
              <h6>{s.product}</h6>{product.map((p) => <Link key={p.href} href={p.href}>{p.b}</Link>)}<Link href={`${base}/scan`}>{t.nav.cta}</Link>
              <h6>{s.resources}</h6>{posts.map((p) => <a key={p.slug} href={p.path}>{p.title}</a>)}<Link href={`${base}/blog`}>{s.allPosts}</Link>
              <h6>{s.company}</h6><Link href={`${base}/pricing`}>{t.nav.pricing}</Link><AccountMenu lang={lang} label={t.login.nav} mobile />{lang2}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
