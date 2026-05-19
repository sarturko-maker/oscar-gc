import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';
import type { TavilyKey } from './resolveTavilyKey';

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

// Sprint 15 (ADR-052): hosted Tavily extension via streamable_http (per
// Goose's accepted ExtensionConfig variants — the CLI rejects raw `sse`
// in favour of `streamable_http`, which is HTTP + SSE under the hood and
// the canonical Goose transport for hosted MCPs). Only attached when
// resolveTavilyKey() returned non-null. The resolved uri carries the
// user's API key as a query param — caller must NOT serialise this
// Recipe to disk or logs without first calling redactRecipeForLog.
export function buildTavilyExtension(key: TavilyKey): NonNullable<Recipe['extensions']>[number] {
  return {
    type: 'streamable_http',
    name: 'tavily',
    description:
      'Hosted Tavily web search for regulatory hypothesis-confirm (ADR-052). Tools: tavily-search (real-time web search), tavily-extract (page extraction). Used during P2.5c of the intake.',
    uri: `https://mcp.tavily.com/mcp/?tavilyApiKey=${encodeURIComponent(key.apiKey)}`,
  };
}

export interface BuildOnboardingRecipeOptions {
  resourcesRoot: string | null;
  tavily: TavilyKey | null;
}

export function buildOnboardingRecipe(opts: BuildOnboardingRecipeOptions): Recipe {
  const envs: Record<string, string> = {};
  if (opts.resourcesRoot) {
    envs.OSCAR_RESOURCES_ROOT = opts.resourcesRoot;
  }
  const onboardingExtension: NonNullable<Recipe['extensions']>[number] = {
    type: 'stdio',
    name: 'oscar-onboarding',
    description:
      'First-launch onboarding profile writer (v3 schema). Tools: finalize_profile, list_area_questions.',
    cmd: resolveNodeCmd(opts.resourcesRoot),
    args: [resolveOnboardingMcp(opts.resourcesRoot)],
    envs,
    timeout: 30,
  };
  const extensions: NonNullable<Recipe['extensions']> = opts.tavily
    ? [onboardingExtension, buildTavilyExtension(opts.tavily)]
    : [onboardingExtension];
  return {
    version: '1.0.0',
    title: 'Oscar GC Onboarding',
    description:
      "First-launch interview (Sprint 15 ADR-050 rule-set). Captures user identity, corporate context, the company_context block (industry depth, geography, regulatory_baseline via hypothesis-confirm, recurring matters, stakeholders, risk appetite, open notes), practice scope, and provider; writes profile v3 to ~/.config/oscar/profile.json.",
    instructions: SYSTEM_PROMPT,
    extensions,
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
