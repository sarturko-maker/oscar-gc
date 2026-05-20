// Sprint 23 (ADR-077): synthesized partner-recipe builder for the
// Lavern-baselined eval. Mirrors `ui/desktop/scripts/test-oscar-llp-agents.js`
// shape; adds support for the with-Ralph vs without-Ralph A/B by selecting
// between SPRINT_22_DIRECTIVE (frozen at SHA 08a5381a7 — the without-Ralph
// baseline) and RALPH_DIRECTIVE (the Sprint 23 paragraph — the with-Ralph
// configuration).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESOURCES = path.join(REPO_ROOT, 'ui', 'desktop', 'src', 'resources');
const MCPS_DIR = path.join(RESOURCES, 'mcps');
const SUB_RECIPE = path.join(RESOURCES, 'sub-recipes', 'verification-pass.yaml');
const KEY_FILE = '/root/.minimax-dev-key';
const NODE_CMD = '/usr/bin/node';

const TIER_A_MCPS = [
  'oscar-knowledge-base',
  'oscar-document-reader',
  'oscar-risk-pricing',
  'oscar-baselines',
  'oscar-grounding-verifier',
  'oscar-document-checks',
];

const PARTNERS = {
  'sarah-chen': {
    slug: 'sarah-chen',
    name: 'Sarah Chen',
    specialism: 'M&A',
    identity:
      'You are Sarah Chen, an M&A Specialist at Oscar LLP — a 50-person multidisciplinary legal firm. You think in transaction mechanics: conditions precedent, reps and warranties, indemnification baskets, escrow holdbacks, closing checklists.',
  },
  'helena-voss': {
    slug: 'helena-voss',
    name: 'Helena Voss',
    specialism: 'Privacy & Data Protection',
    identity:
      'You are Helena Voss, a Privacy & Data Protection Specialist at Oscar LLP. You think in data flows, lawful bases, processor obligations, and cross-border transfer mechanisms.',
  },
  'aisha-khan': {
    slug: 'aisha-khan',
    name: 'Aisha Khan',
    specialism: 'Commercial Litigation',
    identity:
      'You are Aisha Khan, a Commercial Litigation Specialist at Oscar LLP. You think in cause of action, burden of proof, remedies, discovery, and forum strategy.',
  },
};

const DOCS = {
  'doc1-borrowmoney': {
    id: 'doc1-borrowmoney',
    file: 'borrowmoneycom_06_11_2020.txt',
    contract_type: 'joint venture',
    rubric_file: 'doc1-borrowmoney.json',
  },
  'doc2-sibannac': {
    id: 'doc2-sibannac',
    file: 'sibannac_12_04_2017.txt',
    contract_type: 'strategic alliance / commission',
    rubric_file: 'doc2-sibannac.json',
  },
  'doc3-veoneer': {
    id: 'doc3-veoneer',
    file: 'veoneer_02_21_2020.txt',
    contract_type: 'JV amendment / wind-down',
    rubric_file: 'doc3-veoneer.json',
  },
};

// Sprint 22 verification directive, FROZEN verbatim at SHA 08a5381a7 as the
// without-Ralph baseline. Do not edit this constant; the A/B comparison
// requires a stable historical reference. If Sprint 22's directive ever
// needs updating, capture as SPRINT_22_DIRECTIVE_V2 and split the A/B.
const SPRINT_22_DIRECTIVE = [
  '',
  '## Verification before delivery',
  '',
  "Before delivering substantive analysis, invoke the `verification-pass` sub-recipe via the `delegate` tool with `source: 'verification-pass'`. Pass the relevant document text (fetched via `oscar-document-reader` or pasted by the user) and the specific findings or citations you intend to cite. Verification-pass runs deterministic checks (citation grounding via `oscar-grounding-verifier`; document-structure lint via `oscar-document-checks`) and returns a pass-or-issues result. Cite the verification result explicitly in your final response — what was grounded, what was flagged, and how you adjusted. For high-stakes outputs, also flag the assessment-band you received from `oscar-risk-pricing` when you cite a clause benchmark.",
].join('\n');

// Sprint 23 Ralph Loop directive (ADR-076). Must stay in lockstep with the
// verbatim paragraph in ui/desktop/src/components/oscar/oscar-llp/prompts/*.ts.
const RALPH_DIRECTIVE = [
  '',
  '## Verification gate (required before delivery)',
  '',
  "Before delivering substantive analysis, you MUST invoke the `verification-pass` sub-recipe via the `delegate` tool with `source: 'verification-pass'`. Pass the relevant document text (fetched via `oscar-document-reader` or pasted by the user) and the specific findings or citations you intend to cite.",
  '',
  'In your response, quote the first three lines of the verification-pass output verbatim — the `## Verification Pass: <PASS|ISSUES>` header and the Grounding / Structure lines — so the reviewer can audit what came back. Do not paraphrase this header; quote it exactly.',
  '',
  'If the quoted header contains the literal text `## Verification Pass: ISSUES`, you MUST NOT deliver the draft as-is. Revise the analysis to address every issue listed under "Issues to address" — drop citations that grounding-verifier could not find, replace weakly-grounded passages with grounded alternatives or narrower claims, and fix any structural problems flagged. Then re-invoke verification-pass on the revised draft.',
  '',
  'You have a budget of two revisions:',
  '- The first re-invocation after an ISSUES result is **revision 1 of 2**.',
  '- A second re-invocation after another ISSUES result is **revision 2 of 2**.',
  '- After two revisions, if verification-pass still returns `## Verification Pass: ISSUES`, you MUST stop revising and escalate.',
  '',
  'To escalate, do not deliver substantive analysis. Reply exactly:',
  '',
  '> I cannot ground this analysis to the source material after two revision attempts. Recommend human review by qualified legal counsel before relying on any conclusions in this thread.',
  '',
  'Then summarise, in plain prose, which findings could not be grounded and what the partner reviewer should look at first. Do not present ungrounded findings as conclusions — present them as items needing human verification.',
].join('\n');

function yamlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function loadDocText(docId) {
  const doc = DOCS[docId];
  if (!doc) throw new Error(`unknown doc: ${docId}`);
  return fs.readFileSync(path.join(EVAL_ROOT, 'docs', doc.file), 'utf8');
}

function loadPartnerQuestionTemplate() {
  return fs.readFileSync(path.join(EVAL_ROOT, 'prompts', 'partner-question.md'), 'utf8');
}

function buildPartnerQuestion(docId) {
  const doc = DOCS[docId];
  const text = loadDocText(docId);
  return loadPartnerQuestionTemplate()
    .replace('{{contract_type}}', doc.contract_type)
    .replace('{{document_text}}', text);
}

function buildPartnerRecipeYaml(partnerSlug, docId, workingDir, config) {
  const partner = PARTNERS[partnerSlug];
  const doc = DOCS[docId];
  if (!partner) throw new Error(`unknown partner: ${partnerSlug}`);
  if (!doc) throw new Error(`unknown doc: ${docId}`);
  if (!['with-ralph', 'without-ralph'].includes(config)) {
    throw new Error(`unknown config: ${config}`);
  }

  const directive = config === 'with-ralph' ? RALPH_DIRECTIVE : SPRINT_22_DIRECTIVE;
  const question = buildPartnerQuestion(docId);

  const lines = [
    'version: "1.0.0"',
    `title: "Oscar LLP — ${partner.name}"`,
    `description: "${yamlEscape(partner.specialism)} specialist at Oscar LLP — Sprint 23 eval (${docId}, ${config})."`,
    'prompt: |',
  ];
  for (const line of question.split('\n')) lines.push(`  ${line}`);
  lines.push('instructions: |');
  for (const block of [partner.identity, directive]) {
    for (const line of block.split('\n')) lines.push(`  ${line}`);
  }
  lines.push('extensions:');
  lines.push('  - type: stdio');
  lines.push('    name: oscar-fs');
  lines.push(`    description: "Filesystem scoped to ${partner.name}'s working folder."`);
  lines.push(`    cmd: "${NODE_CMD}"`);
  lines.push('    args:');
  lines.push(`      - "${MCPS_DIR}/oscar-fs/index.js"`);
  lines.push(`      - "${workingDir}"`);
  lines.push('    envs: {}');
  lines.push('    timeout: 30');
  for (const mcp of TIER_A_MCPS) {
    lines.push('  - type: stdio');
    lines.push(`    name: ${mcp}`);
    lines.push(`    description: "Sprint 22 Tier-A MCP: ${mcp}."`);
    lines.push(`    cmd: "${NODE_CMD}"`);
    lines.push('    args:');
    lines.push(`      - "${MCPS_DIR}/${mcp}/index.js"`);
    lines.push('    envs: {}');
    lines.push('    timeout: 30');
  }
  lines.push('sub_recipes:');
  lines.push('  - name: "verification-pass"');
  lines.push(`    path: "${SUB_RECIPE}"`);
  lines.push('    description: "Pre-delivery citation-grounding + structural-check pass."');
  lines.push('settings:');
  lines.push('  goose_provider: "minimax"');
  lines.push('  goose_model: "MiniMax-M2.5"');
  lines.push('  max_turns: 12');
  lines.push('');
  return lines.join('\n');
}

function resolveMinimaxKey() {
  let key = process.env.MINIMAX_API_KEY;
  if (!key && fs.existsSync(KEY_FILE)) {
    key = fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  if (!key) {
    throw new Error(`MINIMAX_API_KEY not in env and ${KEY_FILE} not present`);
  }
  return key;
}

module.exports = {
  EVAL_ROOT,
  REPO_ROOT,
  RESOURCES,
  MCPS_DIR,
  SUB_RECIPE,
  TIER_A_MCPS,
  PARTNERS,
  DOCS,
  SPRINT_22_DIRECTIVE,
  RALPH_DIRECTIVE,
  yamlEscape,
  loadDocText,
  buildPartnerQuestion,
  buildPartnerRecipeYaml,
  resolveMinimaxKey,
};
