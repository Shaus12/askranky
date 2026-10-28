import { ANSWER_INSTRUCTION } from './prompt.js'; import { postJson, isModelMissing } from './http.js';
// ChatGPT proxy: OpenAI Responses API + web_search tool ($10/1k calls + tokens). Capped at 1 search per check.
export const openaiProvider = {
  id: 'chatgpt', label: 'ChatGPT',
  async ask(question) {
    const call = model => postJson('chatgpt', 'https://api.openai.com/v1/responses', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: { model, instructions: ANSWER_INSTRUCTION, input: question, tools: [{ type: 'web_search' }], max_tool_calls: 1, max_output_tokens: 1200, reasoning: { effort: 'low' } },
    });
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini'; const fallback = process.env.OPENAI_MODEL_FALLBACK || '';
    let j;
    try { j = await call(model); } catch (e) { if (!fallback || fallback === model || !isModelMissing(e)) throw e; console.warn(`[scan] openai model ${model} unavailable (${e.status}); using fallback ${fallback}`); j = await call(fallback); }
    let text = '', citations = [], searches = 0;
    for (const item of j.output || []) {
      if (item.type === 'web_search_call') searches++;
      if (item.type === 'message') for (const c of item.content || []) {
        if (c.text) text += c.text;
        for (const a of c.annotations || []) if (a.url) citations.push(a.url);
      }
    }
    return { text, citations: [...new Set(citations)], searches, usage: { input: j.usage?.input_tokens, output: j.usage?.output_tokens } };
  },
};
