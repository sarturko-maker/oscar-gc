// Sprint 12 (ADR-039): Forge meta-agent recipe. Scoped to ~/.agents/skills/
// + ~/.config/oscar/; no Developer, no memory, no onboarding, no redline.
// Title prefix "Oscar GC —" gates the bundled-trust short-circuit (ADR-029).

import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

export function buildForgeRecipe(
  homeDir: string,
  resourcesRoot: string | null,
): Recipe {
  const skillsDir = `${homeDir}/.agents/skills`;
  const oscarConfigDir = `${homeDir}/.config/oscar`;

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
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
