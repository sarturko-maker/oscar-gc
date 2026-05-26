#!/usr/bin/env node
// Sprint 32 (ADR-109): Phase C — aggregate per-cycle judge verdicts into the
// Sprint 32 baseline report.
//
// Usage:
//   node evals/matter-runtime/scripts/aggregate-report.js --out reports/sprint-32-baseline.md

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');

function parseArgs() {
  const args = { out: 'reports/sprint-32-baseline.md' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

function listCells() {
  const cells = [];
  for (const variantDirName of fs.readdirSync(ITERATIONS_DIR)) {
    if (!variantDirName.startsWith('variant-')) continue;
    const variantDir = path.join(ITERATIONS_DIR, variantDirName);
    for (const modelName of fs.readdirSync(variantDir)) {
      const modelDir = path.join(variantDir, modelName);
      if (!fs.statSync(modelDir).isDirectory()) continue;
      for (const scenarioName of fs.readdirSync(modelDir)) {
        const scenarioDir = path.join(modelDir, scenarioName);
        if (!fs.statSync(scenarioDir).isDirectory()) continue;
        cells.push({
          variant: variantDirName.replace('variant-', ''),
          model: modelName.replace('__', '/'),
          scenario: scenarioName,
          path: scenarioDir,
        });
      }
    }
  }
  return cells;
}

function loadVerdicts(cellDir) {
  const verdicts = [];
  for (const name of fs.readdirSync(cellDir)) {
    if (!/^cycle-\d{2}$/.test(name)) continue;
    const file = path.join(cellDir, name, 'judge-verdict.json');
    if (fs.existsSync(file)) verdicts.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return verdicts;
}

function summariseCell(cell) {
  const verdicts = loadVerdicts(cell.path);
  if (verdicts.length === 0) return { ...cell, n: 0, signals: null };

  const sigForBool = (path) => {
    const fired = verdicts.filter((v) => {
      let x = v;
      for (const k of path) x = x?.[k];
      return x === true;
    }).length;
    return { fired, total: verdicts.length, rate: (fired / verdicts.length).toFixed(2) };
  };

  const signals = {
    playbook_relevant: sigForBool(['playbook_read_on_relevant_turn', 'fired']),
    playbook_noise: sigForBool(['playbook_read_on_irrelevant_turn', 'fired']),
    skill_applicable: sigForBool(['skill_invoked_when_applicable', 'fired']),
    skill_noise: sigForBool(['skill_invoked_when_not_applicable', 'fired']),
    skill_arg_correct: sigForBool(['skill_arg_correct', 'fired']),
    delegate_applicable: sigForBool(['delegate_used_when_applicable', 'fired']),
    delegate_noise: sigForBool(['delegate_used_when_not_applicable', 'fired']),
    redline_invoked: sigForBool(['redline_invoked_when_asked']),
  };

  const sn = (fire, noise) => {
    if (fire.fired + noise.fired === 0) return '—';
    return (fire.fired / (fire.fired + noise.fired)).toFixed(2);
  };

  signals.s2n_playbook = sn(signals.playbook_relevant, signals.playbook_noise);
  signals.s2n_skill = sn(signals.skill_applicable, signals.skill_noise);
  signals.s2n_delegate = sn(signals.delegate_applicable, signals.delegate_noise);

  return { ...cell, n: verdicts.length, signals };
}

function renderReport(cells) {
  const lines = [];
  lines.push('# Sprint 32 — Matter-runtime eval baseline report\n');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cells aggregated: ${cells.length}\n`);
  lines.push('Per [[ADR-109]]. Signal-to-noise per affordance per cell.\n');

  // Group by scenario
  const byScenario = {};
  for (const c of cells) {
    (byScenario[c.scenario] ||= []).push(c);
  }
  for (const scenario of Object.keys(byScenario).sort()) {
    lines.push(`## Scenario: ${scenario}\n`);
    lines.push('| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |');
    lines.push('|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|');
    for (const c of byScenario[scenario].sort((a, b) => a.variant.localeCompare(b.variant) || a.model.localeCompare(b.model))) {
      const s = c.signals;
      if (!s) {
        lines.push(`| ${c.variant} | ${c.model} | 0 | _no verdicts_ | | | | | | | | | | |`);
        continue;
      }
      lines.push(`| ${c.variant} | ${c.model} | ${c.n} | ${s.playbook_relevant.fired}/${c.n} | ${s.playbook_noise.fired}/${c.n} | ${s.skill_applicable.fired}/${c.n} | ${s.skill_noise.fired}/${c.n} | ${s.skill_arg_correct.fired}/${c.n} | ${s.delegate_applicable.fired}/${c.n} | ${s.delegate_noise.fired}/${c.n} | ${s.redline_invoked.fired}/${c.n} | ${s.s2n_playbook} | ${s.s2n_skill} | ${s.s2n_delegate} |`);
    }
    lines.push('');
  }

  lines.push('\n## Per-fix verdicts (ADR-108 refinements at scale)\n');
  lines.push('Sprint 31B applied three doctrine fixes. Variant A = pre-fix; Variant B = post-fix.\n');
  lines.push('- **Fix 1 — slug exactness for `load_skill`**: compare `skill_arg_correct.fired` between A and B on `30-ndas` cells per model.');
  lines.push('- **Fix 2 — agent-loop semantics for `delegate`**: compare `delegate_used_when_applicable.fired` between A and B on `30-ndas` per model.');
  lines.push('- **Fix 3 — act don\'t describe (redline)**: compare `redline_invoked_when_asked` between A and B on `30-rfq` per model.');
  lines.push('');
  lines.push('Verdict per fix: held at scale / did not hold / non-determinism — populated by hand from the per-scenario tables above.\n');

  lines.push('## Open caveats\n');
  lines.push('- Haiku 4.5 ≠ Sonnet 4.6 (Sprint 31A/B Anthropic baseline). Cross-sprint Anthropic-cell comparison is directional only.');
  lines.push('- GPT-5.4-mini cell deferred to Sprint 32b (OpenRouter cost).');
  lines.push('- Negative-discrimination scenarios (negative-control, playbook-mismatch) run MiniMax-only — Haiku baseline TBD in Sprint 32b.');
  lines.push('- MiniMax model — see ADR-109 + Phase 0 verification note (M2.5 PAYG vs M2.7 Token Plan; Sprint 32 commits to whichever the dev key serves).');

  return lines.join('\n') + '\n';
}

function main() {
  const args = parseArgs();
  const cells = listCells().map(summariseCell);
  const report = renderReport(cells);
  const outAbs = path.isAbsolute(args.out) ? args.out : path.join(EVAL_ROOT, args.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, report, 'utf8');
  console.log(`[aggregate] wrote ${outAbs} (cells=${cells.length}, populated=${cells.filter(c => c.signals).length})`);
}

try {
  main();
} catch (err) {
  console.error('[aggregate] FAIL:', err.message ?? err);
  process.exit(1);
}
