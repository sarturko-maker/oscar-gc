// Sprint 32 (ADR-109): scenario registry loader.
// Each scenario JSON lives at evals/matter-runtime/scenarios/<slug>.json
// and is consumed by run-cell.js (Phase A) + judge-system.md (Phase B).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EVAL_ROOT, '..', '..');
const SCENARIOS_DIR = path.join(EVAL_ROOT, 'scenarios');

const SPRINT_32_SCENARIOS = ['30-rfq', '30-ndas', 'negative-control', 'playbook-mismatch'];
const FLOOR_SCENARIOS = ['30-rfq', '30-ndas'];

function loadScenario(slug) {
  const file = path.join(SCENARIOS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) throw new Error(`Scenario not found: ${slug} (looked at ${file})`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return resolvePaths(raw);
}

function resolvePaths(scenario) {
  const resolved = { ...scenario };
  if (scenario.fixture_dir) {
    resolved.fixture_dir_abs = path.resolve(REPO_ROOT, scenario.fixture_dir);
  }
  if (scenario.playbook_dir) {
    resolved.playbook_dir_abs = path.resolve(REPO_ROOT, scenario.playbook_dir);
  }
  return resolved;
}

function listScenarios() {
  return SPRINT_32_SCENARIOS.map(loadScenario);
}

function listFloorScenarios() {
  return FLOOR_SCENARIOS.map(loadScenario);
}

function promptEvents(scenario) {
  return scenario.events.filter((e) => e.kind === 'prompt');
}

function fixtureDropEvents(scenario) {
  return scenario.events.filter((e) => e.kind === 'fixture_drop');
}

module.exports = {
  SPRINT_32_SCENARIOS,
  FLOOR_SCENARIOS,
  SCENARIOS_DIR,
  loadScenario,
  listScenarios,
  listFloorScenarios,
  promptEvents,
  fixtureDropEvents,
};
