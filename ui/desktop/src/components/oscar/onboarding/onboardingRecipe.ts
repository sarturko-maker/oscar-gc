import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

const DEV_ONBOARDING_NODE_CMD = '/usr/bin/node';
const DEV_ONBOARDING_MCP_PATH = '/srv/projects/goose/oscar/mcps/onboarding/dist/index.js';

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

// Sprint 16 (ADR-057, ADR-058): hosted Tavily extension declared with
// env_keys + URI substitution against Goose's secret config. At session-
// spawn, extension_manager::merge_environments() reads TAVILY_API_KEY from
// the env-then-keyring chain (config/base.rs::get_secret), then
// extension_manager::substitute_env_vars() inlines it into the URI before
// the streamable_http client connects. The recipe-builder no longer
// resolves the key itself; first-launch entry is handled by the generic
// RecipeSecretsModal that scans the recipe via /recipes/scan_secrets.
//
// If TAVILY_API_KEY is absent from env AND keyring, the literal
// "${TAVILY_API_KEY}" placeholder stays in the URI, the SSE connect fails,
// and rule 4 of the intake prompt narrates the LLM-only fallback. Noisy
// but functional. (A v2 may add a recipe-build-time check that omits the
// extension when OSCAR_TAVILY_SKIPPED=true AND no key is set; ADR-057 §
// "Mitigation when user skips entry on first launch".)
export function buildTavilyExtension(): NonNullable<Recipe['extensions']>[number] {
  return {
    type: 'streamable_http',
    name: 'tavily',
    description:
      'Hosted Tavily web search for regulatory hypothesis-confirm (ADR-052, ADR-057). Tools: tavily-search, tavily-extract. Used during P5 of the intake.',
    uri: 'https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}',
    env_keys: ['TAVILY_API_KEY'],
  };
}

export interface BuildOnboardingRecipeOptions {
  resourcesRoot: string | null;
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
  return {
    version: '1.0.0',
    title: 'Oscar GC Onboarding',
    description:
      "First-launch interview (Sprint 15 ADR-050, Sprint 16 ADR-055). Captures user identity, corporate context, the company_context block (industry depth, geography, regulatory_baseline via hypothesis-confirm scoped by practice areas, recurring matters, stakeholders, risk appetite, open notes), practice scope, and provider; writes profile v3 to ~/.config/oscar/profile.json.",
    instructions: SYSTEM_PROMPT,
    extensions: [onboardingExtension, buildTavilyExtension()],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
