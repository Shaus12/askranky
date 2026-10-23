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
