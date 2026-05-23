// Sprint 17 (ADR-059): joins vendor .mcp.json data with INTEGRATIONS_OVERLAY,
// computes relevant_areas from bundled_skill_sources inversion.
//
// Two consumers:
// - UI mount (IntegrationsPerArea, IntegrationsView): renders the joined list.
// - Session spawn (buildExtensionFromIntegration): looks up an entry by id
//   when wiring an installed integration into a recipe.

import { PRACTICE_AREAS } from '../practiceAreas';
import type { Integration, IntegrationOverlay, VendorMcpEntry } from './types';
import { INTEGRATIONS_OVERLAY } from './registry';

// Returns the practice-area ids whose bundled_skill_sources includes the
// given plugin slug. Used to invert ADR-031's mapping.
function areasUsingPlugin(pluginSlug: string): string[] {
  return PRACTICE_AREAS.filter((a) => a.bundled_skill_sources?.includes(pluginSlug)).map(
    (a) => a.id
  );
}

// Map .mcp.json `type` to Goose's ExtensionConfig discriminator. All
// in-house-legal entries use `http`, which is Goose's `streamable_http`.
// `sse` and `streamable_http` pass through unchanged. Unknown values
// (defensive — IPC boundary returns string, not a strict enum) fall back
// to `stdio` so a malformed vendor row doesn't silently surface as a
// hosted endpoint with a missing URL.
function normaliseTransport(t: string): Integration['transport'] {
  if (t === 'http' || t === 'sse' || t === 'streamable_http') {
    return 'streamable_http';
  }
  return 'stdio';
}

// Build a single joined Integration from a vendor entry + its overlay.
// Overlay's overlay_url / overlay_title / overlay_description override
// the vendor strings if present (used by overlay-only bundled entries).
function joinVendorAndOverlay(
  vendor: VendorMcpEntry,
  overlay: IntegrationOverlay,
  relevantAreas: readonly string[]
): Integration {
  return {
    id: vendor.id,
    transport: normaliseTransport(vendor.type),
    url: overlay.overlay_url ?? vendor.url ?? null,
    cmd: overlay.overlay_cmd ?? null,
    args: overlay.overlay_args ?? [],
    title: overlay.overlay_title ?? vendor.title,
    description: overlay.overlay_description ?? vendor.description,
    license: overlay.license,
    subscription_type: overlay.subscription_type,
    security_tier: overlay.security_tier,
    env_keys: overlay.env_keys,
    service_endpoint_host: overlay.service_endpoint_host,
    maintenance_signal: overlay.maintenance_signal,
    facts_note: overlay.facts_note,
    relevant_areas: relevantAreas,
  };
}

// Build an overlay-only Integration (no vendor row). Used for bundled
// MCPs like oscar-fs that need to appear in the catalog for transparency
// but aren't in .mcp.json. Bundled-tier entries default to all 13 areas.
function joinOverlayOnly(overlay: IntegrationOverlay): Integration {
  const relevant = overlay.security_tier === 'bundled' ? PRACTICE_AREAS.map((a) => a.id) : [];
  return {
    id: overlay.id,
    transport: overlay.overlay_cmd ? 'stdio' : 'streamable_http',
    url: overlay.overlay_url ?? null,
    cmd: overlay.overlay_cmd ?? null,
    args: overlay.overlay_args ?? [],
    title: overlay.overlay_title ?? overlay.id,
    description: overlay.overlay_description ?? '',
    license: overlay.license,
    subscription_type: overlay.subscription_type,
    security_tier: overlay.security_tier,
    env_keys: overlay.env_keys,
    service_endpoint_host: overlay.service_endpoint_host,
    maintenance_signal: overlay.maintenance_signal,
    facts_note: overlay.facts_note,
    relevant_areas: relevant,
  };
}

// Module-cached promise so concurrent callers (UI mounts in two places at
// once, e.g. when the user navigates from a per-area Integrations tab to
// the top-level view) share the same fetch.
let cachedRegistryPromise: Promise<Integration[]> | null = null;

export function clearIntegrationsRegistryCache(): void {
  cachedRegistryPromise = null;
}

export async function loadIntegrationsRegistry(): Promise<Integration[]> {
  if (cachedRegistryPromise) return cachedRegistryPromise;
  cachedRegistryPromise = (async () => {
    const vendorRaw = await window.electron.integrations.listAvailable();
    const vendor: VendorMcpEntry[] = Array.isArray(vendorRaw) ? vendorRaw : [];

    // Group vendor rows by id; record which plugins each appears in.
    const pluginsById = new Map<string, Set<string>>();
    const firstVendorById = new Map<string, VendorMcpEntry>();
    for (const v of vendor) {
      if (!pluginsById.has(v.id)) {
        pluginsById.set(v.id, new Set());
        firstVendorById.set(v.id, v);
      }
      pluginsById.get(v.id)!.add(v.plugin_slug);
    }

    const out: Integration[] = [];
    const seenIds = new Set<string>();

    // Pass 1: vendor rows joined with overlays (fail-closed: skip if no overlay).
    for (const [id, plugins] of pluginsById.entries()) {
      const overlay = INTEGRATIONS_OVERLAY[id];
      if (!overlay) {
        console.warn(
          `integrations: vendor entry "${id}" has no INTEGRATIONS_OVERLAY row; excluded from registry`
        );
        continue;
      }
      const areaSet = new Set<string>();
      for (const plugin of plugins) {
        for (const areaId of areasUsingPlugin(plugin)) areaSet.add(areaId);
      }
      const v = firstVendorById.get(id)!;
      out.push(joinVendorAndOverlay(v, overlay, [...areaSet].sort()));
      seenIds.add(id);
    }

    // Pass 2: overlay-only entries (e.g. bundled oscar-fs).
    for (const overlay of Object.values(INTEGRATIONS_OVERLAY)) {
      if (seenIds.has(overlay.id)) continue;
      out.push(joinOverlayOnly(overlay));
    }

    // Stable order: bundled first, then trusted, then community; within
    // each tier, alphabetical by id. Keeps the rendered list deterministic.
    const tierOrder: Record<Integration['security_tier'], number> = {
      bundled: 0,
      trusted: 1,
      community: 2,
    };
    out.sort((a, b) => {
      const t = tierOrder[a.security_tier] - tierOrder[b.security_tier];
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });

    return out;
  })();
  return cachedRegistryPromise;
}
