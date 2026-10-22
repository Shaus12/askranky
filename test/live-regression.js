// Regression from the first live ChatGPT answer (2026-10-22): top pick named in prose, tips bullets after a heading.
import assert from 'node:assert';
import { analyzeAnswer } from '../src/extract.js';
const text = `לפי מדריכים, החומוסייה שמקבלת הכי הרבה המלצות היא Abu Hassan (אבו חסן) ביפו.\n\nשקול גם:\n- Hummus Mashawsha / מסבה (מרכז תל‑אביב) — נוחה.\n- Hummus Eliyahu (פלורנטין/שוק יפו) — נדיבות.\n- Abu Adham / אבו אדאם — מוניטין.\n\nכמה טיפים פרקטיים:\n- באבו חסן ביפו יש בדרך‑כלל תור — כדאי להגיע מוקדם.\n- חומוס הוא עניין של טעם אישי — אוכל להמליץ.`;
const r = analyzeAnswer({ text, citations: [] }, { name: 'אבו חסן', website: '' });
assert.equal(r.mentioned, true); assert.equal(r.rank, 1, 'prose top pick should rank 1');
assert.deepEqual(r.competitors, ['Hummus Mashawsha / מסבה', 'Hummus Eliyahu', 'Abu Adham / אבו אדאם']);
console.log('live-regression: ok');
