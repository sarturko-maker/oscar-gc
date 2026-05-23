// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078): Oscar LLP partner
// recipe builder. Mirrors buildPracticeAreaRecipe but for the partner-consult
// use case:
//  - working_dir is per-partner (~/Documents/Oscar GC/Oscar LLP/<slug>/);
//    Goose Memory's agent-working-dir meta scoping gives automatic per-partner
//    memory isolation under <workingDir>/.goose/memory/
//  - no separate state folder (partners are simpler than matters; no
//    matter.md or history.md to track)
//  - instructions stack: userIdentityBlock + companyContextBlock + persona
//  - title prefix "Oscar LLP —" gates the bundled-trust short-circuit (ADR-029
//    widened across two sprints in preload.ts; "Lavern —" still recognized
//    through Sprint 24-A for legacy session resume, dropped Sprint 25)
//  - settings pin to MiniMax-M2.5 (same as practice-area recipes)

import type { ExtensionConfig, Recipe } from '../../../api';
import type { OscarLLPPartner } from './partners';
import type { OscarCompanyContext, OscarUserProfile } from '../hooks/useOscarProfile';
import { buildTavilyExtension } from '../onboarding/onboardingRecipe';
import { renderCompanyContextBlock } from '../recipe/companyContextBlock';
import { renderUserIdentityBlock } from './userIdentityBlock';
import { VERIFICATION_GATE_BLOCK } from './verificationGateBlock';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';
// Sprint 22 (ADR-074, ADR-075): Lavern Tier-A MCPs and the verification-pass
// sub-recipe live alongside the rest of the bundle resources. Dev-time paths
// point at this checkout; runtime paths resolve via resourcesRoot.
const DEV_RESOURCES_ROOT = '/srv/projects/oscar-gc-lavern/ui/desktop/src/resources';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

function resolveOscarLlpMcpBundle(resourcesRoot: string | null, name: string): string {
  const root = resourcesRoot ?? DEV_RESOURCES_ROOT;
  return `${root}/mcps/${name}/index.js`;
}

function resolveSubRecipePath(resourcesRoot: string | null, name: string): string {
  const root = resourcesRoot ?? DEV_RESOURCES_ROOT;
  return `${root}/sub-recipes/${name}.yaml`;
}

// Sprint 22 (ADR-074): six Tier-A MCPs (Lavern's Tier-A classification per
// ADR-073) attach to every Oscar LLP partner recipe. Per-partner curation
// deferred (uniform loadout for the dogfood); see ADR-074 rationale.
const OSCAR_LLP_TIER_A_MCPS: ReadonlyArray<{ name: string; description: string; timeout: number }> = [
  {
    name: 'oscar-knowledge-base',
    description: 'Search bundled legal-corpus knowledge base (SaaS precedents, M&A playbook, GDPR baselines).',
    timeout: 30,
  },
  {
    name: 'oscar-document-reader',
    description: 'Structured navigation of bundled sample documents — list_documents, read_document_section, search_document, defined terms, tables.',
    timeout: 30,
  },
  {
    name: 'oscar-risk-pricing',
    description: 'Benchmark a clause value (liability cap, indemnity basket, survival, etc.) against mid-market US distributions.',
    timeout: 30,
  },
  {
    name: 'oscar-baselines',
    description: 'Record observations and check values against accumulated baseline distributions.',
    timeout: 30,
  },
  {
    name: 'oscar-grounding-verifier',
    description: 'Mechanically verify citation grounding (section refs + quoted text) against a document. Zero LLM cost.',
    timeout: 30,
  },
  {
    name: 'oscar-document-checks',
    description: 'Computational structure + formatting checks: heading hierarchy, numbering, cross-references, defined-term consistency.',
    timeout: 30,
  },
];

export interface BuildOscarLLPPartnerRecipeOptions {
  partner: OscarLLPPartner;
  workingDir: string;
  resourcesRoot: string | null;
  user?: OscarUserProfile['user'] | null;
  corporate?: OscarUserProfile['corporate'] | null;
  companyContext?: OscarCompanyContext | null;
  // Sprint 18 (ADR-065): platform extensions the user has enabled in
  // config.yaml. Threaded by OscarLLPRoster from ConfigContext.extensionsList
  // via deriveEnabledPlatformExtensions.
  enabledPlatformExtensions?: ExtensionConfig[];
}

export function buildOscarLLPPartnerRecipe(opts: BuildOscarLLPPartnerRecipeOptions): Recipe {
  const nodeCmd = resolveNodeCmd(opts.resourcesRoot);
  const oscarLlpMcpExtensions: ExtensionConfig[] = OSCAR_LLP_TIER_A_MCPS.map((mcp) => ({
    type: 'stdio',
    name: mcp.name,
    description: mcp.description,
    cmd: nodeCmd,
    args: [resolveOscarLlpMcpBundle(opts.resourcesRoot, mcp.name)],
    envs: {},
    timeout: mcp.timeout,
  }));

  const extensions: NonNullable<Recipe['extensions']> = [
    {
      type: 'stdio',
      name: 'oscar-fs',
      description: `Filesystem scoped to ${opts.partner.name}'s working folder.`,
      cmd: nodeCmd,
      args: [resolveOscarFsBundle(opts.resourcesRoot), opts.workingDir],
      envs: {},
      timeout: 30,
    },
    ...(opts.enabledPlatformExtensions ?? []),
    buildTavilyExtension(),
    ...oscarLlpMcpExtensions,
  ];

  const identityBlock = renderUserIdentityBlock(opts.user, opts.corporate);
  const companyBlock = renderCompanyContextBlock(opts.companyContext);
  const instructions = [
    identityBlock,
    companyBlock,
    opts.partner.systemPrompt.trim(),
    VERIFICATION_GATE_BLOCK,
  ]
    .filter((s): s is string => Boolean(s))
    .join('\n\n');

  return {
    version: '1.0.0',
    title: `Oscar LLP — ${opts.partner.name}`,
    description: `${opts.partner.specialism} specialist at Oscar LLP, consulted by your in-house team.`,
    instructions,
    extensions,
    // Sprint 22 (ADR-074): verification-pass sub-recipe enables `delegate()`
    // invocation via the auto-injected summon extension (Goose recipe/mod.rs
    // ensures summon when sub_recipes is non-empty).
    sub_recipes: [
      {
        name: 'verification-pass',
        path: resolveSubRecipePath(opts.resourcesRoot, 'verification-pass'),
        description:
          'Pre-delivery citation-grounding + structural-check pass. Invoke before delivering substantive analysis.',
      },
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
      // Sprint 23 (ADR-076): substrate safety ceiling for the Ralph Loop
      // gate-and-revise discipline. Caps the worst case where the LLM enters
      // an uncapped revision loop on ISSUES; sized for "initial response +
      // 2 revisions + escalation" with tool turns in between.
      max_turns: 12,
    },
  };
}
