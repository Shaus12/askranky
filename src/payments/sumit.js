// SUMIT (sumit.co.il) adapter. Flow:
// 1) Embedded Payments JS: the card form lives on OUR page (checkout / hidden admin test page) and SUMIT's payments.js
//    (https://app.sumit.co.il/scripts/payments.js, needs jQuery) tokenizes it in the browser straight against
//    https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/ with the PUBLIC key, returning a SingleUseToken.
//    Card numbers never reach our server: only { identifier, token } is POSTed to /api/checkout/charge (or the admin route).
//    (The old hosted redirect page /creditguy/external/tokenize and the SUMIT "redirect URL" setting are no longer used.)
// 2) Server calls POST /billing/recurring/charge/ with SingleUseToken, Currency (ILS or USD), Duration_Months=1
//    -> SUMIT creates a standing order (הוראת קבע), charges month 1 and issues a document.
//    Owner is an עוסק פטור: the document must be a קבלה (receipt), never חשבונית מס / חשבונית מס-קבלה, and no VAT.
// 3) SUMIT does NOT send IPN for later renewals -> run sync() daily via /billing/recurring/listforcustomer/.
// Env: SUMIT_COMPANY_ID, SUMIT_API_KEY (private, server only), SUMIT_PUBLIC_API_KEY (browser-safe; legacy alias SUMIT_API_PUBLIC_KEY),
// SUMIT_WEBHOOK_SECRET, ENABLE_USD_BILLING (default off).
// Field names/enums verified 2026-10-22 against the official OpenAPI spec https://api.sumit.co.il/swagger/v1/swagger.json
// Credentials authenticated via read-only POST /accounting/incomeitems/list/ (HTTP 200, Status 0).
import { usdBillingEnabled } from '../currency.js';
const API = 'https://api.sumit.co.il';
// Verified: Accounting_Typed_DocumentCurrency ILS=0, USD=1 (EUR=2).
export const SUMIT_CURRENCY = { ILS: 0, USD: 1 };
// Verified: Accounting_Typed_DocumentType Receipt=2 (InvoiceAndReceipt=1, Invoice=0). Sent as the numeric enum value.
// Also set the company's default document type to קבלה in the SUMIT back office.
export const SUMIT_DOCUMENT_TYPES = { Invoice: 0, InvoiceAndReceipt: 1, Receipt: 2 };
export const SUMIT_DOCUMENT_TYPE = SUMIT_DOCUMENT_TYPES.Receipt;
const publicKey = () => process.env.SUMIT_PUBLIC_API_KEY || process.env.SUMIT_API_PUBLIC_KEY;
// The single place where the browser-side config is produced. Refuses to hand the PRIVATE key to the browser by mistake
// (SUMIT_PUBLIC_API_KEY set to the same value as SUMIT_API_KEY).
export function embeddedConfig(identifier) {
  const companyId = Number(process.env.SUMIT_COMPANY_ID), pub = publicKey();
  if (!Number.isInteger(companyId) || companyId <= 0 || !pub) throw new Error('SUMIT public config not configured');
  if (pub === process.env.SUMIT_API_KEY) throw new Error('SUMIT_PUBLIC_API_KEY must not equal the private SUMIT_API_KEY');
  return { identifier, companyId, publicKey: pub };
}
// A SingleUseToken is an opaque string from payments.js. Reject empty/oversized values and anything that looks like a raw card number.
export const looksLikeCardNumber = v => { const d = String(v).replace(/[\s-]/g, ''); if (!/^\d{13,19}$/.test(d)) return false; let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
export const validSingleUseToken = t => typeof t === 'string' && t.length >= 8 && t.length <= 256 && /^[^\s\"'<>\\]+$/.test(t) && !looksLikeCardNumber(t);
const creds = () => {
  if (!process.env.SUMIT_COMPANY_ID || !process.env.SUMIT_API_KEY) throw new Error('SUMIT credentials not configured');
  return { CompanyID: Number(process.env.SUMIT_COMPANY_ID), APIKey: process.env.SUMIT_API_KEY };
};
async function call(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Credentials: creds(), ...body }) });
  const j = await r.json().catch(() => ({}));
  // ResponseStatus: Success=0, BusinessError=1, TechnicalError=2. Never include request/credentials in errors.
  if (!r.ok || (j.Status !== 0 && j.Status !== 'Success (0)')) throw new Error(`SUMIT ${path} failed: ${j.UserErrorMessage || r.status}`);
  return j;
}
// Build the charge payload from a server-side billing quote ({currency, amount}); exported for tests.
export function buildChargeRequest({ account, plan, billing, token }) {
  if (!(billing.currency in SUMIT_CURRENCY)) throw new Error('Unsupported currency');
  if (billing.currency === 'USD' && !usdBillingEnabled()) throw new Error('USD billing disabled (ENABLE_USD_BILLING)');
  if (billing.amount !== plan.prices[billing.currency]) throw new Error('Amount does not match plan price');
  if (plan.internal && (billing.currency !== 'ILS' || plan.id !== 'test' || plan.recurrence !== 1)) throw new Error('Invalid internal plan');
  return {
    // NoVAT: true marks the customer VAT-exempt (spec: Accounting_Typed_Customer.NoVAT). SearchMode 2 = ExternalIdentifier.
    Customer: { ExternalIdentifier: account.id, SearchMode: 2, Name: account.name || account.email, EmailAddress: account.email, NoVAT: true },
    SingleUseToken: token,
    Items: [{ Item: { Name: `${plan.name} plan`, Description: 'Monthly subscription', Duration_Months: 1 }, Quantity: 1, UnitPrice: billing.amount, Currency: SUMIT_CURRENCY[billing.currency], Duration_Months: 1, Recurrence: plan.recurrence || 0 }], // Recurrence 0/null = continuous; the internal admin test plan sets 1 (exactly one payment)
    // עוסק פטור: no VAT. Spec has VATIncluded (bool) but NO VATRate field on recurring/charge; VAT is governed by the
    // company's exempt-dealer setting + Customer.NoVAT. DocumentType 2 = Receipt (קבלה).
    VATIncluded: false, DocumentType: SUMIT_DOCUMENT_TYPE, OnlyDocument: false,
  };
}
// Read-only credential check (lists 1 income item; creates nothing). Returns no secrets.
export async function checkSumitConnectivity() {
  const j = await call('/accounting/incomeitems/list/', { Paging: { StartIndex: 0, PageSize: 1 } });
  return { authenticated: true, status: j.Status };
}
export const sumitPayments = {
  id: 'sumit',
  // Embedded flow: nothing to redirect to. Hands the client the browser-side config + the checkout identifier (<accountId>.<state>)
  // that it echoes back, together with the SingleUseToken, to the charge route.
  async createCheckout({ account, state }) { return { embedded: embeddedConfig(`${account.id}.${state}`) }; },
  // Called by the charge routes with { Valid: '1', Token, Identifier } built from the POSTed { token, identifier } (never from a URL).
  async handleReturn(q, account, plan, billing) {
    if (q.Valid !== '1' || !validSingleUseToken(q.Token) || String(q.Identifier).split('.')[0] !== account.id) return { ok: false, error: 'Card not tokenized' };
    const j = await call('/billing/recurring/charge/', buildChargeRequest({ account, plan, billing, token: q.Token }));
    const p = j.Data?.Payment || j.Payment || {};
    if (!(p.ValidPayment === true || p.Status === '000')) return { ok: false, error: p.StatusDescription || 'Charge failed' };
    return { ok: true, subscriptionRef: String((j.Data || j).RecurringCustomerItemIDs?.[0] || ''), customerId: (j.Data || j).CustomerID, documentId: (j.Data || j).DocumentID ?? null };
  },
  async handleWebhook(body, headers) {
    // SUMIT Triggers are view-shaped, not Stripe-style. Authenticate with a shared secret in the URL/header, store raw, then reconcile via sync().
    if (process.env.SUMIT_WEBHOOK_SECRET && headers['x-webhook-secret'] !== process.env.SUMIT_WEBHOOK_SECRET) return { ok: false };
    return { ok: true, event: { type: 'sumit.trigger', entityId: body.EntityID, raw: body } };
  },
  async cancel(account) { // Verified: RecurringCustomerItemID (+ Customer) per Recurring_Cancel_Request
    await call('/billing/recurring/cancel/', { Customer: { ExternalIdentifier: account.id, SearchMode: 2 }, RecurringCustomerItemID: Number(account.subscriptionRef) });
    return { ok: true };
  },
  async sync(account) { // Verified: Data.RecurringItems[], Status enum Active=0, Cancelled=1, ...
    const j = await call('/billing/recurring/listforcustomer/', { Customer: { ExternalIdentifier: account.id, SearchMode: 2 }, IncludeInactive: true });
    const items = j.Data?.RecurringItems || [];
    const it = (Array.isArray(items) ? items : []).find(i => String(i.ID) === account.subscriptionRef);
    const st = it?.Status; const active = !!it && (st === 0 || st === 11 || st === 12 || st === 14 || /^(Active|GracePeriod|PendingForFirstPayment|PendingRetry)/.test(String(st)));
    return { active, raw: it };
  },
};
