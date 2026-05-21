// Sprint 24-C (ADR-081): iteration trajectory report + Phase 2 extractor.
// Reuses bootstrap + recall math from Sprint 23 lib-report.js where the
// shape matches; emits a per-partner trajectory section plus a cross-
// partner pattern table (or negative finding) at sprint close.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sprint23 = require('../../lavern-jv/scripts/lib-report');

const EVAL_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(EVAL_ROOT, 'reports');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');

function fmtPct(p) {
  if (sprint23.fmtPct) return sprint23.fmtPct(p);
  return `${(p * 100).toFixed(1)}%`;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function distributionFromVerdicts(verdicts) {
  const totals = { covered: 0, partial: 0, missed: 0, wrong: 0 };
  for (const v of verdicts ?? []) {
    const key = (v.verdict ?? '').toLowerCase();
    if (key in totals) totals[key]++;
  }
  const total = totals.covered + totals.partial + totals.missed + totals.wrong;
  return {
    totals,
    total,
    recallCoveredOnly: total > 0 ? totals.covered / total : 0,
    recallIncludingPartial: total > 0 ? (totals.covered + 0.5 * totals.partial) / total : 0,
  };
}

function loadPartnerTrajectory(partnerSlug, maxCycles = 10) {
  const trajectory = [];
  for (let cycle = 0; cycle <= maxCycles; cycle++) {
    const dir = path.join(ITERATIONS_DIR, partnerSlug, `iter-${cycle}`);
    if (!fs.existsSync(dir)) break;
    const scores = readJsonIfExists(path.join(dir, 'scores.json'));
    const proposal = readJsonIfExists(path.join(dir, 'proposal.json'));
    const manifest = readJsonIfExists(path.join(dir, 'manifest.json'));
    trajectory.push({
      cycle,
      dir,
      scores,
      proposal,
      manifest,
      distribution: scores ? distributionFromVerdicts(scores.verdicts) : null,
    });
  }
  return trajectory;
}

function summarisePartnerTrajectory(partnerSlug) {
  const trajectory = loadPartnerTrajectory(partnerSlug);
  const rows = trajectory.map((t) => {
    if (!t.distribution) return `| ${t.cycle} | — | — | — | (no scores) |`;
    const d = t.distribution;
    const removed = t.proposal?.removals?.reduce((s, r) => s + (r.end - r.start), 0) ?? 0;
    return `| ${t.cycle} | ${d.total} | ${fmtPct(d.recallCoveredOnly)} | ${fmtPct(d.recallIncludingPartial)} | ${removed > 0 ? `−${removed} chars` : '—'} |`;
  });
  return [
    `### ${partnerSlug}`,
    '',
    '| cycle | N | recall (COVERED) | recall (COVERED+½PARTIAL) | subtractive proposal |',
    '|---:|---:|---:|---:|---|',
    ...rows,
  ].join('\n');
}

function writeFinalReport({
  partnerSlugs,
  sanityCheckResult,
  crossPartnerExtraction,
  totalCostUsd,
  costEntries,
  honestScopeDrops,
}) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, 'sprint-24-c-iteration-baseline.md');

  const lines = [
    '# Sprint 24-C — Cross-partner iteration eval baseline',
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Trio: ${partnerSlugs.join(' / ')}`,
    `Total compute spend: $${totalCostUsd.toFixed(2)} (Sprint envelope $60-100 per brief)`,
    '',
    '## Sanity check (Sprint 23 baseline re-run)',
    '',
    sanityCheckResult
      ? `- Result: \`${sanityCheckResult.status}\`. ${sanityCheckResult.summary ?? ''}`
      : '- (skipped or not yet run)',
    '',
    '## Per-partner iteration trajectory',
    '',
    ...partnerSlugs.map((p) => summarisePartnerTrajectory(p)),
    '',
    '## Phase 2 — Cross-partner pattern extraction',
    '',
    crossPartnerExtraction
      ? formatCrossPartnerExtraction(crossPartnerExtraction)
      : '- (skipped or not yet run)',
    '',
    '## Honest scope check',
    '',
    honestScopeDrops && honestScopeDrops.length > 0
      ? honestScopeDrops.map((d) => `- ${d}`).join('\n')
      : '- All defaults held (no scope drops).',
    '',
    '## Cost breakdown (top 10 entries)',
    '',
    '| kind | partner | cycle | model | usd | duration (ms) |',
    '|---|---|---:|---|---:|---:|',
    ...(costEntries ?? [])
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))
      .slice(0, 10)
      .map(
        (e) =>
          `| ${e.kind ?? '?'} | ${e.partner ?? '—'} | ${e.cycle ?? '—'} | ${e.model ?? '—'} | $${(e.usd ?? 0).toFixed(3)} | ${e.durationMs ?? '—'} |`,
      ),
    '',
  ];

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

function formatCrossPartnerExtraction(ex) {
  if (!ex.patterns || ex.patterns.length === 0) {
    return [
      '**Negative finding** — cross-partner pattern extraction did not surface ≥2 patterns appearing in ≥2 partners.',
      '',
      ex.negative_finding?.explanation ?? '',
      '',
      `What was tried: ${ex.negative_finding?.what_was_tried ?? '(see iteration logs)'}`,
      '',
      `Speculation: ${ex.negative_finding?.speculation ?? ''}`,
    ].join('\n');
  }
  return ex.patterns
    .map((p, i) => {
      const transferLines = Object.entries(p.transferability ?? {})
        .map(([partner, rating]) => `  - ${partner}: ${rating}`)
        .join('\n');
      return [
        `### Pattern ${i + 1}: ${p.name} (\`${p.id}\`)`,
        '',
        `Observed in: ${(p.partners_observed ?? []).join(', ')}`,
        '',
        `**Failure-mode evidence**`,
        ...(p.failure_mode_evidence ?? []).map((e) => `- ${e.partner} iter-${e.iter}: ${e.quote_or_summary ?? ''}`),
        '',
        `**Fix evidence**`,
        ...(p.fix_evidence ?? []).map((e) => `- ${e.partner} iter-${e.iter}: removed chars [${e.removal?.start}-${e.removal?.end}]; ${e.effect ?? ''}`),
        '',
        `**Transferability**`,
        transferLines,
        '',
        `**Proposed subtractive fix** — applies to \`${p.proposed_subtractive_fix?.applies_to ?? '?'}\``,
        '',
        p.proposed_subtractive_fix?.removal_summary ?? '',
        '',
      ].join('\n');
    })
    .join('\n');
}

module.exports = {
  EVAL_ROOT,
  REPORTS_DIR,
  ITERATIONS_DIR,
  fmtPct,
  distributionFromVerdicts,
  loadPartnerTrajectory,
  summarisePartnerTrajectory,
  writeFinalReport,
  formatCrossPartnerExtraction,
};
