// Perplexity proxy. Sonar Chat Completions was retired 2026-09-27; Agent API (Responses-style) is the replacement.
// VERIFY endpoint/model against https://docs.perplexity.ai before first live run. Overridable via env.
export const perplexityProvider = {
  id: 'perplexity', label: 'Perplexity',
  async ask(question) {
    const url = process.env.PERPLEXITY_URL || 'https://api.perplexity.ai/v1/responses';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      body: JSON.stringify({ model: process.env.PERPLEXITY_MODEL || 'sonar', input: question, tools: [{ type: 'web_search' }], max_tool_calls: 1 }),
    });
    if (!r.ok) throw new Error(`Perplexity ${r.status}: ${await r.text()}`);
    const j = await r.json();
    let text = j.output_text || '', citations = [...(j.citations || []), ...(j.search_results || []).map(s => s.url)], searches = 0;
    for (const item of j.output || []) {
      if (/search/.test(item.type || '')) searches++;
      for (const c of item.content || []) { if (c.text && !j.output_text) text += c.text; for (const a of c.annotations || []) if (a.url) citations.push(a.url); }
    }
    return { text, citations: [...new Set(citations.filter(Boolean))], searches, usage: { input: j.usage?.input_tokens, output: j.usage?.output_tokens } };
  },
};
