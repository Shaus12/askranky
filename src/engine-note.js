// Honest one-liner about which AI engines actually produced a scan (used by the report page and emails; the web UI has HE/EN strings).
const LABEL = { chatgpt: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity' };
export const SKIP_REASON_EN = { not_enabled: 'not enabled yet', missing_key: 'not configured', failed: 'did not respond' };
export function engineNote(summary) {
  const e = summary?.engines; if (!e) return '';
  const ran = (e.ran || []).map(x => LABEL[x] || x).join(', ');
  const sk = (e.skipped || []).map(x => `${LABEL[x.engine] || x.engine} (${SKIP_REASON_EN[x.reason] || x.reason})`).join(', ');
  return `Engines that ran: ${ran || 'none'}.${sk ? ` Skipped, not included in the score: ${sk}.` : ''}`;
}
