import { ANSWER_INSTRUCTION } from './prompt.js';
// ChatGPT proxy: OpenAI Responses API + web_search tool ($10/1k calls + tokens). Capped at 1 search per check.
export const openaiProvider = {
  id: 'chatgpt', label: 'ChatGPT',
  async ask(question) {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', instructions: ANSWER_INSTRUCTION, input: question, tools: [{ type: 'web_search' }], max_tool_calls: 1, max_output_tokens: 1200, reasoning: { effort: 'low' } }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j = await r.json();
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
