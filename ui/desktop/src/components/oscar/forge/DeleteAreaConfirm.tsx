// Sprint 20-M8 (ADR-090, ADR-091): renderer-side confirm modal for Forge
// Mode E destructive ops. Fires when the main-process watcher detects a
// marker file at ~/.config/oscar/_forge_request_delete_<areaId>.json.
// Lawyer clicks Archive → archive + profile.json edit + marker unlink.
// Lawyer clicks Cancel → marker unlink only (profile + state untouched).
//
// Chrome mirrors the LQdesign in-house modal register: cream paper,
// copper rule, serif title, mono-editorial action labels. The Archive
// button uses .oscar__button--primary (copper bg) — copper is the
// established destructive-action tone in the in-house palette (no
// vermillion / red class exists; not inventing one in M8).

import React, { useState } from 'react';
import {
  useDeleteAreaConfirm,
  type DeleteAreaState,
} from './useDeleteAreaConfirm';

interface BodyProps {
  state: DeleteAreaState;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onArchive: () => void;
}

const Body: React.FC<BodyProps> = ({ state, busy, error, onCancel, onArchive }) => {
  const overrideCount = state.impact.overrideKeys.length;
  return (
    <div className="oscar" data-testid="delete-area-confirm">
      <div
        className="oscar__modal-backdrop"
        onClick={busy ? undefined : onCancel}
        data-testid="delete-area-confirm-backdrop"
      >
        <div
          className="oscar__modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-area-confirm-title"
        >
          <div
            className="oscar__eyebrow"
            style={{ marginBottom: 8 }}
          >
            Forge // Archive practice area
          </div>
          <h2
            id="delete-area-confirm-title"
            className="oscar__modal-title"
            data-testid="delete-area-confirm-title"
          >
            Archive {state.areaName}?
          </h2>
          <p
            className="oscar__field-hint"
            data-testid="delete-area-confirm-impact"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 18,
              color: 'var(--ink)',
            }}
          >
            This will move{' '}
            <span
              style={{ fontFamily: 'var(--mono-editorial)', fontWeight: 500 }}
              data-testid="delete-area-confirm-matter-count"
            >
              {state.impact.matterCount}
            </span>{' '}
            matter{state.impact.matterCount === 1 ? '' : 's'},{' '}
            <span
              style={{ fontFamily: 'var(--mono-editorial)', fontWeight: 500 }}
              data-testid="delete-area-confirm-integration-count"
            >
              {state.impact.integrationCount}
            </span>{' '}
            integration{state.impact.integrationCount === 1 ? '' : 's'}, and{' '}
            <span
              style={{ fontFamily: 'var(--mono-editorial)', fontWeight: 500 }}
              data-testid="delete-area-confirm-override-count"
            >
              {overrideCount}
            </span>{' '}
            override{overrideCount === 1 ? '' : 's'} into{' '}
            <code style={{ fontFamily: 'var(--mono-editorial)', fontSize: 11 }}>
              ~/.config/oscar/state/_archive/
            </code>
            .
          </p>
          <p
            className="oscar__field-hint"
            style={{ fontSize: 12, marginBottom: 18, color: 'var(--ink-faint)' }}
          >
            Your matter files at{' '}
            <code style={{ fontFamily: 'var(--mono-editorial)', fontSize: 11 }}>
              ~/Documents/Oscar GC/{state.areaName}/
            </code>{' '}
            stay where they are. The area disappears from the sidebar.
          </p>
          {error && (
            <p
              className="oscar__field-error"
              data-testid="delete-area-confirm-error"
            >
              {error}
            </p>
          )}
          <div className="oscar__modal-actions">
            <button
              type="button"
              className="oscar__button oscar__button--ghost"
              onClick={onCancel}
              disabled={busy}
              data-testid="delete-area-confirm-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="oscar__button oscar__button--primary"
              onClick={onArchive}
              disabled={busy}
              data-testid="delete-area-confirm-archive"
            >
              {busy ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteAreaConfirm: React.FC = () => {
  const { pending, clear } = useDeleteAreaConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) return null;

  const handleCancel = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await window.electron.forge.cancelDeleteArea(pending.areaId);
    } catch (err) {
      // Cancel-path failures are non-blocking; close the modal anyway —
      // the marker may already be unlinkable by Forge's next turn.
      // eslint-disable-next-line no-console
      console.warn('cancelDeleteArea failed', err);
    } finally {
      setBusy(false);
      clear();
    }
  };

  const handleArchive = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.electron.forge.confirmDeleteArea(
        pending.areaId,
        pending.timestamp,
      );
      if (result.ok) {
        clear();
      } else {
        setError(result.reason);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Body
      state={pending}
      busy={busy}
      error={error}
      onCancel={() => void handleCancel()}
      onArchive={() => void handleArchive()}
    />
  );
};

export default DeleteAreaConfirm;
