// Sprint 17 (ADR-060): single integration card. Three states:
// - bundled: Always-on badge in place of Add (oscar-fs).
// - installed (post-Add): Installed badge; click is a no-op in Sprint 17.
// - addable (trusted or community): Add button → opens ConfirmAddModal.
//
// Top-level Integrations view (P4) passes an optional onSelectArea
// dropdown (the per-card target-area picker). Per-area view doesn't pass
// it — area is already the active practice area.

import type * as React from 'react';
import type { Integration } from './types';
import {
  AlwaysOnBadge,
  HostTag,
  InstalledBadge,
  LicenseTag,
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
        {areaPicker}
        {isBundled ? (
          <AlwaysOnBadge />
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
