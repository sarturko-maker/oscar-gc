// Sprint 14 (ADR-047): config-driven new-matter dialog. Reads
// PracticeAreaShape for the active area; renders ordered slots (subject,
// counterparty?, stakeholder, kind, kind-conditional extras, privileged,
// key facts) with in-house vocabulary per area. One renderer, 13 area
// configs — no 13-way switch in code.

import { useEffect, useMemo, useState } from 'react';
import type { PracticeArea } from '../practiceAreas';
import type { NewMatterInput, PartyRole } from './types';
import type { PracticeAreaShape, ExtrasField } from './practiceAreaShapes';

interface NewMatterDialogProps {
  area: PracticeArea;
  shape: PracticeAreaShape;
  stakeholderSuggestions: string[];
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

const visibleExtrasFields = (
  fields: ExtrasField[] | undefined,
  kind: string,
): ExtrasField[] => {
  if (!fields) return [];
  return fields.filter(
    (f) => !f.showWhenKindIn || f.showWhenKindIn.includes(kind),
  );
};

const computeDefaultPrivileged = (
  shape: PracticeAreaShape,
  kind: string,
): boolean => {
  if (shape.privileged.defaultByKind && kind in shape.privileged.defaultByKind) {
    return shape.privileged.defaultByKind[kind];
  }
  return shape.privileged.fallback;
};

export default function NewMatterDialog({
  area,
  shape,
  stakeholderSuggestions,
  onCancel,
  onCreate,
}: NewMatterDialogProps) {
  const initialKind = shape.kind.options[0]?.value ?? 'other';
  const initialRole: PartyRole = shape.counterparty?.defaultRole ?? 'counterparty';
  // Sprint 19 (ADR-066 D4): per-area entry noun.
  const nounSingularLc = shape.entryNoun.singular.toLowerCase();

  const [name, setName] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyRole, setCounterpartyRole] = useState<PartyRole>(initialRole);
  const [stakeholder, setStakeholder] = useState('');
  const [kind, setKind] = useState(initialKind);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [privileged, setPrivileged] = useState(
    computeDefaultPrivileged(shape, initialKind),
  );
  const [keyFacts, setKeyFacts] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-default `privileged` when kind changes, but only when the user
  // hasn't explicitly toggled it for this session (we track via a guard
  // that any explicit interaction clears).
  const [privilegedTouched, setPrivilegedTouched] = useState(false);
  useEffect(() => {
    if (!privilegedTouched) {
      setPrivileged(computeDefaultPrivileged(shape, kind));
    }
  }, [kind, shape, privilegedTouched]);

  const slug = slugify(name);

  const extrasFieldsVisible = useMemo(
    () => visibleExtrasFields(shape.extras, kind),
    [shape, kind],
  );

  const handleStakeholderInput = (val: string): void => {
    setStakeholder(val);
  };

  const submit = async (): Promise<void> => {
    if (!slug || !name || !subjectLabel.trim() || !kind) {
      setError(`Name, ${shape.subject.label.toLowerCase()}, and kind are required.`);
      return;
    }
    if (shape.counterparty?.required && !counterpartyName.trim()) {
      setError(`${shape.counterparty.label} is required.`);
      return;
    }
    setSubmitting(true);
    setError(null);

    // Compose counterparty if name was provided (even on non-required slots);
    // empty name = null counterparty.
    const counterparty = shape.counterparty && counterpartyName.trim().length > 0
      ? { role: counterpartyRole, name: counterpartyName.trim() }
      : null;

    // Only include extras keys that are visible AND have a non-empty value.
    const extrasOut: Record<string, string> = {};
    for (const f of extrasFieldsVisible) {
      const v = extras[f.key];
      if (v && v.trim().length > 0) extrasOut[f.key] = v.trim();
    }

    const input: NewMatterInput = {
      slug,
      name: name.trim(),
      kind,
      subject: { type: shape.subject.type, label: subjectLabel.trim() },
      counterparty,
      stakeholder: stakeholder.trim().length > 0 ? stakeholder.trim() : null,
      extras: Object.keys(extrasOut).length > 0 ? extrasOut : undefined,
      privileged,
      key_facts: keyFacts,
    };

    try {
      await onCreate(input);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to create ${nounSingularLc}`,
      );
      setSubmitting(false);
    }
  };

  const stakeholderListId = `oscar-stakeholders-${area.id}`;

  return (
    <div className="oscar__modal-backdrop" onClick={onCancel}>
      <div
        className="oscar__modal oscar__modal--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="oscar__eyebrow">{area.name}</div>
        <h2 className="oscar__modal-title">New {nounSingularLc}</h2>

        <label className="oscar__field">
          <span className="oscar__field-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Short title — the lawyer's elevator description"
            disabled={submitting}
            className="oscar__input"
          />
          {slug && <span className="oscar__field-hint">slug: {slug}</span>}
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">{shape.subject.label}</span>
          <input
            type="text"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
            placeholder={shape.subject.placeholder}
            disabled={submitting}
            className="oscar__input"
          />
          {shape.subject.hint && (
            <span className="oscar__field-hint">{shape.subject.hint}</span>
          )}
        </label>

        {shape.counterparty && (
          <div className="oscar__field-group">
            <label className="oscar__field">
              <span className="oscar__field-label">
                {shape.counterparty.label}
                {shape.counterparty.required ? '' : ' (optional)'}
              </span>
              <input
                type="text"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder={shape.counterparty.placeholder}
                disabled={submitting}
                className="oscar__input"
              />
            </label>
            <label className="oscar__field">
              <span className="oscar__field-label">
                {shape.counterparty.roleLabel}
              </span>
              <select
                value={counterpartyRole}
                onChange={(e) => setCounterpartyRole(e.target.value as PartyRole)}
                disabled={submitting}
                className="oscar__input"
              >
                {shape.counterparty.roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="oscar__field">
          <span className="oscar__field-label">
            {shape.stakeholder.label} (optional)
          </span>
          <input
            type="text"
            value={stakeholder}
            onChange={(e) => handleStakeholderInput(e.target.value)}
            placeholder={shape.stakeholder.placeholder}
            disabled={submitting}
            className="oscar__input"
            list={stakeholderListId}
          />
          {stakeholderSuggestions.length > 0 && (
            <datalist id={stakeholderListId}>
              {stakeholderSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          {shape.stakeholder.hint && (
            <span className="oscar__field-hint">{shape.stakeholder.hint}</span>
          )}
        </label>

        <label className="oscar__field">
          <span className="oscar__field-label">{shape.kind.label}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={submitting}
            className="oscar__input"
          >
            {shape.kind.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {extrasFieldsVisible.length > 0 && (
          <div className="oscar__field-extras">
            {extrasFieldsVisible.map((f) => (
              <label key={f.key} className="oscar__field">
                <span className="oscar__field-label">{f.label}</span>
                {f.enumValues ? (
                  <select
                    value={extras[f.key] ?? ''}
                    onChange={(e) =>
                      setExtras({ ...extras, [f.key]: e.target.value })
                    }
                    disabled={submitting}
                    className="oscar__input"
                  >
                    <option value="">—</option>
                    {f.enumValues.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={extras[f.key] ?? ''}
                    onChange={(e) =>
                      setExtras({ ...extras, [f.key]: e.target.value })
                    }
                    placeholder={f.placeholder}
                    disabled={submitting}
                    className="oscar__input"
                  />
                )}
                {f.hint && <span className="oscar__field-hint">{f.hint}</span>}
              </label>
            ))}
          </div>
        )}

        <label className="oscar__field oscar__field--inline">
          <input
            type="checkbox"
            checked={privileged}
            onChange={(e) => {
              setPrivileged(e.target.checked);
              setPrivilegedTouched(true);
            }}
            disabled={submitting}
          />
          <span className="oscar__field-label">
            Privileged {nounSingularLc}
          </span>
          {!privilegedTouched && (
            <span className="oscar__field-hint">
              Defaulted from {nounSingularLc} kind. Override as needed.
            </span>
          )}
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
            {submitting ? 'Creating…' : `Create ${nounSingularLc}`}
          </button>
        </div>
      </div>
    </div>
  );
}
