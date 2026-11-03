// trade1: the ~20 trades offered in the free-scan form (replaces the generic "עסק מקומי" fallback, which asked AI about no trade at all
// and scored 0). Each trade: id (sent by the form as `trade`), display label (he/en, stored as business.category, used in the report and
// fixes copy), the field term used inside the buyer questions (heQ/enQ: "מי העסקים הטובים ביותר בתחום אינסטלציה בחיפה?") and the
// question set (src/questions.js SETS). 'other' = free text in `category` (handled by categorySet keyword matching, as before).
// web/lib/trades.ts is a mirror of this list (test/trade.js asserts they match). No dentists on purpose (product rule).
export const TRADES = [
  { id: 'plumber', he: 'אינסטלטור', en: 'Plumber', heQ: 'אינסטלציה', enQ: 'plumbing', set: 'services' },
  { id: 'electrician', he: 'חשמלאי', en: 'Electrician', heQ: 'חשמלאות', enQ: 'electrician services', set: 'services' },
  { id: 'lawyer', he: 'עורך דין', en: 'Lawyer', heQ: 'עריכת דין', enQ: 'legal services', set: 'services' },
  { id: 'accountant', he: 'רואה חשבון', en: 'Accountant', heQ: 'ראיית חשבון', enQ: 'accounting', set: 'services' },
  { id: 'realtor', he: 'מתווך נדל"ן', en: 'Real-estate agent', heQ: 'תיווך נדל"ן', enQ: 'real-estate agency', set: 'services' },
  { id: 'garage', he: 'מוסך', en: 'Car repair garage', heQ: 'מוסכים ותיקון רכב', enQ: 'car repair', set: 'services' },
  { id: 'hair', he: 'מספרה', en: 'Hair salon', heQ: 'מספרות ועיצוב שיער', enQ: 'hair salon', set: 'health' },
  { id: 'restaurant', he: 'מסעדה', en: 'Restaurant', heQ: 'מסעדות', enQ: 'restaurant', set: 'food' },
  { id: 'gym', he: 'חדר כושר', en: 'Gym', heQ: 'חדרי כושר', enQ: 'gym and fitness', set: 'health' },
  { id: 'locksmith', he: 'מנעולן', en: 'Locksmith', heQ: 'מנעולנות', enQ: 'locksmith services', set: 'services' },
  { id: 'painter', he: 'צבעי', en: 'Painter', heQ: 'צביעת דירות', enQ: 'house painting', set: 'services' },
  { id: 'movers', he: 'חברת הובלות', en: 'Movers', heQ: 'הובלות', enQ: 'moving services', set: 'services' },
  { id: 'cleaning', he: 'חברת ניקיון', en: 'Cleaning service', heQ: 'ניקיון', enQ: 'cleaning services', set: 'services' },
  { id: 'vet', he: 'וטרינר', en: 'Veterinarian', heQ: 'וטרינריה', enQ: 'veterinary care', set: 'health' },
  { id: 'physio', he: 'פיזיותרפיסט', en: 'Physiotherapist', heQ: 'פיזיותרפיה', enQ: 'physiotherapy', set: 'health' },
  { id: 'architect', he: 'אדריכל', en: 'Architect', heQ: 'אדריכלות', enQ: 'architecture', set: 'services' },
  { id: 'photographer', he: 'צלם', en: 'Photographer', heQ: 'צילום', enQ: 'photography', set: 'services' },
  { id: 'venue', he: 'אולם או גן אירועים', en: 'Event venue', heQ: 'אולמות וגני אירועים', enQ: 'event venues', set: 'generic' },
  { id: 'tutoring', he: 'שיעורים פרטיים', en: 'Private tutoring', heQ: 'שיעורים פרטיים', enQ: 'private tutoring', set: 'generic' },
  { id: 'insurance', he: 'סוכן ביטוח', en: 'Insurance agent', heQ: 'סוכנות ביטוח', enQ: 'insurance agents', set: 'services' },
];
export const TRADE_IDS = TRADES.map(t => t.id);
export const tradeById = id => TRADES.find(t => t.id === String(id || '').trim()) || null;
// Body -> { category, trade } for POST /api/scan. A known `trade` id wins; otherwise the free-text `category` (old API shape / "other").
export function categoryFromBody(body = {}) {
  const t = tradeById(body.trade); const lang = body.lang === 'he' ? 'he' : body.lang === 'en' ? 'en' : null;
  if (t) return { category: lang === 'en' ? t.en : t.he, trade: t.id };
  const c = typeof body.category === 'string' ? body.category.trim() : ''; return { category: c, trade: null };
}
