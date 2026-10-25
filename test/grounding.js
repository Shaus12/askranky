// Gemini grounding: search instruction sent with google_search tool; grounded flag per check; summary counts ungrounded checks.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; useTempData('grd');
for (const k of ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'PERPLEXITY_API_KEY', 'DAILY_SPEND_CAP_USD']) delete process.env[k];
process.env.GEMINI_RESOLVE_REDIRECTS = '0';
const { geminiProvider } = await import('../src/providers/gemini.js'); const { summarizeResults } = await import('../src/summary.js');
let body; let grounded = true;
globalThis.fetch = async (u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '1. **A**' }] }, ...(grounded ? { groundingMetadata: { webSearchQueries: ['q1', 'q2'], groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'a.com' } }] } } : {}) }] }) }; };
let a = await geminiProvider.ask('best dentist?');
assert.deepEqual(body.tools, [{ google_search: {} }]); assert.match(body.systemInstruction.parts[0].text, /always run a Google Search/);
assert.equal(a.searches, 2); assert.equal(a.grounded, true); assert.deepEqual(a.citations, [{ url: 'https://vertexaisearch.cloud.google.com/x', host: 'a.com' }]);
grounded = false; a = await geminiProvider.ask('best dentist?'); assert.equal(a.searches, 0); assert.equal(a.grounded, false); assert.deepEqual(a.citations, []);
const r = (g) => ({ engine: 'gemini', mentioned: false, competitors: [], citations: [], grounded: g });
const s = summarizeResults([r(true), r(false), r(false), { engine: 'chatgpt', mentioned: false, competitors: [], citations: [] }], { plan: { competitors: 5 }, engines: ['chatgpt', 'gemini'], skipped: [], cost: 0 });
assert.equal(s.ungroundedChecks, 2);
const s2 = summarizeResults([r(true)], { plan: { competitors: 5 }, engines: ['gemini'], skipped: [], cost: 0 }); assert.ok(!('ungroundedChecks' in s2));
console.log('  ✓ gemini: google_search tool + search instruction, grounded flag, summary.ungroundedChecks');
