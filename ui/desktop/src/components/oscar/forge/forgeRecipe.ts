// Sprint 12 (ADR-039): Forge meta-agent recipe. Scoped to ~/.agents/skills/
// + ~/.config/oscar/; no Developer, no memory, no onboarding, no redline.
// Title prefix "Oscar GC —" gates the bundled-trust short-circuit (ADR-029).
//
// Sprint 18 (ADR-063, ADR-065): Forge takes the user's enabled-platform set
// like practice areas, AND force-includes 'code_execution' + 'Extension
// Manager' even if the user has them off in Extensions UI. Forge's job is
// wiring new agents and managing extensions; those two capabilities are
// load-bearing for Forge specifically.

import type { ExtensionConfig, Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';
import { nameToKey } from '../../settings/extensions/utils';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

const FORGE_MANDATED_PLATFORMS: ReadonlyArray<{
  name: string;
  display_name: string;
  description: string;
}> = [
  {
    name: 'Extension Manager',
    display_name: 'Extension Manager',
    description:
      'Enable extension management tools for discovering, enabling, and disabling extensions',
  },
  {
    name: 'code_execution',
    display_name: 'Code Mode',
    description:
      'Goose will make extension calls through code execution, saving tokens',
  },
];

function ensureForgePlatforms(enabled: ExtensionConfig[]): ExtensionConfig[] {
  const has = (name: string): boolean =>
    enabled.some(
      (e) =>
        (e.type === 'platform' || e.type === 'builtin') &&
        nameToKey(e.name) === nameToKey(name),
    );
  const result = [...enabled];
  for (const mandate of FORGE_MANDATED_PLATFORMS) {
    if (has(mandate.name)) continue;
    result.push({
      type: 'platform',
      name: mandate.name,
      description: mandate.description,
      display_name: mandate.display_name,
      bundled: true,
      available_tools: [],
    });
  }
  return result;
}

export function buildForgeRecipe(
  homeDir: string,
  resourcesRoot: string | null,
  enabledPlatformExtensions: ExtensionConfig[] = [],
): Recipe {
  const skillsDir = `${homeDir}/.agents/skills`;
  const oscarConfigDir = `${homeDir}/.config/oscar`;
  const platforms = ensureForgePlatforms(enabledPlatformExtensions);

  return {
    version: '1.0.0',
    title: 'Oscar GC — Forge',
    description:
      'Meta-agent for Oscar GC. Creates new skills (writes SKILL.md to ~/.agents/skills/) and new practice areas (extends ~/.config/oscar/profile.json).',
    instructions: SYSTEM_PROMPT,
    extensions: [
      {
        type: 'stdio',
        name: 'oscar-fs',
        description:
          'Filesystem MCP scoped to Oscar GC config + personal skills directory (ADR-039 deliberate exception).',
        cmd: resolveNodeCmd(resourcesRoot),
        args: [resolveOscarFsBundle(resourcesRoot), skillsDir, oscarConfigDir],
        available_tools: ['read_file', 'write_file', 'list_directory', 'create_directory'],
        timeout: 30,
      },
      ...platforms,
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
