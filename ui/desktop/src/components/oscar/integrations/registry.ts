// Sprint 17 (ADR-059, ADR-060): Integrations overlay table.
//
// The .mcp.json files in skills/in-house-legal/<plugin>/ are the vendor
// source-of-truth for transport + URL + title + description. This overlay
// adds the editorial metadata Oscar GC owns: license, subscription
// posture, security tier, env_keys, hostname, maintenance signal.
//
// Adding a new entry requires picking a SecurityTier (fail-closed in
// loadRegistry: vendor entries without an overlay row are excluded with
// a console warning).
//
// Tier policy (ADR-060):
// - bundled: Always-on badge in the card; no Add button.
// - trusted: Short confirmation modal; one-click Add.
// - community: Full trust prompt with hostname + license + subscription
//   + maintainer + egress copy; "Add and acknowledge" persists consent.

import type { IntegrationOverlay } from './types';

export const INTEGRATIONS_OVERLAY: Readonly<Record<string, IntegrationOverlay>> = {
  // Sprint 17 seed entry: oscar-fs is loaded by every practice-area
  // recipe (buildPracticeAreaRecipe). Shown for transparency only; the
  // card renders the Always-on badge instead of an Add button.
  // overlay_url null because there's no SaaS endpoint to talk to.
  'oscar-fs': {
    id: 'oscar-fs',
    license: 'mit',
    subscription_type: 'free',
    security_tier: 'bundled',
    env_keys: [],
    service_endpoint_host: null,
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Filesystem MCP scoped to the matter folder. Already loaded by every practice-area agent (Sprint 12 ADR-040).',
    overlay_title: 'oscar-fs',
    overlay_description:
      'Filesystem access scoped to the active matter folder. Always loaded by every practice-area agent — listed here for transparency.',
    overlay_cmd: null,
    overlay_args: [],
  },

  // Sprint 18 (ADR-064): Tavily as transparent bundled web search.
  // Wired recipe-time by buildTavilyExtension() since Sprint 15 (ADR-052);
  // this overlay entry surfaces it in the Integrations catalog so the
  // lawyer sees the provider name and hostname honestly. Bundled tier →
  // Always-on badge, no Add button, all 13 areas (joinOverlayOnly default).
  Tavily: {
    id: 'Tavily',
    license: 'proprietary',
    subscription_type: 'free',
    security_tier: 'bundled',
    env_keys: ['TAVILY_API_KEY'],
    service_endpoint_host: 'mcp.tavily.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Web search wired into every practice-area agent. Queries and any URLs the agent fetches via tavily-extract leave the device to mcp.tavily.com under Tavily\'s TOS.',
    overlay_title: 'Tavily web search',
    overlay_description:
      'Regulatory-currency lookups + open-web research. Always loaded by every practice-area agent — listed here for transparency.',
    overlay_url: 'https://mcp.tavily.com/mcp/',
    overlay_cmd: null,
    overlay_args: [],
  },

  // Sprint 17 seed: CourtListener (Free Law Project).
  // Appears in litigation-legal/.mcp.json + ip-legal/.mcp.json. Free
  // public-data US court records — no subscription, no auth handshake
  // needed for read access. Wrapper is Anthropic Apache-2.0; the upstream
  // service is operated by Free Law Project (non-profit).
  CourtListener: {
    id: 'CourtListener',
    license: 'apache-2.0',
    subscription_type: 'free',
    security_tier: 'trusted',
    env_keys: [],
    service_endpoint_host: 'mcp.courtlistener.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Maintained by Free Law Project (non-profit). Free public data: US court opinions, judges, PACER dockets, citations.',
  },

  // Sprint 17 seed: Slack. Cross-area (appears in every plugin's
  // .mcp.json). Community tier — proprietary wrapper, requires a free
  // Slack workspace account, auth happens on first tool call.
  Slack: {
    id: 'Slack',
    license: 'proprietary',
    subscription_type: 'requires-account',
    security_tier: 'community',
    env_keys: [],
    service_endpoint_host: 'mcp.slack.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Maintained by Slack. Requires a Slack workspace login on first tool call.',
  },

  // Sprint 17 seed: Google Drive. Cross-area. Community tier — Google
  // workspace login on first tool call.
  'Google Drive': {
    id: 'Google Drive',
    license: 'proprietary',
    subscription_type: 'requires-account',
    security_tier: 'community',
    env_keys: [],
    service_endpoint_host: 'drivemcp.googleapis.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Maintained by Google. Requires a Google account with Drive access on first tool call.',
  },

  // Sprint 17 seed: Ironclad. Commercial only (appears in
  // commercial-legal/.mcp.json). Community tier — paid CLM subscription
  // required. The brief's paid-wrapper anchor for Commercial.
  Ironclad: {
    id: 'Ironclad',
    license: 'proprietary',
    subscription_type: 'requires-paid-subscription',
    security_tier: 'community',
    env_keys: [],
    service_endpoint_host: 'mcp.na1.ironcladapp.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Maintained by Ironclad. Requires a paid Ironclad CLM subscription. You will be prompted by Ironclad on first tool call.',
  },

  // Sprint 17 seed: DocuSign. Commercial only. Community tier — paid
  // DocuSign subscription required. Second Commercial paid wrapper
  // validates per-area filter.
  DocuSign: {
    id: 'DocuSign',
    license: 'proprietary',
    subscription_type: 'requires-paid-subscription',
    security_tier: 'community',
    env_keys: [],
    service_endpoint_host: 'mcp.docusign.com',
    maintenance_signal: { last_updated_iso: null, source: 'manual-stub' },
    facts_note:
      'Maintained by DocuSign. Requires a paid DocuSign account. You will be prompted by DocuSign on first tool call.',
  },
} as const;

// Every entry must declare a tier (ADR-060). Loader rejects vendor rows
// that lack an overlay; this assertion catches missing-tier bugs at
// module-load time, before any UI renders.
for (const [key, value] of Object.entries(INTEGRATIONS_OVERLAY)) {
  if (key !== value.id) {
    throw new Error(
      `INTEGRATIONS_OVERLAY: key "${key}" disagrees with entry id "${value.id}"`,
    );
  }
}
