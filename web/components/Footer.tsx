import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { consentText } from "@/lib/i18n-consent";
import CookieSettingsLink from "./CookieSettingsLink";
import Logo from "./Logo";
import LangLink from "./LangLink";
import { SHELL } from "@/lib/shell";
import { postsFor } from "@/lib/blog";
import "./shell.css";
/** Site footer (redesign stage 1): brand + columns (product, resources, company, legal), then the API disclaimer and the legally required seller line. */
export default function Footer({ t, lang = "en" }: { t: Dict; lang?: Locale }) {
  const base = `/${lang}`; const s = SHELL[lang]; const other = lang === "en" ? "he" : "en";
  const L = (doc: string, label: string) => <a href={`${base}/legal/${doc}`}>{label}</a>;
  const posts = postsFor(lang).slice(0, 2);
  return (
    <footer className="rk-foot text-sm">
      <div className="rk-foot-in">
        <div className="rk-fcols">
          <div className="rk-fbrand"><Link href={base} aria-label={t.brand}><Logo brand={t.brand} /></Link><p>{s.tagline}</p></div>
          <nav aria-label="footer"><h5>{s.product}</h5><Link href={`${base}#how`}>{t.nav.how}</Link><Link href={`${base}#sample`}>{t.nav.sample}</Link><Link href={`${base}#faq`}>{t.nav.faq}</Link><Link href={`${base}/scan`}>{t.nav.cta}</Link></nav>
          <div><h5>{s.resources}</h5><Link href={`${base}/blog`}>{t.footer.blog}</Link>{posts.map((p) => <a key={p.slug} href={p.path}>{p.title}</a>)}</div>
          <div><h5>{s.company}</h5><Link href={`${base}/pricing`}>{t.nav.pricing}</Link><Link href={`${base}/login`}>{t.login.nav}</Link><LangLink to={other} hrefTo={`/${other}`}>{other === "he" ? "עברית" : "English"}</LangLink><a href="mailto:shaysho1111@gmail.com">{s.contact}</a></div>
          <div><h5>{s.legal}</h5>{L("terms", t.footer.terms)}{L("privacy", t.footer.privacy)}{L("refunds", t.footer.refunds)}{L("disclaimer", t.footer.aiDisclaimer)}{L("accessibility", t.footer.accessibility)}{L("cookies", consentText[lang].footerPolicy)}<CookieSettingsLink lang={lang} /></div>
        </div>
        <div className="rk-fbot">
          <p>{t.footer.disclaimer}</p>
          <p className="text-xs" data-seller>{t.footer.seller}</p>
          <p className="text-xs">© 2026 {t.brand} · <span dir="ltr">askranky.com</span></p>
        </div>
      </div>
    </footer>
  );
}
