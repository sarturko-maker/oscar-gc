import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

export const ONBOARDING_MCP_PATH = '/srv/projects/oscar-onboarding-mcp/dist/index.js';

// Electron inherits a PATH where `node` may resolve to Hermit's shim and the
// shim quits during cold-start. The CLI session's PATH puts /usr/bin first
// and is fine with bare `node`. Hardcoding the system path here is the
// dev-VPS-correct cmd; production builds (when we ship .deb/.rpm) will move
// to a bundled node — separate sprint, ADR-012 territory.
export const ONBOARDING_NODE_CMD = '/usr/bin/node';

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
      cmd: ONBOARDING_NODE_CMD,
      args: [ONBOARDING_MCP_PATH],
      timeout: 30,
    },
  ],
  settings: {
    goose_provider: 'minimax',
    goose_model: 'MiniMax-M2.5',
  },
};
