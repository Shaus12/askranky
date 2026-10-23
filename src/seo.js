// robots.txt + sitemap.xml for https://askranky.com (SITE_URL overrides). A named User-agent group replaces `*` for that
// bot, so every group repeats the full Disallow list (see business/seo/technical-seo-checklist.md §5).
export const SITE = () => (process.env.SITE_URL || 'https://askranky.com').replace(/\/$/, '');
export const DISALLOW = ['/app', '/api/', '/billing/', '/report', '/r/', '/dashboard', '/auth/', '/he/r/', '/en/r/', '/he/dashboard', '/en/dashboard', '/he/checkout', '/en/checkout', '/mock-checkout', '/webhooks/'];
export const BOTS = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Applebot-Extended', 'Bingbot'];
export const robotsTxt = () => BOTS.map(b => [`User-agent: ${b}`, 'Allow: /', ...DISALLOW.map(d => `Disallow: ${d}`)].join('\n')).join('\n\n') + `\n\nSitemap: ${SITE()}/sitemap.xml\n`;
// Legal docs have their own server-rendered, self-canonical URLs (/{lang}/legal/{doc}); the old ?doc= URLs 301 to them and are not listed.
import { LEGAL_DOCS } from './legal.js';
export const SITEMAP_PAGES = ['', '/scan', '/report', '/legal', ...LEGAL_DOCS.map(d => `/legal/${d}`)];
const x = s => s.replace(/&/g, '&amp;');
export function sitemapXml() {
  const u = (l, p) => x(`${SITE()}/${l}${p}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    SITEMAP_PAGES.flatMap(p => ['he', 'en'].map(l => `  <url><loc>${u(l, p)}</loc>` +
      `<xhtml:link rel="alternate" hreflang="he" href="${u('he', p)}"/><xhtml:link rel="alternate" hreflang="en" href="${u('en', p)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${x(SITE() + (p ? '/en' + p : '/'))}"/>` +
      `<changefreq>weekly</changefreq><priority>${p ? '0.6' : '1.0'}</priority></url>`)).join('\n') + '\n</urlset>\n';
}
// llms.txt (seo-audit #4): plain summary + key pages for AI crawlers.
const LEGAL_TITLES = { terms: 'Terms of Service', privacy: 'Privacy Policy', refunds: 'Refund and Cancellation Policy', disclaimer: 'AI Results Disclaimer', accessibility: 'Accessibility Statement' };
export const llmsTxt = () => `# Ranky
> Ranky (askranky.com) checks whether ChatGPT, Perplexity and Google's AI recommend a local business, shows who gets named instead and which sources are cited, and suggests 3 fixes. Free first scan. Markets: US (English) and Israel (Hebrew).

## Pages
- [Home (EN)](${SITE()}/en)
- [Home (HE)](${SITE()}/he)
- [Free scan](${SITE()}/en/scan)
- [Sample report](${SITE()}/en/report)
- [Legal documents](${SITE()}/en/legal)
${LEGAL_DOCS.flatMap(d => [['en', 'EN'], ['he', 'HE']].map(([l, L]) => `- [${LEGAL_TITLES[d]} (${L})](${SITE()}/${l}/legal/${d})`)).join('\n')}
`;
