// Blog: markdown articles in content/blog/{lang}/{slug}.md, rendered on the server (no JS needed) into the exported Next page shell
// web/out/{lang}/blog/{slug}.html, the same marker pattern as the legal documents (src/legal.js). Everything is escaped: no raw HTML
// passes, only http(s)/mailto/relative links. Absolute links to our own domain are made relative so every internal link is crawlable
// on any host (and testable locally). The index + metadata + Article JSON-LD come from the same front matter at build time
// (web/lib/blog.ts reads the same files), so there is a single source of truth.
import fs from 'node:fs'; import path from 'node:path';
import { inline } from './legal.js';
export const BLOG_MARKER = '<!--BLOG_BODY-->';
const DIR = path.resolve('content/blog'); const LANGS = ['he', 'en'];
export function parseFrontMatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw.replace(/\r/g, '')); if (!m) return { meta: {}, body: raw };
  const meta = {}; for (const l of m[1].split('\n')) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) meta[k[1]] = k[2].replace(/^"(.*)"$/, '$1'); }
  return { meta, body: raw.replace(/\r/g, '').slice(m[0].length) };
}
let cache;
// [{ lang, slug, path, title, metaTitle, metaDescription, published, updated, body }] sorted newest first.
export function blogPosts() {
  if (cache) return cache; const out = [];
  for (const lang of LANGS) { const d = path.join(DIR, lang); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => /^[a-z0-9-]+\.md$/.test(f))) {
      const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(d, f), 'utf8')); const slug = f.replace(/\.md$/, '');
      if (meta.lang !== lang || !meta.title || !meta.meta_title || !meta.meta_description || meta.slug !== `/${lang}/blog/${slug}`) throw new Error(`blog front matter invalid: ${lang}/${f}`);
      out.push({ lang, slug, path: meta.slug, title: meta.title, metaTitle: meta.meta_title, metaDescription: meta.meta_description, published: meta.published || meta.updated, updated: meta.updated || meta.published, body });
    } }
  return (cache = out.sort((a, b) => (b.published || '').localeCompare(a.published || '') || a.slug.localeCompare(b.slug)));
}
export const blogPost = (lang, slug) => blogPosts().find(p => p.lang === lang && p.slug === slug) || null;
const SELF = /^https?:\/\/(?:www\.)?askranky\.com(?=\/|$)/i;
const local = html => html.replace(/href="([^"]+)"/g, (m, h) => `href="${SELF.test(h.replace(/&amp;/g, '&')) ? h.replace(SELF, '') || '/' : h}"`);
export function renderBlogMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n'); const html = []; let i = 0; const I = s => local(inline(s));
  const BLOCK = /^(#{1,4}\s|\s*>|\s*[-*]\s+|\s*\d+\.\s+|\s*-{3,}\s*$)/;
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (!l.trim()) { i++; continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { html.push(`<h${m[1].length}>${I(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { html.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) { const b = []; while (i < lines.length && /^\s*>/.test(lines[i])) b.push(lines[i++].replace(/^\s*>\s?/, '')); html.push(`<blockquote>${b.map(I).join('<br>')}</blockquote>`); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { const b = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) b.push(`<li>${I(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`); html.push(`<ol>${b.join('')}</ol>`); continue; }
    if (/^\s*[-*]\s+/.test(l)) { const b = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { const t = lines[i++].replace(/^\s*[-*]\s+/, ''); b.push(/^\[[ xX]\]\s/.test(t) ? `<li class="chk"><span aria-hidden="true">☐</span> ${I(t.replace(/^\[[ xX]\]\s/, ''))}</li>` : `<li>${I(t)}</li>`); } html.push(`<ul>${b.join('')}</ul>`); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !BLOCK.test(lines[i])) p.push(I(lines[i++]));
    html.push(`<p>${p.join('<br>')}</p>`);
  }
  return html.join('\n');
}
// Fills the marker in web/out/{lang}/blog/{slug}.html. null = unknown article, undefined = frontend not built.
export function blogPageHtml(outDir, lang, slug) {
  const p = blogPost(lang, slug); if (!p) return null;
  const f = path.join(outDir, lang, 'blog', slug + '.html'); if (!fs.existsSync(f)) return undefined;
  return fs.readFileSync(f, 'utf8').replace(BLOG_MARKER, () => renderBlogMarkdown(p.body));
}
