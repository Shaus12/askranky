// Offline analysis of the saved Day-1 scans (spec §5). PURE: no network, no provider import, no store import, zero cost.
// Detection is the product's own analyzeAnswer (src/extract.js); the only addition is trying each alias as the business name and OR-ing the results.
import { analyzeAnswer, norm, clean, isOpaqueHost } from '../../src/extract.js';
import { summarizeResults } from '../../src/summary.js';
import { buildFixes } from '../../src/fixes.js';
import { PLANS } from '../../src/plans.js';
import { ENGINES, MARKETS, QUESTIONS_PER_SCAN, validateScan, dateEn, isoIsrael } from './day1-common.js';

export const N_BUSINESSES = 12;
const domainOf = site => String(site || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
const stripWww = h => String(h || '').toLowerCase().replace(/^www\./, '');
const variantsOf = b => [b.name, ...(b.aliases || [])].map(s => String(s || '').trim()).filter(Boolean);
const GBP_HOST = /(^|\.)(g\.page|business\.google\.com|maps\.google\.[a-z.]+)$/i, GBP_URL = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps/i;
export const isGbp = c => GBP_HOST.test(stripWww(c.host)) || GBP_URL.test(String(c.url || ''));
export const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); const u = new Set([...A, ...B]); if (!u.size) return null; return [...A].filter(x => B.has(x)).length / u.size; };
const pct = (k, n) => Math.round(100 * k / n);

// Normalizes the human-curated business file: an array, or { source, businesses: [...] }.
export const businessList = f => Array.isArray(f) ? f : (f?.businesses || []);

// Detector for one business on one saved result. Returns { mentioned, rank, cited, clarifying, an } (an = analysis for the main name).
export function detect(result, biz, category) {
  const ans = { text: result.answer, citations: result.citations || [] };
  const all = variantsOf(biz).map(v => analyzeAnswer(ans, { name: v, website: biz.website, category }));
  const main = all[0] || analyzeAnswer(ans, { name: '', website: biz.website, category });
  const ranks = all.map(a => a.rank).filter(r => r !== null && r !== undefined);
  return { mentioned: all.some(a => a.mentioned), rank: ranks.length ? Math.min(...ranks) : null, cited: main.ownSiteCited, clarifying: !!main.clarifying, an: main };
}

// Snippets (±100 chars) around literal occurrences of the name/aliases in an answer, for the human review file.
export function snippets(text, biz, r = 100) {
  const t = clean(text); const low = t.toLowerCase(); const out = [];
  for (const v of variantsOf(biz)) { const needle = clean(v).toLowerCase(); if (!needle) continue; let i = low.indexOf(needle);
    while (i >= 0 && out.length < 20) { out.push({ variant: v, snippet: t.slice(Math.max(0, i - r), i + needle.length + r).replace(/\s+/g, ' ') }); i = low.indexOf(needle, i + needle.length); } }
  return out;
}

export function applyOverride(overrides, biz, ctx) {   // ctx: { run, engine, q }; later entries win; every field except business/named is optional (wildcard)
  let hit = null;
  for (const o of overrides || []) if (o.business === biz.name && (o.run == null || o.run === ctx.run) && (o.engine == null || o.engine === ctx.engine) && (o.q == null || o.q === ctx.q)) hit = o;
  return hit;
}

// runs: [{ meta, scan }] (1 or 2), businesses: the 12, overrides: [] (from review-<ID>.json).
export function analyzeMarket({ id, runs, businesses, overrides = [], now = new Date() }) {
  const spec = MARKETS[id]; const reasons = [];
  if (!spec) reasons.push(`unknown market ${id}`);
  const runNums = (runs || []).map(r => r.meta?.run).sort();
  if (!runs?.length || runs.length > 2 || runNums.some((n, i) => n !== i + 1)) reasons.push(`runs must be exactly [1] or [1,2] (got [${runNums}])`);
  for (const r of runs || []) {
    const v = validateScan(r.scan, id); reasons.push(...v.map(x => `run ${r.meta?.run}: ${x}`));
    if (r.meta?.valid === false) reasons.push(`run ${r.meta?.run}: meta.valid is false`);
    if (!r.meta?.questionsAsserted) reasons.push(`run ${r.meta?.run}: questions were not asserted when the scan was saved`);
  }
  if (!Array.isArray(businesses) || businesses.length !== N_BUSINESSES) reasons.push(`expected ${N_BUSINESSES} businesses, got ${Array.isArray(businesses) ? businesses.length : 'none'}`);
  else if (businesses.some(b => !b?.name)) reasons.push('a business has no name');
  const first = runs?.[0]?.meta; const base = { id, valid: false, invalidReasons: reasons };
  if (reasons.length) return { ...base, placeholders: null, perBusiness: [], cost: costOf(runs), meta: metaOf(spec, first, runs, now), review: { md: '', overridesApplied: [] }, mdLines: [`INVALID: ${reasons.join('; ')}`] };

  const category = spec.category; const checksPerRun = QUESTIONS_PER_SCAN * ENGINES.length;
  const recs = [];            // one per (run, result, business)
  const entitiesBy = {};      // `${run}|${q}|${engine}` -> normalized entity names (neutral call: every entity, none treated as "the" business)
  const applied = [];
  for (const { meta, scan } of runs) for (const res of scan.results) {
    const q = scan.results.filter(x => x.engine === res.engine).indexOf(res) + 1; const run = meta.run;
    const neutral = analyzeAnswer({ text: res.answer, citations: [] }, { name: '', category }).competitors.map(norm);
    const key = `${run}|${q}|${res.engine}`; entitiesBy[key] = { set: new Set(neutral), named: new Set() };
    businesses.forEach((b, bi) => {
      const d = detect(res, b, category); const auto = d.mentioned && !d.clarifying; const ov = applyOverride(overrides, b, { run, engine: res.engine, q });
      const named = ov ? !!ov.named : auto; if (ov) applied.push({ business: b.name, run, engine: res.engine, q, auto, named, reason: ov.reason || null });
      recs.push({ bi, run, q, engine: res.engine, named, auto, rank: d.rank, cited: d.cited, overridden: !!ov, d, res });
      if (named) entitiesBy[key].named.add(bi);
    });
  }
  // Canonical set of "named businesses" per (run,q,engine): entity names, with the entities that are one of the listed businesses collapsed to that business's name.
  const canon = bi => `\u0001${norm(businesses[bi].name)}`; const matchesBiz = (e, b) => variantsOf(b).map(norm).some(v => v && (e.includes(v) || v.includes(e)));
  const nameSet = key => { const { set, named } = entitiesBy[key]; const out = new Set([...set].filter(e => ![...named].some(bi => matchesBiz(e, businesses[bi])))); for (const bi of named) out.add(canon(bi)); return out; };

  const byBiz = businesses.map((b, bi) => { const rs = recs.filter(r => r.bi === bi); const nr = rs.filter(r => r.named); const be = Object.fromEntries(ENGINES.map(e => [e, nr.filter(r => r.engine === e).length]));
    return { bi, named: nr.length > 0, byEngine: be, bestRank: nr.filter(r => r.rank).length ? Math.min(...nr.filter(r => r.rank).map(r => r.rank)) : null, cited: rs.some(r => r.cited), overridden: rs.some(r => r.overridden) }; });
  const kNamed = byBiz.filter(b => b.named).length; const kEng = e => byBiz.filter(b => b.byEngine[e] > 0).length;

  // pct_overlap: Jaccard between ChatGPT and Gemini named sets per (question, run); pairs where both are empty are skipped.
  const pairs = []; for (const { meta } of runs) for (let q = 1; q <= QUESTIONS_PER_SCAN; q++) { const j = jaccard([...nameSet(`${meta.run}|${q}|chatgpt`)], [...nameSet(`${meta.run}|${q}|gemini`)]); if (j !== null) pairs.push(j); }
  const pctOverlap = pairs.length ? Math.round(100 * pairs.reduce((a, b) => a + b, 0) / pairs.length) : null;

  // citations
  const own = businesses.map(b => domainOf(b.website)).filter(Boolean); const allCites = runs.flatMap(r => r.scan.results.filter(x => !x.error).flatMap(x => x.citations || []));
  const nonOpaque = allCites.filter(c => !(c.opaque || isOpaqueHost(c.host)));
  const counted = nonOpaque.filter(c => !own.some(d => stripWww(c.host).endsWith(d))); const hc = {}; for (const c of counted) { const h = stripWww(c.host); hc[h] = (hc[h] || 0) + 1; }
  const topSites = Object.entries(hc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h, n]) => `${h} (${n})`);
  const gbpShare = nonOpaque.length >= 5 ? pct(nonOpaque.filter(isGbp).length, nonOpaque.length) : null;

  // variance (Tier 2 only): names named in run 1 (both engines) that no engine named in run 2
  let variance = null, varianceDetail = null;
  if (runs.length === 2) { const U = run => { const s = {}; for (const e of ENGINES) { s[e] = new Set(); for (let q = 1; q <= QUESTIONS_PER_SCAN; q++) for (const n of nameSet(`${run}|${q}|${e}`)) s[e].add(n); } return s; };
    const a = U(1), b = U(2); const u1 = new Set([...a.chatgpt, ...a.gemini]), u2 = new Set([...b.chatgpt, ...b.gemini]); const x = [...u1].filter(n => !u2.has(n)).length;
    if (u1.size) variance = `${x} of the ${u1.size} businesses named in run 1 were not named in run 2 (same questions, same engines)`;
    varianceDetail = { run1Distinct: u1.size, absentInRun2: x, perEngine: Object.fromEntries(ENGINES.map(e => [e, { run1: a[e].size, run2: b[e].size, absentInRun2: [...a[e]].filter(n => !b[e].has(n)).length }])) }; }

  // fixes: per business with no named result, summary rebuilt exactly like runScan (shared summarizeResults) and buildFixes
  const privateRe = businesses.flatMap(variantsOf).map(s => s.toLowerCase()); const titleCount = new Map(); const bizMeta = { category, city: spec.cityResolved, lang: spec.lang };
  for (const b of byBiz.filter(x => !x.named)) { const biz = businesses[b.bi]; const merged = recs.filter(r => r.bi === b.bi).map(r => ({ ...r.res, ...r.d.an, mentioned: r.named, rank: r.named ? r.rank : null }));
    const summary = summarizeResults(merged, { plan: PLANS.free, engines: ENGINES, skipped: [], cost: 0 });
    for (const f of buildFixes({ summary }, { ...bizMeta, name: biz.name })) { if (privateRe.some(n => f.title.toLowerCase().includes(n))) continue; if (!titleCount.has(f.title)) titleCount.set(f.title, { n: 0, first: titleCount.size }); titleCount.get(f.title).n++; } }
  const topFixes = [...titleCount.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first).slice(0, 3).map(([t]) => t);

  const startedAts = runs.map(r => r.meta.startedAt).sort(); const d0 = dateEn(startedAts[0]), d1 = dateEn(startedAts.at(-1));
  const nChecks = runs.reduce((s, r) => s + r.scan.summary.checks, 0);
  const placeholders = {
    n_businesses: N_BUSINESSES, n_questions: QUESTIONS_PER_SCAN, n_runs: runs.length, n_checks: nChecks, date_range: d0 === d1 ? d0 : `${d0} – ${d1}`, city: spec.cityResolved,
    ...(spec.lang === 'en' ? { example_question: spec.questions[4] } : { example_question_he: spec.questions[1] }),
    k_named: kNamed, pct_mentioned: pct(kNamed, N_BUSINESSES), pct_mentioned_chatgpt: pct(kEng('chatgpt'), N_BUSINESSES), pct_mentioned_gemini: pct(kEng('gemini'), N_BUSINESSES), k_named_chatgpt: kEng('chatgpt'), k_named_gemini: kEng('gemini'),
    pct_overlap: pctOverlap, top_cited_sites: topSites, n_cited_hosts_total: Object.keys(hc).length, n_citations_counted: counted.length, gbp_share: gbpShare, variance_finding: variance,
    common_trait: null, fix_1: topFixes[0] ?? null, fix_2: topFixes[1] ?? null, fix_3: topFixes[2] ?? null,
  };
  const label = `Directional only: ${nChecks} checks (${QUESTIONS_PER_SCAN} questions × ${ENGINES.length} engines × ${runs.length} run${runs.length > 1 ? 's' : ''}), ${N_BUSINESSES} public businesses, one city, API answers (not the consumer apps), ${placeholders.date_range}.`;
  const perBusiness = byBiz.map(b => ({ name: '(private)', named: b.named, byEngine: b.byEngine, bestRank: b.bestRank, cited: b.cited, overridden: b.overridden }));
  return { id, valid: true, invalidReasons: [], label, meta: metaOf(spec, first, runs, now), placeholders, perBusiness, varianceDetail, overridesApplied: applied, cost: costOf(runs),
    privateRows: byBiz.map(b => ({ name: businesses[b.bi].name, named: b.named, byEngine: b.byEngine, bestRank: b.bestRank, cited: b.cited, overridden: b.overridden, snippets: recs.filter(r => r.bi === b.bi && r.named).flatMap(r => snippets(r.res.answer, businesses[b.bi], 100).slice(0, 1).map(x => `run ${r.run} ${r.engine} q${r.q}: …${x.snippet}…`)) })),
    review: reviewOf({ id, businesses, recs, byBiz, overrides, applied }), mdLines: postPreview(id, placeholders, label) };
}
const costOf = runs => ({ scans: (runs || []).length, estimatedUsd: +(runs || []).reduce((s, r) => s + (r.meta?.estCostUsd || 0), 0).toFixed(4), recordedInDailyCounter: !!runs?.length && runs.every(r => r.meta?.recordedInDailyCounter === true) });
const metaOf = (spec, first, runs, now) => ({ category: spec?.category, city: spec?.cityResolved, lang: spec?.lang, engines: ENGINES, runs: runs?.length || 0, models: first?.models, appCommit: first?.appCommit, analyzedAt: isoIsrael(now) });

function postPreview(id, p, label) {   // aggregates only (no business names)
  const L = [label, ''];
  L.push(`- ${p.k_named} of ${p.n_businesses} businesses named at least once (${p.pct_mentioned}%); ChatGPT ${p.pct_mentioned_chatgpt}%, Gemini ${p.pct_mentioned_gemini}%.`);
  L.push(p.pct_overlap === null ? '- Engine overlap: n/a (no named businesses to compare).' : `- ChatGPT and Gemini named the same businesses ${p.pct_overlap}% of the time (Jaccard overlap).`);
  if (p.top_cited_sites.length) L.push(`- Most cited sites: ${p.top_cited_sites.join(', ')}.`);
  if (p.gbp_share !== null) L.push(`- ${p.gbp_share}% of cited pages were Google Maps / Business Profile.`);
  if (p.variance_finding) L.push(`- ${p.variance_finding}.`);
  if (p.common_trait === null) L.push('- common_trait: (manual, from the review file; delete the bullet if none)');
  [p.fix_1, p.fix_2, p.fix_3].forEach((f, i) => L.push(f ? `- Fix ${i + 1}: ${f}` : `- Fix ${i + 1}: (none; shorten the post)`)); return L;
}
function reviewOf({ id, businesses, recs, byBiz, overrides, applied }) {
  const L = [`# Review ${id} (PRIVATE: business names)`, '', 'For each business: every answer where a name/alias appears literally (±100 chars), and the detector verdict. To override, write `review-' + id + '.json` as `{ "overrides": [{ "business": "<name>", "run": 1, "engine": "chatgpt", "q": 2, "named": true, "reason": "..." }] }` (run/engine/q optional = wildcard; override wins; each one is logged in results).', ''];
  businesses.forEach((b, bi) => { L.push(`## ${bi + 1}. ${b.name}  —  ${byBiz[bi].named ? 'NAMED' : 'not named'}`, `aliases: ${(b.aliases || []).join(' | ') || '-'}  website: ${b.website || '-'}`, '');
    for (const r of recs.filter(x => x.bi === bi)) { const sn = snippets(r.res.answer, b); if (!sn.length && !r.named) continue;
      const verdict = r.named ? `named${r.overridden ? ' (OVERRIDDEN)' : ''}${r.rank ? ` rank ${r.rank}` : ''}` : `NOT named${r.d.clarifying ? ' (clarifying answer)' : ''}${r.overridden ? ' (OVERRIDDEN)' : ''}${sn.length ? '  <-- text appears: CHECK' : ''}`;
      L.push(`- run ${r.run} ${r.engine} q${r.q}: ${verdict}`); if (!sn.length) L.push('  - (detector matched with prefix/spelling normalisation; no literal occurrence)'); for (const s of sn.slice(0, 5)) L.push(`  - [${s.variant}] …${s.snippet}…`); }
    L.push(''); });
  L.push('## Overrides applied', applied.length ? applied.map(a => `- ${a.business} run ${a.run} ${a.engine} q${a.q}: auto=${a.auto} -> ${a.named}${a.reason ? ` (${a.reason})` : ''}`).join('\n') : '(none)'); return { md: L.join('\n'), overridesApplied: applied };
}

export function resultsMd(r) {
  const L = [`# Day-1 results ${r.id} (PRIVATE; contains business names in the table below the preview)`, '', `valid: **${r.valid}**${r.invalidReasons.length ? `\n\nINVALID: ${r.invalidReasons.join('; ')}` : ''}`, '', r.label || '', ''];
  if (r.valid) { L.push('## Placeholders', '', '| key | value |', '|---|---|', ...Object.entries(r.placeholders).map(([k, v]) => `| ${k} | ${Array.isArray(v) ? v.join(', ') : v === null ? 'null' : v} |`), '', '## Post preview (aggregates only)', '', ...r.mdLines, '', '## Per business (PRIVATE)', '', '| # | business | named | chatgpt | gemini | best rank | own site cited | overridden |', '|---|---|---|---|---|---|---|---|', ...(r.privateRows || []).map((b, i) => `| ${i + 1} | ${b.name} | ${b.named ? 'yes' : 'no'} | ${b.byEngine.chatgpt} | ${b.byEngine.gemini} | ${b.bestRank ?? '-'} | ${b.cited ? 'yes' : 'no'} | ${b.overridden ? 'yes' : 'no'} |`), '', '### Snippets of named answers', ...(r.privateRows || []).filter(b => b.named).flatMap(b => [`**${b.name}**`, ...b.snippets.map(x => `- ${x}`)]), '', `Cost: ${r.cost.scans} scans, est. $${r.cost.estimatedUsd}, recorded in daily counter: ${r.cost.recordedInDailyCounter}`); if (r.overridesApplied?.length) L.push('', `Overrides applied: ${r.overridesApplied.length} (see review file)`); }
  return L.join('\n');
}
