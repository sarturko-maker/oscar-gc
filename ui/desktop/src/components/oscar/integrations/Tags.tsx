// Sprint 17 (ADR-060): tag pills + tier badge for integration cards.
// Editorial register; mono-editorial font, copper accent for tier badges,
// ink-muted for facts. Reuses Oscar's existing palette.

import type {
  License,
  SecurityTier,
  SubscriptionType,
} from './types';

const LICENSE_LABELS: Record<License, string> = {
  'apache-2.0': 'Apache 2.0 wrapper',
  mit: 'MIT wrapper',
  'bsd-3': 'BSD-3 wrapper',
  proprietary: 'proprietary wrapper',
  unknown: 'license unknown',
};

const SUBSCRIPTION_LABELS: Record<SubscriptionType, string> = {
  free: 'free',
  'requires-account': 'requires account',
  'requires-paid-subscription': 'paid subscription',
  'open-source-self-hosted': 'open-source self-hosted',
};

const TIER_LABELS: Record<SecurityTier, string> = {
  bundled: 'Bundled',
  trusted: 'Trusted',
  community: 'Community',
};

export function TierBadge({ tier }: { tier: SecurityTier }) {
  return (
    <span className={`oscar__integration-tier oscar__integration-tier--${tier}`}>
      {TIER_LABELS[tier]}
    </span>
  );
}

export function LicenseTag({ license }: { license: License }) {
  return <span className="oscar__integration-tag">{LICENSE_LABELS[license]}</span>;
}

export function SubscriptionTag({
  subscription,
}: {
  subscription: SubscriptionType;
}) {
  return (
    <span className="oscar__integration-tag">
      {SUBSCRIPTION_LABELS[subscription]}
    </span>
  );
}

export function HostTag({ host }: { host: string | null }) {
  if (!host) return null;
  return <span className="oscar__integration-tag">talks to: {host}</span>;
}

export function AlwaysOnBadge() {
  return <span className="oscar__integration-status">Always-on</span>;
}

export function InstalledBadge() {
  return <span className="oscar__integration-status">Installed</span>;
}
