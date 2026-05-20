// Sprint 17 (ADR-059, ADR-061): map an installed-integration id to a
// Goose ExtensionConfig. Called by MattersLanding.openMatter at recipe-
// build time once per installed entry for the active area.

import type { Recipe } from '../../../api';
import type { Integration } from './types';
import { loadIntegrationsRegistry } from './loadRegistry';

export async function buildExtensionFromIntegration(
  entryId: string,
): Promise<NonNullable<Recipe['extensions']>[number] | null> {
  const registry = await loadIntegrationsRegistry();
  const entry = registry.find((e) => e.id === entryId);
  if (!entry) {
    // eslint-disable-next-line no-console
    console.warn(
      `integrations: installed entry "${entryId}" not in registry; skipping`,
    );
    return null;
  }
  return buildExtensionFromEntry(entry);
}

// Pure form, exported for unit-testability and use by callers that
// already hold an Integration object.
export function buildExtensionFromEntry(
  entry: Integration,
): NonNullable<Recipe['extensions']>[number] | null {
  // Bundled entries are not addable; if we ever hit this branch for a
  // bundled entry, something installed it incorrectly — return null and
  // let the caller skip it.
  if (entry.security_tier === 'bundled') {
    // eslint-disable-next-line no-console
    console.warn(
      `integrations: bundled entry "${entry.id}" should not be installed; skipping`,
    );
    return null;
  }

  // Sprint 17b: paid-subscription wrappers require OAuth that upstream
  // Goose's MCP-OAuth client (`goose-docs.ai/oauth/client-metadata.json`)
  // isn't trusted to perform — wiring them into the recipe breaks matter
  // open with a 'not a trusted client' error. UI marks them visible-only,
  // but defence in depth: if a stale installed_integrations.json carries
  // one (e.g. from a Sprint 17 install before this gate landed), skip it
  // at recipe-build time.
  if (entry.subscription_type === 'requires-paid-subscription') {
    // eslint-disable-next-line no-console
    console.warn(
      `integrations: paid-subscription entry "${entry.id}" cannot be wired into the recipe in Sprint 17b (OAuth client_id mismatch). Skipping; Sprint 18+ revisits.`,
    );
    return null;
  }

  if (entry.transport === 'streamable_http') {
    if (!entry.url) {
      // eslint-disable-next-line no-console
      console.warn(`integrations: entry "${entry.id}" has no url; skipping`);
      return null;
    }
    return {
      type: 'streamable_http',
      name: entry.id,
      description: entry.description,
      uri: entry.url,
      env_keys: [...entry.env_keys],
    };
  }

  // stdio fallback — present for schema symmetry. No installable stdio
  // entries in the Sprint 17 seed set (oscar-fs is bundled, no Add).
  if (!entry.cmd) {
    // eslint-disable-next-line no-console
    console.warn(
      `integrations: stdio entry "${entry.id}" has no cmd; skipping`,
    );
    return null;
  }
  return {
    type: 'stdio',
    name: entry.id,
    description: entry.description,
    cmd: entry.cmd,
    args: [...entry.args],
    env_keys: [...entry.env_keys],
    timeout: 30,
  };
}
