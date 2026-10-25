import { ANSWER_INSTRUCTION, GEMINI_SEARCH_INSTRUCTION } from './prompt.js';
// Google AI proxy: Gemini Flash + Google Search grounding (5k free/mo, then $14/1k search queries).
const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const isRedirect = u => { try { return new URL(u).hostname === 'vertexaisearch.cloud.google.com'; } catch { return false; } };
// Grounding links are vertexaisearch.cloud.google.com redirects; groundingChunks[].web.title is usually the real site's domain.
// Without a domain title, try a short HEAD (no body, no redirect-follow) to read the real URL; any failure keeps the redirect link.
async function resolveRedirect(uri, timeoutMs = 3000) {
  try { const r = await fetch(uri, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) }); const loc = r.headers?.get?.('location'); return loc && /^https?:\/\//i.test(loc) && !isRedirect(loc) ? loc : null; } catch { return null; }
}
export async function groundingCitations(chunks, { resolve = process.env.GEMINI_RESOLVE_REDIRECTS !== '0' } = {}) {
  const seen = new Set(); const items = [];
  for (const c of chunks || []) { const uri = c.web?.uri; if (!uri || seen.has(uri)) continue; seen.add(uri); items.push({ uri, title: String(c.web?.title || '').trim() }); }
  return Promise.all(items.slice(0, 10).map(async ({ uri, title }) => {
    if (!isRedirect(uri)) return uri;
    const host = title.toLowerCase().replace(/^www\./, '');
    if (DOMAIN.test(host)) return { url: uri, host };
    const real = resolve ? await resolveRedirect(uri) : null;
    return real || uri;
  }));
}
export const geminiProvider = {
  id: 'gemini', label: 'Gemini',
  async ask(question) {
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: ANSWER_INSTRUCTION + ' ' + GEMINI_SEARCH_INSTRUCTION }] }, contents: [{ parts: [{ text: question }] }], tools: [{ google_search: {} }] }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const cand = j.candidates?.[0] || {};
    const text = (cand.content?.parts || []).map(p => p.text || '').join('');
    const gm = cand.groundingMetadata || {};
    const citations = await groundingCitations(gm.groundingChunks);
    // grounded = Google Search actually ran (queries or grounding chunks/supports returned); otherwise the answer is from model memory.
    const searches = (gm.webSearchQueries || []).length;
    const grounded = searches > 0 || (gm.groundingChunks || []).length > 0 || (gm.groundingSupports || []).length > 0;
    return { text, citations, searches, grounded, usage: { input: j.usageMetadata?.promptTokenCount, output: j.usageMetadata?.candidatesTokenCount } };
  },
};
