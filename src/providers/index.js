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
// Per-engine status. Mock scan mode: every engine is mock. Live scan mode: an engine runs only if it is in LIVE_ENGINES and has its
// API key; otherwise it is SKIPPED (never silently replaced by mock data, so mock results can never end up in a live score).
export function engineStatus(engine) {
  if (isMockMode()) return { engine, live: false, mock: true };
  if (!liveEngines().includes(engine)) return { engine, live: false, skipped: true, reason: 'not_enabled' };
  if (!process.env[KEY_ENV[engine]]) return { engine, live: false, skipped: true, reason: 'missing_key' };
  return { engine, live: true };
}
// Returns null for a skipped engine in live mode.
export function getProvider(engine) {
  const st = engineStatus(engine);
  return st.mock ? mockProvider(engine) : st.live ? REAL[engine] : null;
}
