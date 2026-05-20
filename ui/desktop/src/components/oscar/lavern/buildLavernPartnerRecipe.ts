// Sprint 21 (ADR-071): Lavern partner recipe builder. Mirrors
// buildPracticeAreaRecipe but for the partner-consult use case:
//  - working_dir is per-partner (~/Documents/Oscar GC/Lavern/<slug>/);
//    Goose Memory's agent-working-dir meta scoping gives automatic per-partner
//    memory isolation under <workingDir>/.goose/memory/
//  - no separate state folder (partners are simpler than matters; no
//    matter.md or history.md to track)
//  - instructions stack: userIdentityBlock + companyContextBlock + persona
//  - title prefix "Lavern —" gates the bundled-trust short-circuit (ADR-029
//    widened to recognize the new prefix in preload.ts)
//  - settings pin to MiniMax-M2.5 (same as practice-area recipes)

import type { ExtensionConfig, Recipe } from '../../../api';
import type { LavernPartner } from './partners';
import type { OscarCompanyContext, OscarUserProfile } from '../hooks/useOscarProfile';
import { buildTavilyExtension } from '../onboarding/onboardingRecipe';
import { renderCompanyContextBlock } from '../recipe/companyContextBlock';
import { renderUserIdentityBlock } from './userIdentityBlock';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

export interface BuildLavernPartnerRecipeOptions {
  partner: LavernPartner;
  workingDir: string;
  resourcesRoot: string | null;
  user?: OscarUserProfile['user'] | null;
  corporate?: OscarUserProfile['corporate'] | null;
  companyContext?: OscarCompanyContext | null;
  // Sprint 18 (ADR-065): platform extensions the user has enabled in
  // config.yaml. Threaded by LavernRoster from ConfigContext.extensionsList
  // via deriveEnabledPlatformExtensions.
  enabledPlatformExtensions?: ExtensionConfig[];
}

export function buildLavernPartnerRecipe(opts: BuildLavernPartnerRecipeOptions): Recipe {
  const extensions: NonNullable<Recipe['extensions']> = [
    {
      type: 'stdio',
      name: 'oscar-fs',
      description: `Filesystem scoped to ${opts.partner.name}'s working folder.`,
      cmd: resolveNodeCmd(opts.resourcesRoot),
      args: [resolveOscarFsBundle(opts.resourcesRoot), opts.workingDir],
      envs: {},
      timeout: 30,
    },
    ...(opts.enabledPlatformExtensions ?? []),
    buildTavilyExtension(),
  ];

  const identityBlock = renderUserIdentityBlock(opts.user, opts.corporate);
  const companyBlock = renderCompanyContextBlock(opts.companyContext);
  const instructions = [identityBlock, companyBlock, opts.partner.systemPrompt.trim()]
    .filter((s): s is string => Boolean(s))
    .join('\n\n');

  return {
    version: '1.0.0',
    title: `Lavern — ${opts.partner.name}`,
    description: `${opts.partner.specialism} specialist at Lavern, consulted by your in-house team.`,
    instructions,
    extensions,
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
