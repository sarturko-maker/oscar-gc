// Sprint 17 (ADR-060): confirm + trust-prompt modal.
//
// Branches on security_tier:
// - trusted: short confirmation (one paragraph; hostname + maintainer).
// - community: full trust prompt (hostname + license + subscription +
//   maintainer + egress copy). Button label is "Add and acknowledge".
//
// Bundled-tier cards have no Add button, so this modal is never opened
// for them (the parent component guards against it).
//
// On confirm, calls install(areaId, entry.id, trustAcknowledged: true).
// On cancel, no write. No "skip the trust prompt" path.

import { useState } from 'react';
import type { Integration } from './types';
import type { PracticeArea } from '../practiceAreas';

interface ConfirmAddModalProps {
  entry: Integration;
  area: PracticeArea;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function ConfirmAddModal({
  entry,
  area,
  onCancel,
  onConfirm,
}: ConfirmAddModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError((err as Error).message ?? 'Could not add integration.');
      setBusy(false);
    }
  };

  const tier = entry.security_tier;
  const host = entry.service_endpoint_host ?? 'unknown host';
  const confirmLabel =
    tier === 'community' ? 'Add and acknowledge' : 'Add';

  return (
    <div className="oscar__modal-backdrop" onClick={onCancel}>
      <div className="oscar__modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="oscar__modal-title">
          Add {entry.title} to {area.name}?
        </h2>

        {tier === 'trusted' && (
          <div className="oscar__integration-prompt">
            <p>This is a trusted integration.</p>
            <ul>
              <li>Talks to: {host}</li>
              <li>License: {entry.license}</li>
              {entry.facts_note && <li>{entry.facts_note}</li>}
            </ul>
          </div>
        )}

        {tier === 'community' && (
          <div className="oscar__integration-prompt">
            <p>This is a community-tier integration.</p>
            <ul>
              <li>Talks to: {host} (over HTTPS).</li>
              <li>License: {entry.license}.</li>
              <li>
                Subscription: {readableSubscription(entry.subscription_type)}.
                {entry.subscription_type !==
                  'open-source-self-hosted' && (
                  <>
                    {' '}
                    You will be prompted by {entry.title} on first tool call.
                  </>
                )}
              </li>
              {entry.facts_note && <li>{entry.facts_note}</li>}
              <li>
                Data leaving your device: queries you ask the agent that the
                agent decides to forward to {entry.title}, and any responses.
              </li>
            </ul>
            <p className="oscar__integration-prompt-warning">
              Oscar GC does not sandbox network egress today. Adding this
              integration widens where your agent talks. Real sandboxing is
              planned in a later release.
            </p>
          </div>
        )}

        {error && <p className="oscar__field-error">{error}</p>}

        <div className="oscar__modal-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="oscar__button oscar__button--ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="oscar__button oscar__button--primary"
          >
            {busy ? 'Adding…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function readableSubscription(s: Integration['subscription_type']): string {
  switch (s) {
    case 'free':
      return 'free';
    case 'requires-account':
      return 'requires an account with the service';
    case 'requires-paid-subscription':
      return 'requires a paid subscription';
    case 'open-source-self-hosted':
      return 'open-source; you host it yourself';
  }
}
