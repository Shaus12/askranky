// Instruction sent with every buyer-intent question to the live engines (OpenAI `instructions`, Gemini `systemInstruction`).
// Real engines otherwise often reply with a clarifying question ("what exactly are you looking for?") instead of
// naming businesses, which makes the scan useless. A few extra input tokens only: no extra calls, cost estimates unchanged.
export const ANSWER_INSTRUCTION = [
  'You answer a consumer question about local businesses in Israel.',
  'Answer directly and immediately. Never ask clarifying questions and never end with a question or an offer to search more; make reasonable assumptions instead.',
  'Name 5 to 8 concrete, real businesses by their proper business names, as a numbered list with one business per line, the business name first (in bold) and a short reason after it.',
  'Do not list categories, styles, price ranges, streets or tips as list items.',
  'Reply in the same language as the question.',
].join(' ');

// Gemini 3 decides per prompt whether to call Google Search; with only ANSWER_INSTRUCTION ("answer directly and immediately")
// it searched in ~2 of 50 Hebrew/US checks (day-1 + Ritz scans) vs 3 of 5 before the instruction existed. Ask it to search first.
export const GEMINI_SEARCH_INSTRUCTION = 'Before answering, always run a Google Search for current, real, open businesses matching the question and base your list on the search results.';
