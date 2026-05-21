// Sprint 24-B (ADR-079 pipeline shape; ADR-080 precedent-board persistence):
// Lavern Pipeline parent recipe builder. Mirrors buildOscarLLPPartnerRecipe
// but constructs the parent recipe that orchestrates Watchman → Reader →
// (optional) Curator via delegate(). All three stage YAMLs live alongside
// verification-pass.yaml at <resources>/sub-recipes/.
//
// Inheritance contract (ADR-074): sub-recipes inherit the parent's extension
// loadout. The parent declares oscar-fs + oscar-document-reader + oscar-
// grounding-verifier + oscar-baselines once; all three stage sub-recipes get
// them. oscar-baselines carries OSCAR_BASELINES_DIR pointing at the per-user-
// per-area precedent-board state path (ADR-080).
//
// Title prefix "Oscar LLP — Lavern Pipeline" auto-trusts via the three-way OR
// trust-bypass widened in ADR-078; no preload.ts edit needed.

import type { ExtensionConfig, Recipe } from '../../../api';
import type { OscarCompanyContext, OscarUserProfile } from '../hooks/useOscarProfile';
import { buildTavilyExtension } from '../onboarding/onboardingRecipe';
import { renderCompanyContextBlock } from '../recipe/companyContextBlock';
import { renderUserIdentityBlock } from './userIdentityBlock';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';
const DEV_RESOURCES_ROOT = '/srv/projects/oscar-gc-lavern/ui/desktop/src/resources';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

function resolveOscarMcpBundle(resourcesRoot: string | null, name: string): string {
  const root = resourcesRoot ?? DEV_RESOURCES_ROOT;
  return `${root}/mcps/${name}/index.js`;
}

function resolveSubRecipePath(resourcesRoot: string | null, name: string): string {
  const root = resourcesRoot ?? DEV_RESOURCES_ROOT;
  return `${root}/sub-recipes/${name}.yaml`;
}

const PIPELINE_INSTRUCTIONS = `You are the orchestrator of the Lavern Pipeline — a multi-stage contract-analysis pipeline lifted-and-adapted from Lavern (Apache 2.0, AnttiHero/lavern@7c2efe61524b). Documents come in via the doc_paths parameter, one absolute path per line.

For each document, in order:

  1. Call delegate(source: "watchman", parameters: {doc_path: <path>}).
     It returns a JSON object {documentType, jurisdiction, route, ...}.
     Parse it. Capture documentType, jurisdiction, route.

  2. If route == "skip":
       Record the skip reason and move to the next document.
     If route == "quick-scan" or "deep-read":
       Call delegate(source: "reader", parameters: {
         doc_path: <path>,
         document_type: <from-watchman>,
         jurisdiction: <from-watchman>,
       }).
     It returns markdown — the Lavern Reader report. Capture it verbatim.

After all documents are processed, count how many you analysed (excluding skips).

  3. If count >= 2:
       Call delegate(source: "curator", parameters: {
         reader_summaries: <concatenation of the Reader outputs>,
       }).
     The Curator returns either ONE short cross-document paragraph OR a single
     "no pattern" sentence.
  4. Otherwise (count < 2):
       Do not invoke Curator. State that single-document mode skipped Curator.

Your final reply uses this exact structure:

## Lavern Pipeline Run

### Watchman triage
- <doc-1 filename>: type=<X>, jurisdiction=<Y>, route=<R>
- <doc-2 filename>: ...

### Per-document Reader reports

#### <doc-1 filename>
<verbatim Reader markdown for doc-1>

---

#### <doc-2 filename>
<verbatim Reader markdown for doc-2>

### Cross-document synthesis (Curator)
<Curator output OR "Single document — Curator skipped." OR "Multi-document but no cross-document pattern.">

Do not editorialise. Do not add prefacing commentary. The stages do the thinking; you marshal their outputs.`;

export interface BuildLavernPipelineRecipeOptions {
  docPaths: string[];
  workingDir: string;
  precedentsDir: string;
  resourcesRoot: string | null;
  user?: OscarUserProfile['user'] | null;
  corporate?: OscarUserProfile['corporate'] | null;
  companyContext?: OscarCompanyContext | null;
  enabledPlatformExtensions?: ExtensionConfig[];
}

export function buildLavernPipelineRecipe(opts: BuildLavernPipelineRecipeOptions): Recipe {
  const nodeCmd = resolveNodeCmd(opts.resourcesRoot);

  const extensions: NonNullable<Recipe['extensions']> = [
    {
      type: 'stdio',
      name: 'oscar-fs',
      description: 'Filesystem scoped to the Lavern Pipeline working folder.',
      cmd: nodeCmd,
      args: [resolveOscarFsBundle(opts.resourcesRoot), opts.workingDir],
      envs: {},
      timeout: 30,
    },
    ...(opts.enabledPlatformExtensions ?? []),
    buildTavilyExtension(),
    {
      type: 'stdio',
      name: 'oscar-document-reader',
      description:
        'Per-document navigation — list_documents, read_document_section, search_document, get_defined_terms, get_document_tables, read_document_head.',
      cmd: nodeCmd,
      args: [resolveOscarMcpBundle(opts.resourcesRoot, 'oscar-document-reader')],
      envs: {},
      timeout: 30,
    },
    {
      type: 'stdio',
      name: 'oscar-grounding-verifier',
      description: 'Mechanical citation-grounding verifier. Zero LLM cost.',
      cmd: nodeCmd,
      args: [resolveOscarMcpBundle(opts.resourcesRoot, 'oscar-grounding-verifier')],
      envs: {},
      timeout: 30,
    },
    {
      type: 'stdio',
      name: 'oscar-baselines',
      description:
        'Precedent-board substrate (Sprint 24-B / ADR-080). OSCAR_BASELINES_DIR scopes the store per-user-per-area.',
      cmd: nodeCmd,
      args: [resolveOscarMcpBundle(opts.resourcesRoot, 'oscar-baselines')],
      envs: { OSCAR_BASELINES_DIR: opts.precedentsDir },
      timeout: 30,
    },
  ];

  const identityBlock = renderUserIdentityBlock(opts.user, opts.corporate);
  const companyBlock = renderCompanyContextBlock(opts.companyContext);
  const docPathsBlock = `## Documents to analyse\n\n${opts.docPaths.map((p) => `- ${p}`).join('\n')}`;
  const instructions = [identityBlock, companyBlock, docPathsBlock, PIPELINE_INSTRUCTIONS]
    .filter((s): s is string => Boolean(s))
    .join('\n\n');

  return {
    version: '1.0.0',
    title: 'Oscar LLP — Lavern Pipeline',
    description:
      'Contract-analysis pipeline: Watchman classifies + routes; Reader analyses per-clause + synthesises; Curator surfaces cross-document patterns on portfolios of 2+ docs.',
    instructions,
    extensions,
    sub_recipes: [
      {
        name: 'watchman',
        path: resolveSubRecipePath(opts.resourcesRoot, 'lavern-watchman'),
        description: 'Per-document triage: documentType, jurisdiction, route.',
      },
      {
        name: 'reader',
        path: resolveSubRecipePath(opts.resourcesRoot, 'lavern-reader'),
        description: 'Per-clause analysis + synthesis using documentType-specific template.',
      },
      {
        name: 'curator',
        path: resolveSubRecipePath(opts.resourcesRoot, 'lavern-curator'),
        description: 'Cross-document surface decision (stub for 24-B; substantive in 25).',
      },
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
      max_turns: 40,
    },
  };
}
