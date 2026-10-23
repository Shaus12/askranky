// Legal documents: loaded from legal/*.md (Hebrew: *.he.md), placeholders substituted at request time, and rendered to HTML
// on the server so crawlers (and curl, no JS) get the full text. Whitelisted names only: COMPLIANCE-NOTES.md is internal
// and is never served (explicit 404). The markdown renderer is deliberately tiny and escapes everything: no raw HTML passes.
import fs from 'node:fs'; import path from 'node:path';
import { BRAND } from './brand.js'; import { esc } from './security/html.js';
export const LEGAL_DOCS = ['terms', 'privacy', 'refunds', 'disclaimer', 'accessibility'];
export const LEGAL_MARKER = '<!--LEGAL_BODY-->'; // emitted by web/components/LegalDoc.tsx into the exported page shell
const DIR = path.resolve('legal');
export function legalDoc(doc, lang) {
  if (!LEGAL_DOCS.includes(doc)) return null;
  const he = lang === 'he' && fs.existsSync(path.join(DIR, doc + '.he.md')); const f = path.join(DIR, doc + (he ? '.he.md' : '.md'));
  if (!fs.existsSync(f)) return null;
  const known = { BRAND: BRAND.name, DOMAIN: BRAND.domain, EMAIL: BRAND.supportEmail, ENTITY: he ? BRAND.legalEntityHe : BRAND.legalEntity, ENTITY_ID: BRAND.entityId,
    ADDRESS: he ? BRAND.addressHe : BRAND.address, DPO_NAME: he ? BRAND.legalEntityHe : BRAND.legalEntity, DPO_EMAIL: BRAND.privacyEmail,
    ACCESSIBILITY_COORDINATOR: he ? BRAND.legalEntityHe : BRAND.legalEntity, ACCESSIBILITY_EMAIL: BRAND.accessibilityEmail };
  return { lang: he ? 'he' : 'en', doc, markdown: fs.readFileSync(f, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => known[k] ?? process.env['LEGAL_' + k] ?? `[${k}]`) };
}
const safeHref = u => /^(https?:\/\/|mailto:|\/(?!\/))/i.test(u) ? u : null;
function inline(s) {
  const out = []; const stash = h => `\u0000${out.push(h) - 1}\u0000`;
  s = s.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${esc(c)}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => { const h = safeHref(url); return h ? stash(`<a href="${esc(h)}" rel="noopener">${esc(txt)}</a>`) : m; });
  s = esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => out[i]);
}
const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
export function renderMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n'); const html = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (!l.trim()) { i++; continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { html.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) { const b = []; while (i < lines.length && /^\s*>/.test(lines[i])) b.push(lines[i++].replace(/^\s*>\s?/, '')); html.push(`<blockquote>${b.map(inline).join('<br>')}</blockquote>`); continue; }
    if (/^\s*[-*]\s+/.test(l)) { const b = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/, ''))}</li>`); html.push(`<ul>${b.join('')}</ul>`); continue; }
    if (l.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const head = cells(l); i += 2; const rows = []; while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      html.push(`<div class="tbl"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*>|\s*[-*]\s+|\s*-{3,}\s*$)/.test(lines[i]) && !(lines[i].includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || ''))) p.push(inline(lines[i++]));
    html.push(`<p>${p.join('<br>')}</p>`);
  }
  return html.join('\n');
}
// Fills the marker in the exported Next page (web/out/{lang}/legal/{doc}.html) with the rendered document.
export function legalPageHtml(outDir, lang, doc) {
  const d = legalDoc(doc, lang); if (!d) return null;
  const f = path.join(outDir, lang, 'legal', doc + '.html'); if (!fs.existsSync(f)) return undefined;
  return fs.readFileSync(f, 'utf8').replace(LEGAL_MARKER, () => renderMarkdown(d.markdown));
}
