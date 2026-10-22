// Shared test setup: every test run gets its own temp DATA_DIR so app/data is never read or written.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const APP_DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const snapshot = () => { try { return fs.readdirSync(APP_DATA, { recursive: true }).sort().map(f => { const st = fs.statSync(path.join(APP_DATA, f)); return `${f}:${st.size}:${st.mtimeMs}`; }).join('|'); } catch { return 'absent'; } };
export function useTempData(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ranky-${name}-`));
  process.env.DATA_DIR = dir; delete process.env.DB_FILE; delete process.env.DATABASE_URL; process.env.FORCE_JSON_STORE = '1'; const before = snapshot();
  return { dir, outbox: path.join(dir, 'outbox'),
    // Throws if anything under app/data changed during the run; then removes the temp dir.
    done() { if (snapshot() !== before) throw new Error('test touched app/data'); fs.rmSync(dir, { recursive: true, force: true }); } };
}
