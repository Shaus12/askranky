// Daily billing reconciliation for a Render Cron Job: `npm run billing:sync` (schedule e.g. "0 4 * * *").
import { syncAll } from '../src/jobs/billing-sync.js'; import { flush, close } from '../src/store.js';
const r = await syncAll(); await flush(); await close?.(); console.log('billing sync:', JSON.stringify(r));
