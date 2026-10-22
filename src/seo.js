// robots.txt + sitemap.xml for https://askranky.com (SITE_URL overrides). A named User-agent group replaces `*` for that
// bot, so every group repeats the full Disallow list (see business/seo/technical-seo-checklist.md §5).
export const SITE = () => (process.env.SITE_URL || 'https://askranky.com').replace(/\/$/, '');
export const DISALLOW = ['/app', '/api/', '/billing/', '/report', '/r/', '/dashboard', '/auth/', '/he/r/', '/en/r/', '/he/dashboard', '/en/dashboard', '/he/checkout', '/en/checkout', '/mock-checkout', '/webhooks/'];
export const BOTS = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Applebot-Extended', 'Bingbot'];
export const robotsTxt = () => BOTS.map(b => [`User-agent: ${b}`, 'Allow: /', ...DISALLOW.map(d => `Disallow: ${d}`)].join('\n')).join('\n\n') + `\n\nSitemap: ${SITE()}/sitemap.xml\n`;
export const SITEMAP_PAGES = ['', '/scan', '/report', ...['terms', 'privacy', 'refunds', 'disclaimer', 'accessibility'].map(d => `/legal?doc=${d}`)];
const x = s => s.replace(/&/g, '&amp;');
export function sitemapXml() {
  const u = (l, p) => x(`${SITE()}/${l}${p}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    SITEMAP_PAGES.flatMap(p => ['he', 'en'].map(l => `  <url><loc>${u(l, p)}</loc>` +
      `<xhtml:link rel="alternate" hreflang="he" href="${u('he', p)}"/><xhtml:link rel="alternate" hreflang="en" href="${u('en', p)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${x(SITE() + (p ? '/he' + p : ''))}"/>` +
      `<changefreq>weekly</changefreq><priority>${p ? '0.6' : '1.0'}</priority></url>`)).join('\n') + '\n</urlset>\n';
}
