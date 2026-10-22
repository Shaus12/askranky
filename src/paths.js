// Where runtime data lives (db.json, outbox/). Override with DATA_DIR (tests use a temp dir).
import path from 'node:path';
export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const dataPath = (...p) => path.join(DATA_DIR, ...p);
