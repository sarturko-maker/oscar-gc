// Sprint 12 (ADRs 036, 043): new-matter intake modal. LQdesign chrome.

import { useState } from 'react';
import type { NewMatterInput } from './types';

interface NewMatterDialogProps {
  areaName: string;
  onCancel: () => void;
  onCreate: (input: NewMatterInput) => Promise<void>;
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);

export default function NewMatterDialog({
  areaName,
  onCancel,
  onCreate,
}: NewMatterDialogProps) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [matterType, setMatterType] = useState('');
  const [privileged, setPrivileged] = useState(false);
  const [keyFacts, setKeyFacts] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slug = slugify(name);

  const submit = async (): Promise<void> => {
    if (!slug || !name || !client || !matterType) {
      setError('Name, client, and matter type are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        slug,
        name,
        client,
        counterparty: counterparty.trim().length > 0 ? counterparty : null,
        matter_type: matterType,
        privileged,
        key_facts: keyFacts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create matter');
      setSubmitting(false);
    }
  };

  return (
    <div className="oscar__modal-backdrop" onClick={onCancel}>
      <div className="oscar__modal" onClick={(e) => e.stopPropagation()}>
        <div className="oscar__eyebrow">{areaName}</div>
        <h2 className="oscar__modal-title">New matter</h2>

        <label className="oscar__field">
          <span className="oscar__field-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme MSA Jan 2026"
            disabled={submitting}
            className="oscar__input"
          />
          {slug && <span className="oscar__field-hint">slug: {slug}</span>}
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">Client</span>
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Internal business unit, or named client"
            disabled={submitting}
            className="oscar__input"
          />
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">Counterparty (optional)</span>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Zenith Corp"
            disabled={submitting}
            className="oscar__input"
          />
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">Matter type</span>
          <input
            type="text"
            value={matterType}
            onChange={(e) => setMatterType(e.target.value)}
            placeholder="NDA, MSA, board minute, FTO opinion…"
            disabled={submitting}
            className="oscar__input"
          />
        </label>

        <label className="oscar__field oscar__field--inline">
          <input
            type="checkbox"
            checked={privileged}
            onChange={(e) => setPrivileged(e.target.checked)}
            disabled={submitting}
          />
          <span className="oscar__field-label">Privileged matter</span>
          <span className="oscar__field-hint">
            Visibly flagged; Sprint 13+ wires audit log.
          </span>
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">Key facts</span>
          <textarea
            value={keyFacts}
            onChange={(e) => setKeyFacts(e.target.value)}
            placeholder="2–5 sentences. What is this matter about? Who's at stake? What's different from the default playbook?"
            disabled={submitting}
            className="oscar__textarea"
            rows={5}
          />
        </label>

        {error && <p className="oscar__field-error">{error}</p>}

        <div className="oscar__modal-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="oscar__button oscar__button--ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="oscar__button oscar__button--primary"
          >
            {submitting ? 'Creating…' : 'Create matter'}
          </button>
        </div>
      </div>
    </div>
  );
}
