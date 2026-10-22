// HTML escaping for every value interpolated into server-rendered HTML (pages + emails).
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = s => String(s ?? '').replace(/[&<>"'`]/g, c => MAP[c]);
// Only allow http(s) / relative URLs in href/src; anything else (javascript:, data:) becomes '#'.
export const safeUrl = u => { const s = String(u ?? '').trim(); return /^(https?:\/\/|\/(?!\/))/i.test(s) ? esc(s) : '#'; };
