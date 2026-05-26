#!/usr/bin/env node
// Sprint 32 (ADR-109): programmatic judge for the observable-only rubric.
// Reads transcript.json + scenario expectations; emits judge-verdict.json.
//
// Per ADR-082, judging happens via Claude Code under Max. Sprint 32's rubric
// is observable-only ("did tool X fire with arg Y?") — for that shape, a
// programmatic extractor IS the doctrine-masked judge by construction (it has
// no doctrine priors). CC reviews the per-cell aggregate + writes
// extra_observations for patterns the structured fields miss.
//
// Usage:
//   node evals/matter-runtime/scripts/judge-cycle.js \
//     --cell evals/matter-runtime/iterations/variant-A/MiniMax-M2.5/30-rfq
//
// Writes judge-verdict.json per cycle in the cell.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const lib_scenarios = require('./lib-scenarios');

function parseArgs() {
  const args = { cell: null, scenario: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cell') args.cell = argv[++i];
    else if (argv[i] === '--scenario') args.scenario = argv[++i];
  }
  if (!args.cell) throw new Error('missing --cell <path>');
  return args;
}

function extractToolCalls(transcript) {
  const calls = [];
  for (const msg of transcript) {
    if (msg.role !== 'assistant') continue;
    for (const block of msg.blocks || []) {
      if (block.type === 'toolRequest') {
        const v = block.toolCall?.value;
        if (v) calls.push({ tool: v.name, args: v.arguments, ts: msg.timestamp });
      }
    }
  }
  return calls;
}

function lastBasename(p) {
  if (!p) return '';
  const parts = String(p).split('/');
  return parts[parts.length - 1].toLowerCase();
}

function judgeCycle({ cycleDir, scenario }) {
  const transcriptPath = path.join(cycleDir, 'transcript.json');
  const manifestPath = path.join(cycleDir, 'manifest.json');
  if (!fs.existsSync(transcriptPath) || !fs.existsSync(manifestPath)) return null;

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const calls = extractToolCalls(transcript);

  const exp = scenario.expectations;
  const expectedPlaybook = exp.playbook.should_fire; // filename string or null
  const notFirePlaybooks = exp.playbook.should_not_fire || [];
  const expectedSkillSlug = exp.skill.canonical_slug;
  const skillShouldFire = exp.skill.should_fire === true;
  const delegateShouldFire = exp.delegate.should_fire === true;
  const redlineShouldFire = exp.redline.should_be_invoked === true;

  // 1) playbook reads (oscar-fs__read_file under .config/oscar/playbooks/)
  const playbookReads = calls
    .filter((c) => c.tool === 'oscar-fs__read_file')
    .map((c) => lastBasename(c.args?.path))
    .filter((bn) => bn && bn.endsWith('.md') && bn.includes('playbook'));

  const playbookRelevantFired = expectedPlaybook
    ? playbookReads.includes(expectedPlaybook.toLowerCase())
    : false;
  const playbookIrrelevantFired = playbookReads.some((bn) =>
    notFirePlaybooks.length > 0
      ? notFirePlaybooks.map((s) => s.toLowerCase()).includes(bn)
      : bn !== (expectedPlaybook || '').toLowerCase(),
  );
  const playbookRelevantWhich = playbookRelevantFired ? expectedPlaybook : null;
  const playbookIrrelevantWhich = playbookIrrelevantFired
    ? playbookReads.find(
        (bn) => bn !== (expectedPlaybook || '').toLowerCase(),
      ) || null
    : null;

  // 2) load_skill calls
  const skillCalls = calls.filter((c) => c.tool === 'load_skill');
  const skillFired = skillCalls.length > 0;
  const skillArg = skillCalls[0]?.args?.name || null;
  const skillArgCorrect = expectedSkillSlug
    ? skillArg === expectedSkillSlug
    : false;
  const skillNoise = !skillShouldFire && skillFired;

  // 3) delegate calls
  const delegateCalls = calls.filter((c) => c.tool === 'delegate');
  const delegateFired = delegateCalls.length > 0;
  const delegateCount = delegateCalls.length;
  // strategy: heuristic — if instructions param references 1 item, "one_per_item";
  // if mentions multiple items in one call, "partition"; else "none"
  let delegateStrategy = 'none';
  if (delegateCount >= 2) delegateStrategy = 'one_per_item';
  else if (delegateCount === 1) {
    const inst = String(delegateCalls[0].args?.instructions || '');
    delegateStrategy = inst.match(/\b\d+\.\s|\bnda-/g)?.length > 1 ? 'partition' : 'one_per_item';
  }
  const delegateNoise = !delegateShouldFire && delegateFired;

  // 4) redline batch
  const redlineCalls = calls.filter((c) => c.tool === 'redline__process_document_batch');
  const redlineFired = redlineCalls.length > 0;
  const redlineSucceeded = redlineFired
    ? !redlineCalls.some((c) => /error|fail/i.test(JSON.stringify(c.args || {})))
    : null;

  // Compose verdict
  const verdict = {
    cycle_id: manifest.cycle_id,
    session_id: manifest.session_id,
    playbook_read_on_relevant_turn: {
      fired: playbookRelevantFired,
      which: playbookRelevantWhich,
    },
    playbook_read_on_irrelevant_turn: {
      fired: playbookIrrelevantFired,
      which: playbookIrrelevantWhich,
    },
    skill_invoked_when_applicable: {
      fired: skillShouldFire && skillFired,
      which: skillShouldFire && skillFired ? skillArg : null,
    },
    skill_invoked_when_not_applicable: {
      fired: skillNoise,
      which: skillNoise ? skillArg : null,
    },
    skill_arg_correct: {
      fired: skillShouldFire && skillFired ? skillArgCorrect : false,
      passed_arg: skillArg,
      canonical_slug: expectedSkillSlug,
    },
    delegate_used_when_applicable: {
      fired: delegateShouldFire && delegateFired,
      count: delegateShouldFire && delegateFired ? delegateCount : 0,
      scope_per: delegateShouldFire && delegateFired
        ? `${delegateCount} delegate call(s); see transcript for instruction shape`
        : '',
    },
    delegate_used_when_not_applicable: {
      fired: delegateNoise,
      count: delegateNoise ? delegateCount : 0,
    },
    delegate_strategy: delegateStrategy,
    redline_invoked_when_asked: redlineShouldFire ? redlineFired : false,
    redline_succeeded_when_invoked: redlineFired ? redlineSucceeded : null,
    extra_observations: '',
    _judge: 'programmatic-v1',
    _tool_call_count: calls.length,
  };

  // Auto-flag patterns into extra_observations
  const notes = [];
  if (calls.length === 0) notes.push('no tool calls — agent did not engage tools');
  if (skillFired && !skillArgCorrect && expectedSkillSlug)
    notes.push(`skill arg ${JSON.stringify(skillArg)} != canonical ${JSON.stringify(expectedSkillSlug)}`);
  if (delegateShouldFire && !delegateFired)
    notes.push('delegate expected but missed (serial reads instead)');
  if (redlineShouldFire && !redlineFired)
    notes.push('redline expected but never invoked');
  if (redlineFired && redlineSucceeded === false)
    notes.push('redline invoked but rejected at tool layer');
  verdict.extra_observations = notes.join('; ').slice(0, 300);

  return verdict;
}

function main() {
  const args = parseArgs();
  const cellDir = path.resolve(args.cell);
  if (!fs.existsSync(cellDir)) throw new Error(`cell dir missing: ${cellDir}`);

  // Resolve scenario from path. Pattern: .../variant-X/<model>/<scenario>/
  const parts = cellDir.split('/');
  const scenarioSlug = args.scenario || parts[parts.length - 1];
  const scenario = lib_scenarios.loadScenario(scenarioSlug);

  const cycleDirs = fs
    .readdirSync(cellDir)
    .filter((n) => /^cycle-\d{2}$/.test(n))
    .sort()
    .map((n) => path.join(cellDir, n));

  let ok = 0;
  let skipped = 0;
  for (const cd of cycleDirs) {
    const v = judgeCycle({ cycleDir: cd, scenario });
    if (!v) {
      skipped += 1;
      continue;
    }
    fs.writeFileSync(path.join(cd, 'judge-verdict.json'), JSON.stringify(v, null, 2), 'utf8');
    ok += 1;
  }
  console.log(`[judge] cell ${cellDir}: ${ok} verdicts written, ${skipped} cycles skipped`);
}

try {
  main();
} catch (err) {
  console.error('[judge] FAIL:', err.message ?? err);
  process.exit(1);
}
