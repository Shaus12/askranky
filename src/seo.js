// robots.txt + sitemap.xml for https://askranky.com (SITE_URL overrides). A named User-agent group replaces `*` for that
// bot, so every group repeats the full Disallow list (see business/seo/technical-seo-checklist.md §5).
export const SITE = () => (process.env.SITE_URL || 'https://askranky.com').replace(/\/$/, '');
// ONE method per path, so a crawler can always read the directive that applies:
//  * HTML pages that must not be indexed (dashboard, login, checkout, /r/:id scan results, /billing/*, /auth/* magic links,
//    /mock-checkout, /unsubscribe): crawling is ALLOWED and they carry `noindex, nofollow` (X-Robots-Tag header from server.js via
//    NOINDEX_PATH, plus <meta name="robots"> in the static pages listed in web/lib/seo.ts PRIVATE). The /{lang}/r/:id shell is the
//    same export as the indexable sample /{lang}/report, so for scan results the header is the only signal.
//  * Non-HTML endpoints that never were indexable: /api/ (JSON) and /webhooks/ (POST callbacks): Disallow, and no noindex.
//  * The sample report /{lang}/report, /scan, legal docs and the home page are public and indexable.
export const DISALLOW = ['/api/', '/webhooks/'];
export const NOINDEX_PATH = /^\/(?:(?:he|en)\/)?(?:dashboard|login|signup|reset|verify|account|checkout|billing|auth|mock-checkout|unsubscribe|r)(?:\/|$)/;
export const BOTS = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Applebot-Extended', 'Bingbot'];
export const robotsTxt = () => BOTS.map(b => [`User-agent: ${b}`, 'Allow: /', ...DISALLOW.map(d => `Disallow: ${d}`)].join('\n')).join('\n\n') + `\n\nSitemap: ${SITE()}/sitemap.xml\n`;
// Legal docs have their own server-rendered, self-canonical URLs (/{lang}/legal/{doc}); the old ?doc= URLs 301 to them and are not listed.
import { LEGAL_DOCS } from './legal.js'; import { blogPosts } from './blog.js';
// '/blog' is a true he<->en pair (an index in each language). Articles are NOT translations of each other (HE and EN articles differ), so each
// article is listed once with its own self-canonical URL and no hreflang alternates (see blogPosts()).
// The sample report /{lang}/report is NOT listed: it is client-rendered (the same export serves /r/:id), so crawlers only get "Loading report…".
export const SITEMAP_PAGES = ['', '/scan', '/legal', '/blog', ...LEGAL_DOCS.map(d => `/legal/${d}`)];
const x = s => s.replace(/&/g, '&amp;');
export function sitemapXml() {
  const u = (l, p) => x(`${SITE()}/${l}${p}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    SITEMAP_PAGES.flatMap(p => ['he', 'en'].map(l => `  <url><loc>${u(l, p)}</loc>` +
      `<xhtml:link rel="alternate" hreflang="he" href="${u('he', p)}"/><xhtml:link rel="alternate" hreflang="en" href="${u('en', p)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${x(SITE() + (p ? '/en' + p : '/'))}"/>` +
      `<changefreq>weekly</changefreq><priority>${p ? '0.6' : '1.0'}</priority></url>`)).join('\n') + '\n' +
    blogPosts().map(b => `  <url><loc>${x(SITE() + b.path)}</loc><lastmod>${b.updated}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n') + '\n</urlset>\n';
}
// llms.txt (seo-audit #4): plain summary + key pages for AI crawlers.
const LEGAL_TITLES = { terms: 'Terms of Service', privacy: 'Privacy Policy', refunds: 'Refund and Cancellation Policy', disclaimer: 'AI Results Disclaimer', accessibility: 'Accessibility Statement', cookies: 'Cookie and Local Storage Policy' };
export const llmsTxt = () => `# Ranky
> Ranky (askranky.com) checks whether ChatGPT and Gemini recommend a local business, shows who gets named instead and which sources are cited, and suggests 3 fixes. Free first scan. Markets: US (English) and Israel (Hebrew).

## Pages
- [Home (EN)](${SITE()}/en)
- [Home (HE)](${SITE()}/he)
- [Free scan](${SITE()}/en/scan)
- [Blog (EN)](${SITE()}/en/blog)
- [Blog (HE)](${SITE()}/he/blog)
${blogPosts().map(b => `- [${b.title}](${SITE()}${b.path})`).join('\n')}
- [Legal documents](${SITE()}/en/legal)
${LEGAL_DOCS.flatMap(d => [['en', 'EN'], ['he', 'HE']].map(([l, L]) => `- [${LEGAL_TITLES[d]} (${L})](${SITE()}/${l}/legal/${d})`)).join('\n')}
`;
