// Sprint 23 (ADR-077): report collation + bootstrap CIs + with-Ralph vs
// without-Ralph delta computation. Writes runs/<ts>/REPORT.md.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { EVAL_ROOT, DOCS, PARTNERS } = require('./lib-recipe');
const { loadRubric } = require('./lib-judge');

function loadExtraAxes() {
  return JSON.parse(fs.readFileSync(path.join(EVAL_ROOT, 'rubric', 'extra-axes.json'), 'utf8'));
}

function loadAllScores(scoresDir) {
  const out = [];
  if (!fs.existsSync(scoresDir)) return out;
  for (const fname of fs.readdirSync(scoresDir)) {
    if (!fname.endsWith('.json')) continue;
    const full = path.join(scoresDir, fname);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!data.ok || !data.parsed) continue;
    out.push({ filename: fname, ...data.parsed });
  }
  return out;
}

function bootstrap(samples, fn, n = 1000) {
  if (samples.length === 0) return { mean: 0, lo: 0, hi: 0 };
  const observed = fn(samples);
  const draws = [];
  for (let i = 0; i < n; i++) {
    const resample = [];
    for (let j = 0; j < samples.length; j++) {
      resample.push(samples[Math.floor(Math.random() * samples.length)]);
    }
    draws.push(fn(resample));
  }
  draws.sort((a, b) => a - b);
  return {
    mean: observed,
    lo: draws[Math.floor(0.025 * n)],
    hi: draws[Math.floor(0.975 * n)],
  };
}

function fmtPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function recallOnItems(rows, itemIds) {
  if (rows.length === 0 || itemIds.length === 0) return 0;
  let covered = 0;
  let total = 0;
  for (const r of rows) {
    for (const item of r.items) {
      if (!itemIds.includes(item.id)) continue;
      total++;
      if (item.verdict === 'COVERED') covered++;
    }
  }
  return total > 0 ? covered / total : 0;
}

function writeReport({ runDir, scores, manifest }) {
  const extraAxes = loadExtraAxes();
  const groundingTouched = extraAxes.grounding_touched_items;

  const lines = [];
  lines.push('# Sprint 23 eval — Lavern-baselined partner consultation');
  lines.push('');
  lines.push(`- Run timestamp: \`${manifest.timestamp}\``);
  lines.push(`- Oscar GC SHA:  \`${manifest.oscar_sha ?? '(unknown)'}\``);
  lines.push(`- Lavern SHA:    \`${manifest.lavern_sha}\``);
  lines.push(`- Sprint 22 baseline SHA: \`${manifest.sprint22_baseline_sha}\``);
  lines.push(`- Model:         \`${manifest.model}\``);
  lines.push(`- Wall-clock:    ${manifest.wall_clock_seconds.toFixed(1)} s`);
  lines.push(`- Partner runs:  ${manifest.partner_runs_total} (${manifest.partner_runs_succeeded} succeeded)`);
  lines.push(`- Judge calls:   ${manifest.judge_calls_total} (${manifest.judge_calls_succeeded} succeeded)`);
  lines.push('');

  // Per (doc × partner × config) table.
  lines.push('## Per-tuple results');
  lines.push('');
  lines.push('| Doc | Partner | Config | Recall (all) | Recall (grounding-touched) | Grounded citations | VP cited | Tone fit | Halluc | Overprod (Doc 3) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const docId of Object.keys(DOCS)) {
    for (const partnerSlug of Object.keys(PARTNERS)) {
      for (const config of ['with-ralph', 'without-ralph']) {
        const row = scores.find(
          (s) => s.doc_id === docId && s.partner_slug === partnerSlug && s.config === config,
        );
        if (!row) {
          lines.push(`| ${docId} | ${partnerSlug} | ${config} | — | — | — | — | — | — | — |`);
          continue;
        }
        const total = row.items.length;
        const covered = row.items.filter((it) => it.verdict === 'COVERED').length;
        const recallAll = total > 0 ? covered / total : 0;
        const touched = groundingTouched[docId] ?? [];
        const recallGT = recallOnItems([row], touched);
        const g = row.global;
        lines.push(
          `| ${docId} | ${partnerSlug} | ${config} | ${fmtPct(recallAll)} | ${fmtPct(recallGT)} | ${g.grounded_citations.toFixed(2)} | ${g.verification_pass_cited ? 'Y' : 'N'} | ${g.partner_tone_fit} | ${g.hallucination_count} | ${docId === 'doc3-veoneer' ? (g.overproduction_flag ? 'Y' : 'N') : '—'} |`,
        );
      }
    }
  }
  lines.push('');

  // With-Ralph vs without-Ralph delta on grounding-touched items.
  lines.push('## With-Ralph vs without-Ralph delta');
  lines.push('');
  const withRalph = scores.filter((s) => s.config === 'with-ralph');
  const withoutRalph = scores.filter((s) => s.config === 'without-ralph');

  const allTouchedIds = Object.values(groundingTouched).flat();
  const recallWith = recallOnItems(withRalph, allTouchedIds);
  const recallWithout = recallOnItems(withoutRalph, allTouchedIds);
  const delta = recallWith - recallWithout;

  // Bootstrap CIs over per-(partner,doc) rows.
  const groundingTouchedRecall = (row) => {
    const touched = groundingTouched[row.doc_id] ?? [];
    return recallOnItems([row], touched);
  };
  const meanFn = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);
  const withSamples = withRalph.map(groundingTouchedRecall);
  const withoutSamples = withoutRalph.map(groundingTouchedRecall);
  const ciWith = bootstrap(withSamples, meanFn);
  const ciWithout = bootstrap(withoutSamples, meanFn);

  lines.push('Recall on **grounding-touched** rubric items (the items whose risk references a specific clause or quoted text — the items where Ralph Loop\'s grounding discipline is most measurable):');
  lines.push('');
  lines.push('| Config | Recall | 95% CI (bootstrap, n=1000) | n samples |');
  lines.push('|---|---|---|---|');
  lines.push(`| with-Ralph    | ${fmtPct(recallWith)} | [${fmtPct(ciWith.lo)}, ${fmtPct(ciWith.hi)}] | ${withSamples.length} |`);
  lines.push(`| without-Ralph | ${fmtPct(recallWithout)} | [${fmtPct(ciWithout.lo)}, ${fmtPct(ciWithout.hi)}] | ${withoutSamples.length} |`);
  lines.push(`| **Δ_grounded**     | **${(delta * 100).toFixed(1)}pp** | (subtract above CIs) | n=${withSamples.length + withoutSamples.length} obs |`);
  lines.push('');

  // Global axis deltas.
  const meanGA = (rows, key) => rows.length === 0 ? 0 : rows.reduce((a, r) => a + (r.global[key] ?? 0), 0) / rows.length;
  const groundedWith = meanGA(withRalph, 'grounded_citations');
  const groundedWithout = meanGA(withoutRalph, 'grounded_citations');
  const hallucWith = meanGA(withRalph, 'hallucination_count');
  const hallucWithout = meanGA(withoutRalph, 'hallucination_count');
  const vpCitedWith = withRalph.filter((r) => r.global.verification_pass_cited).length;
  const vpCitedWithout = withoutRalph.filter((r) => r.global.verification_pass_cited).length;

  lines.push('### Global axes (mean across all partner-doc pairs)');
  lines.push('');
  lines.push('| Axis | with-Ralph | without-Ralph | Δ |');
  lines.push('|---|---|---|---|');
  lines.push(`| grounded_citations          | ${groundedWith.toFixed(2)} | ${groundedWithout.toFixed(2)} | ${(groundedWith - groundedWithout).toFixed(2)} |`);
  lines.push(`| hallucination_count (mean)  | ${hallucWith.toFixed(2)} | ${hallucWithout.toFixed(2)} | ${(hallucWith - hallucWithout).toFixed(2)} |`);
  lines.push(`| verification_pass_cited     | ${vpCitedWith}/${withRalph.length} | ${vpCitedWithout}/${withoutRalph.length} | ${vpCitedWith - vpCitedWithout} |`);
  lines.push('');

  // Interpretation
  lines.push('## Substantive Sprint 23 test');
  lines.push('');
  if (delta > 0.05) {
    lines.push(`**Outcome: Δ_grounded = +${(delta * 100).toFixed(1)}pp > +5pp.** Partners-with-Ralph score measurably higher than partners-without on grounding-touched rubric items. The Shape A discipline appears to be moving the needle.`);
  } else if (delta > 0) {
    lines.push(`**Outcome: Δ_grounded = +${(delta * 100).toFixed(1)}pp.** Positive but small. The Shape A discipline is directionally helpful; whether this is enough to justify keeping it as-is vs. moving to Shape B is a judgment call for the sprint close.`);
  } else if (delta === 0) {
    lines.push(`**Outcome: Δ_grounded = 0.0pp.** No measured difference. Brief calls for Sprint 24 to reconsider Shape B or a different shape entirely.`);
  } else {
    lines.push(`**Outcome: Δ_grounded = ${(delta * 100).toFixed(1)}pp (negative).** Partners-WITH-Ralph score LOWER than without. The Sprint 23 Shape A discipline may be actively harmful (e.g., over-revision burning tokens that should have gone to substantive analysis); Sprint 24 reconsiders.`);
  }
  lines.push('');

  // Known coverage gaps.
  lines.push('## Known coverage gaps');
  lines.push('');
  lines.push('1. **`oscar-document-reader` not exercised on these CUAD docs.** Per [ADR-075](../../docs/adr/075-sprint22-lavern-mcp-lift-policy.md), document-reader ships with a placeholder corpus. For this eval the partner reads the CUAD doc from the user-message paste, not via document-reader. document-reader stays available as a tool but isn\'t load-bearing here.');
  lines.push('');
  lines.push('2. **Doc text passed to `verification-pass` via `delegate()` args is wasteful** (double-paste with the partner\'s user message). Per [ADR-074](../../docs/adr/074-sprint22-path-a-per-partner-mcp-attachment.md), sub-recipes don\'t inherit parent extensions; current substrate offers no other path. Sprint 24 has the option to evaluate a Rust-core SubRecipe schema extension.');
  lines.push('');
  lines.push('3. **Lavern human-baseline comparison is informational only.** Lavern\'s `EVAL_REPORT_V*.md` files score `gemma2:2b` running through a Watchman → Reader → precedent-board → Curator pipeline. Oscar GC runs `MiniMax-M2.5` doing partner consultation. Score level is not directly comparable; rubric-item match patterns may transfer for divergence analysis.');
  lines.push('');

  fs.writeFileSync(path.join(runDir, 'REPORT.md'), lines.join('\n'));
}

module.exports = {
  loadAllScores,
  bootstrap,
  recallOnItems,
  writeReport,
};
