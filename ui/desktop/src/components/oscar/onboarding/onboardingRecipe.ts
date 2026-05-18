import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

export const ONBOARDING_MCP_PATH = '/srv/projects/oscar-onboarding-mcp/dist/index.js';

export const ONBOARDING_RECIPE: Recipe = {
  version: '1.0.0',
  title: 'Oscar GC Onboarding',
  description:
    "First-launch interview. Captures the user's identity, corporate context, practice scope, and provider; writes the profile to ~/.config/oscar/profile.json.",
  instructions: SYSTEM_PROMPT,
  extensions: [
    {
      type: 'stdio',
      name: 'oscar-onboarding',
      description: 'First-launch onboarding profile writer. One tool: finalize_profile.',
      cmd: 'node',
      args: [ONBOARDING_MCP_PATH],
      timeout: 30,
    },
  ],
  settings: {
    goose_provider: 'minimax',
    goose_model: 'MiniMax-M2.5',
  },
};
