export const mockPayments = {
  id: 'mock',
  async createCheckout({ account, plan, returnUrl, state }) { return { redirectUrl: `/mock-checkout?${new URLSearchParams({ account: `${account.id}.${state}`, plan: plan.id, return: returnUrl })}` }; },
  async handleReturn(q) { return q.Valid === '1' ? { ok: true, subscriptionRef: 'mock_' + Date.now() } : { ok: false, error: 'Card declined (mock)' }; },
  async handleWebhook(body) { return { ok: true, event: { type: 'mock', body } }; },
  async cancel() { return { ok: true }; },
  async sync() { return { active: true }; },
};
