// npm run config:check — prints mode + missing/inconsistent env var names (never values). Exit 1 on errors.
import { logConfig } from '../src/config-check.js'; process.exitCode = logConfig().ok ? 0 : 1;
