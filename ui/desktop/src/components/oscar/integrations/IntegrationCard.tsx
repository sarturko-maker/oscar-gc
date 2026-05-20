// Sprint 17 (ADR-060): single integration card. Four states:
// - bundled: Always-on badge in place of Add (oscar-fs).
// - paid-subscription: card visible with honest labels, Add replaced with
//   a "Subscription — not yet installable" badge (Sprint 17b dogfood:
//   upstream Goose's MCP OAuth client_id `goose-docs.ai/oauth/client-
//   metadata.json` isn't registered with Ironclad/DocuSign/etc., so
//   wiring them into the recipe breaks matter open; deferred to Sprint
//   18+ when a real OAuth client lands).
// - installed (post-Add): Installed badge; click is a no-op in Sprint 17.
// - addable (trusted or community-non-paid): Add → ConfirmAddModal.
//
// Top-level Integrations view (P4) passes an optional areaPicker
// dropdown; per-area view doesn't pass it (area is fixed).

import type * as React from 'react';
import type { Integration } from './types';
import {
  AlwaysOnBadge,
  HostTag,
  InstalledBadge,
  LicenseTag,
  PendingAuthBadge,
  SubscriptionTag,
  TierBadge,
} from './Tags';

export interface IntegrationCardProps {
  entry: Integration;
  installed: boolean;
  // Per-area view: omit (area is fixed). Top-level view: pass the
  // dropdown element to render next to the Add button.
  areaPicker?: React.ReactNode;
  onClickAdd?: () => void;
}

export default function IntegrationCard({
  entry,
  installed,
  areaPicker,
  onClickAdd,
}: IntegrationCardProps) {
  const isBundled = entry.security_tier === 'bundled';
  // Sprint 17b: paid-subscription wrappers (Ironclad, DocuSign) require
  // OAuth that upstream Goose's MCP-OAuth client isn't trusted to perform.
  // Show them honestly for transparency but make Add unavailable in this
  // sprint. Trusted-tier and free/account-only community tier stay
  // installable.
  const isPaidNotYetInstallable =
    entry.subscription_type === 'requires-paid-subscription';

  return (
    <div className="oscar__integration-card">
      <div className="oscar__integration-card-header">
        <h3 className="oscar__integration-card-title">{entry.title}</h3>
        <TierBadge tier={entry.security_tier} />
      </div>

      {entry.service_endpoint_host && (
        <p className="oscar__integration-card-host">
          {entry.service_endpoint_host}
        </p>
      )}

      <p className="oscar__integration-card-desc">{entry.description}</p>

      <div className="oscar__integration-card-tags">
        <LicenseTag license={entry.license} />
        <SubscriptionTag subscription={entry.subscription_type} />
        <HostTag host={entry.service_endpoint_host} />
      </div>

      <div className="oscar__integration-card-actions">
        {!isPaidNotYetInstallable && areaPicker}
        {isBundled ? (
          <AlwaysOnBadge />
        ) : isPaidNotYetInstallable ? (
          <PendingAuthBadge />
        ) : installed ? (
          <InstalledBadge />
        ) : (
          <button
            type="button"
            onClick={onClickAdd}
            className="oscar__button oscar__button--primary"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
