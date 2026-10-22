// Display-only mirror of src/plans.js, used for the first paint of the static page before /api/pricing answers.
// The server is the source of truth for every amount charged (test/pricing.js asserts this mirror matches).
export type Currency = "ILS" | "USD";
export const PRICES: Record<string, Record<Currency, number>> = { free: { ILS: 0, USD: 0 }, starter: { ILS: 79, USD: 19 }, pro: { ILS: 179, USD: 49 }, agency: { ILS: 549, USD: 149 } };
export const fmt = (n: number, c: Currency) => (c === "ILS" ? `₪${n}` : `$${n}`);
export type Billing = { currency: Currency; amount: number; displayCurrency: Currency; displayAmount: number; fallback: boolean };
export type Pricing = { currency: Currency; usdBilling: boolean; plans: { id: string; prices: Record<Currency, number>; billing: Billing | null }[] };
export const setCurrencyCookie = (c: Currency) => { document.cookie = `ranky_currency=${c}; Path=/; SameSite=Lax; Max-Age=31536000`; };
