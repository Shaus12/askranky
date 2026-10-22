// Provider interface: each engine exports { id, label, ask(question, ctx) => {text, citations[], searches, usage} }
import { mockProvider } from './mock.js';
import { openaiProvider } from './openai.js';
import { geminiProvider } from './gemini.js';
import { perplexityProvider } from './perplexity.js';

export const ENGINES = ['chatgpt', 'gemini', 'perplexity'];
const REAL = { chatgpt: openaiProvider, gemini: geminiProvider, perplexity: perplexityProvider };
const KEY_ENV = { chatgpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', perplexity: 'PERPLEXITY_API_KEY' };

export function isMockMode() { return process.env.SCAN_MODE !== 'live'; }

// Live mode needs an explicit SCAN_MODE=live. Even then only engines in LIVE_ENGINES go live
// (default: chatgpt,gemini; Perplexity stays mock until approved).
export function liveEngines() { return (process.env.LIVE_ENGINES || 'chatgpt,gemini').split(',').map(s => s.trim()).filter(Boolean); }
export function getProvider(engine) {
  if (isMockMode() || !liveEngines().includes(engine) || !process.env[KEY_ENV[engine]]) return mockProvider(engine);
  return REAL[engine];
}
