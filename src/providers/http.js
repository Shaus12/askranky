// Shared HTTP helper for live engines: per-call timeout (SCAN_CALL_TIMEOUT_MS, default 25s) and typed, sanitized errors.
// Errors never carry keys, headers or the prompt: only engine, HTTP status and a short scrubbed snippet of the provider's reply.
export const callTimeoutMs = () => { const n = Number(process.env.SCAN_CALL_TIMEOUT_MS); return Number.isFinite(n) && n > 0 ? n : 25000; };
export const sanitize = (s, max = 160) => String(s ?? '').replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]').replace(/(?:sk|AIza|pplx|key|Bearer)[-_A-Za-z0-9]{6,}/g, '[key]')
  .replace(/https?:\/\/\S+/gi, '[url]').replace(/[A-Za-z0-9_\-+/=]{24,}/g, '[token]').replace(/\s+/g, ' ').trim().slice(0, max);
export class ProviderError extends Error {
  constructor(engine, { status = null, kind = 'http', detail = '' } = {}) {
    super(`${engine} ${kind === 'timeout' ? 'timeout' : status ?? kind}: ${sanitize(detail)}`.trim()); this.name = 'ProviderError';
    this.engine = engine; this.status = status; this.kind = kind; this.code = kind === 'timeout' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR';
  }
}
export async function postJson(engine, url, { headers, body }, timeoutMs = callTimeoutMs()) {
  let r;
  try { r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) }); }
  catch (e) { const to = e?.name === 'TimeoutError' || e?.name === 'AbortError'; throw new ProviderError(engine, { kind: to ? 'timeout' : 'network', detail: to ? `no reply in ${timeoutMs}ms` : e?.message }); }
  if (!r.ok) { let t = ''; try { t = await r.text(); } catch {} throw new ProviderError(engine, { status: r.status, detail: t }); }
  try { return await r.json(); } catch (e) { throw new ProviderError(engine, { kind: 'bad_json', detail: e?.message }); }
}
// Model retired/unknown: 404, or 400 that says the model is not found/supported.
export const isModelMissing = e => e?.status === 404 || (e?.status === 400 && /model|not found|not supported/i.test(e.message));
