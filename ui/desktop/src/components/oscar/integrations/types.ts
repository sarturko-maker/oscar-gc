// Sprint 17 (ADR-059): Integrations registry types.
//
// Two-source model:
// - Vendor truth (read-only): skills/in-house-legal/<plugin>/.mcp.json,
//   owns {id, transport, url, title, description}.
// - Oscar overlay (this file's IntegrationOverlay): editorial metadata
//   not in the vendor data — license, subscription, security tier,
//   env_keys, hostname, maintenance signal, facts note.
//
// loadRegistry.ts joins the two by entry id and computes relevant_areas
// from .mcp.json membership × bundled_skill_sources inversion.

export type Transport = 'stdio' | 'streamable_http';

export type License =
  | 'apache-2.0'
  | 'mit'
  | 'bsd-3'
  | 'proprietary'
  | 'unknown';

export type SubscriptionType =
  | 'free'
  | 'requires-account'
  | 'requires-paid-subscription'
  | 'open-source-self-hosted';

export type SecurityTier = 'bundled' | 'trusted' | 'community';

export type MaintenanceSignalSource =
  | 'manual-stub'
  | 'github-readme'
  | 'service-status-page';

export interface MaintenanceSignal {
  last_updated_iso: string | null;
  source: MaintenanceSignalSource;
}

export interface IntegrationOverlay {
  id: string;
  license: License;
  subscription_type: SubscriptionType;
  security_tier: SecurityTier;
  env_keys: readonly string[];
  // Required for non-stdio (streamable_http) entries — used in the trust
  // prompt copy and the startup egress envelope log (ADR-062). Null only
  // for bundled stdio MCPs.
  service_endpoint_host: string | null;
  maintenance_signal: MaintenanceSignal;
  // Optional editorial note (e.g. "wrapper authored by Anthropic; service
  // is Ironclad SaaS"). Shown on hover; facts only, no marketing.
  facts_note: string | null;
  // Optional overlay-side {url, title, description} for entries that
  // don't have a .mcp.json row (e.g. the bundled oscar-fs entry that
  // appears in the catalog for transparency).
  overlay_url?: string | null;
  overlay_title?: string;
  overlay_description?: string;
  // stdio bundled entries carry cmd/args here; the loader resolves them
  // against resourcesRoot at session-spawn (buildExtensionFromIntegration).
  // Empty for streamable_http entries.
  overlay_cmd?: string | null;
  overlay_args?: readonly string[];
}

// Joined record produced by loadRegistry: vendor data + overlay +
// computed relevant_areas. This is what UI components consume.
export interface Integration {
  id: string;
  transport: Transport;
  url: string | null;
  cmd: string | null;
  args: readonly string[];
  title: string;
  description: string;
  license: License;
  subscription_type: SubscriptionType;
  security_tier: SecurityTier;
  env_keys: readonly string[];
  service_endpoint_host: string | null;
  maintenance_signal: MaintenanceSignal;
  facts_note: string | null;
  relevant_areas: readonly string[];
}

// Raw shape returned by the list-available IPC (vendor data only).
// loadRegistry joins this with INTEGRATIONS_OVERLAY. The `type` field is
// `string` at the IPC boundary; normaliseTransport in loadRegistry maps
// unknown values to a safe default.
export interface VendorMcpEntry {
  id: string;
  plugin_slug: string;
  type: string;
  url?: string;
  title: string;
  description: string;
}

// Installed-state row (mirrors InstalledIntegrationEntrySchema in main.ts).
// Sprint 17 (ADR-061): persisted at
// ~/.config/oscar/state/<area-id>/installed_integrations.json.
export interface InstalledIntegration {
  id: string;
  added_at: string;
  trust_acknowledged: boolean;
}
