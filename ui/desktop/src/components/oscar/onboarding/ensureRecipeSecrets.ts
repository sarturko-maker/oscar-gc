// Sprint 17 (P6): generic gate check for recipes with declared env_keys.
//
// Returns true if the recipe needs the RecipeSecretsModal gate (at least
// one declared key is unset in env/keyring AND not previously skipped).
// Returns false if every declared key is either set, skipped, or no keys
// are declared — in which case the caller can spawn the session directly
// without the modal flash.
//
// Sprint 16 (ADR-058)'s RecipeSecretsModal does the same scan internally
// and short-circuits to onComplete. Pulling the same check into a helper
// lets per-matter spawn paths (Sprint 17 onwards) skip the modal entirely
// for the no-op case, avoiding a flash of the "Checking required keys…"
// state on every matter open.
//
// For the Sprint 17 seed set every integration declares env_keys: [], so
// only Tavily (already-set after onboarding) contributes a key. Result:
// the helper returns false on every matter open, and MattersLanding
// spawns directly. The plumbing is here for Sprint 18+ entries that grow
// real keys (Ironclad / DocuSign / etc.).

import type { Recipe } from '../../../api';

interface ConfigReader {
  read: (
    key: string,
    isSecret: boolean,
    options?: { throwOnError?: boolean },
  ) => Promise<unknown>;
}

export async function ensureRecipeSecrets(
  recipe: Recipe,
  config: ConfigReader,
): Promise<boolean> {
  const envKeys = new Set<string>();
  for (const ext of recipe.extensions ?? []) {
    if (
      typeof ext === 'object' &&
      ext !== null &&
      'env_keys' in ext &&
      Array.isArray((ext as { env_keys?: unknown }).env_keys)
    ) {
      const keys = (ext as { env_keys: string[] }).env_keys;
      for (const k of keys) {
        if (typeof k === 'string' && k.length > 0) envKeys.add(k);
      }
    }
  }
  if (envKeys.size === 0) return false;
  for (const key of envKeys) {
    const skippedFlag = await config.read(`OSCAR_${key}_SKIPPED`, false);
    if (skippedFlag === true || skippedFlag === 'true') continue;
    const existing = await config.read(key, true);
    if (existing === null || existing === undefined) return true;
  }
  return false;
}
