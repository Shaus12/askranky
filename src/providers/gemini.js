// Google AI proxy: Gemini Flash + Google Search grounding (5k free/mo, then $14/1k search queries).
export const geminiProvider = {
  id: 'gemini', label: 'Gemini',
  async ask(question) {
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: question }] }], tools: [{ google_search: {} }] }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const cand = j.candidates?.[0] || {};
    const text = (cand.content?.parts || []).map(p => p.text || '').join('');
    const gm = cand.groundingMetadata || {};
    const citations = (gm.groundingChunks || []).map(c => c.web?.uri).filter(Boolean);
    return { text, citations: [...new Set(citations)], searches: (gm.webSearchQueries || []).length, usage: { input: j.usageMetadata?.promptTokenCount, output: j.usageMetadata?.candidatesTokenCount } };
  },
};
