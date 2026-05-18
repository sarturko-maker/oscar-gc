import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

const DEV_ONBOARDING_NODE_CMD = '/usr/bin/node';
const DEV_ONBOARDING_MCP_PATH = '/srv/projects/oscar-onboarding-mcp/dist/index.js';

function resolveNodeCmd(resourcesRoot: string | null): string {
  if (resourcesRoot) {
    return `${resourcesRoot}/node/bin/node`;
  }
  return DEV_ONBOARDING_NODE_CMD;
}

function resolveOnboardingMcp(resourcesRoot: string | null): string {
  if (resourcesRoot) {
    return `${resourcesRoot}/mcps/oscar-onboarding/index.js`;
  }
  return DEV_ONBOARDING_MCP_PATH;
}

export function buildOnboardingRecipe(resourcesRoot: string | null): Recipe {
  const envs: Record<string, string> = {};
  if (resourcesRoot) {
    envs.OSCAR_RESOURCES_ROOT = resourcesRoot;
  }
  return {
    version: '1.0.0',
    title: 'Oscar GC Onboarding',
    description:
      "First-launch interview. Captures the user's identity, corporate context, practice scope, and provider; writes the profile to ~/.config/oscar/profile.json.",
    instructions: SYSTEM_PROMPT,
    extensions: [
      {
        type: 'stdio',
        name: 'oscar-onboarding',
        description:
          'First-launch onboarding profile writer. Tools: finalize_profile, list_area_questions.',
        cmd: resolveNodeCmd(resourcesRoot),
        args: [resolveOnboardingMcp(resourcesRoot)],
        envs,
        timeout: 30,
      },
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
