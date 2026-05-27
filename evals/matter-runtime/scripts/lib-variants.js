// Sprint 32 (ADR-109): variant registry.
// Variants are doctrine snapshots — commit SHAs of ui/desktop/src/components/oscar/recipe/discoveryDoctrine.ts.
// Build via scripts/build-variant.sh; binaries cached at binaries/variant-<id>/.

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EVAL_ROOT, '..', '..');
const BINARIES_DIR = path.join(EVAL_ROOT, 'binaries');

const VARIANTS = {
  A: {
    id: 'A',
    commit_sha: '04dd9ae72',
    label: 'Sprint 31 doctrine (pre-ADR-108)',
    discovery_doctrine_lines_expected: 87,
    doctrine_summary: 'Sprint 31 ADR-104 doctrine: three trigger paragraphs (playbook / skill / delegate), each with bounded positive trigger + negative guard.',
    binary_dir: path.join(BINARIES_DIR, 'variant-A', 'Oscar-GC-linux-x64'),
    binary_path: path.join(BINARIES_DIR, 'variant-A', 'Oscar-GC-linux-x64', 'oscar-gc'),
  },
  B: {
    id: 'B',
    commit_sha: 'd88ef8df6',
    label: 'Sprint 31B doctrine (ADR-108 refinements)',
    discovery_doctrine_lines_expected: 135,
    doctrine_summary: "Sprint 31 doctrine + three ADR-108 refinements: (1) slug exactness for load_skill, (2) agent-loop semantics for delegate (N tool calls per message != parallel), (3) act-don't-describe (next message must be the tool call, not a prose plan).",
    binary_dir: path.join(BINARIES_DIR, 'variant-B', 'Oscar-GC-linux-x64'),
    binary_path: path.join(BINARIES_DIR, 'variant-B', 'Oscar-GC-linux-x64', 'oscar-gc'),
  },
  C: {
    id: 'C',
    commit_sha: '9ea8939d8',
    label: 'Sprint 33 Candidate C (slug-exactness recalibration)',
    discovery_doctrine_lines_expected: 134,
    doctrine_summary: "Variant B doctrine with ADR-108 fix 1's four-item NEVER list (never path / never prefix / never description / never filename) replaced by a positive imperative + single targeted exclusion + preserved availability discipline. Per docs/sprint-33/research-memo.md Section 6 — Anthropic 'tell what to do, not what not to do', Pink Elephant size-vs-negation finding (arXiv:2503.22395) predicting the MiniMax+/Haiku- asymmetry, and Anthropic skill-creator 'positive trigger + targeted exclusion' pattern.",
    binary_dir: path.join(BINARIES_DIR, 'variant-C', 'Oscar-GC-linux-x64'),
    binary_path: path.join(BINARIES_DIR, 'variant-C', 'Oscar-GC-linux-x64', 'oscar-gc'),
  },
};

function getVariant(id) {
  const v = VARIANTS[id];
  if (!v) throw new Error(`Unknown variant: ${id} (expected one of: ${Object.keys(VARIANTS).join(', ')})`);
  return v;
}

function listVariants() {
  return Object.values(VARIANTS);
}

function variantBinaryExists(id) {
  return fs.existsSync(getVariant(id).binary_path);
}

module.exports = {
  REPO_ROOT,
  BINARIES_DIR,
  VARIANTS,
  getVariant,
  listVariants,
  variantBinaryExists,
};
