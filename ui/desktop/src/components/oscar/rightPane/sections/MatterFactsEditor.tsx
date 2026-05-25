// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 29 M5 (ADR-098): in-pane manual editor for matter facts. Reuses
// the per-area PracticeAreaShape (subject family / counterparty roles /
// kind options / extras-by-kind) so the editing surface mirrors what the
// new-matter dialog already understands. Slug is immutable.
//
// The form footer carries the Forge entry — a labelled affordance that
// deep-links into Forge's modifyArea flow for changes the form cannot
// represent (description, panel sections, skill loadout, MCP loadout).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPracticeAreaShape,
  type ExtrasField,
} from '../../matters/practiceAreaShapes';
import type { PartyRole, SubjectType } from '../../matters/types';

interface MatterFactsEditorProps {
  areaId: string;
  slug: string;
  initial: {
    name: string;
    subject: { type: string; label: string } | null;
    counterparty: { role: string; name: string } | null;
    kind: string | null;
    stakeholder: string | null;
    privileged: boolean;
    key_facts_md: string;
    extras: Record<string, string>;
  };
  onCancel: () => void;
  onSaved: () => void;
}

const visibleExtras = (fields: ExtrasField[] | undefined, kind: string): ExtrasField[] =>
  (fields ?? []).filter(
    (f) => !f.showWhenKindIn || f.showWhenKindIn.includes(kind),
  );

export default function MatterFactsEditor({
  areaId,
  slug,
  initial,
  onCancel,
  onSaved,
}: MatterFactsEditorProps) {
  const navigate = useNavigate();
  const shape = getPracticeAreaShape(areaId);

  const [name, setName] = useState(initial.name);
  const [subjectLabel, setSubjectLabel] = useState(initial.subject?.label ?? '');
  const [counterpartyName, setCounterpartyName] = useState(initial.counterparty?.name ?? '');
  const [counterpartyRole, setCounterpartyRole] = useState<PartyRole>(
    (initial.counterparty?.role as PartyRole | undefined) ??
      shape?.counterparty?.defaultRole ??
      'counterparty',
  );
  const [kind, setKind] = useState(
    initial.kind ?? shape?.kind.options[0]?.value ?? 'other',
  );
  const [stakeholder, setStakeholder] = useState(initial.stakeholder ?? '');
  const [privileged, setPrivileged] = useState(initial.privileged);
  const [keyFacts, setKeyFacts] = useState(initial.key_facts_md);
  const [extras, setExtras] = useState<Record<string, string>>({ ...initial.extras });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // If kind switches to one that hides a key, retain the value so the user
  // can flip back without re-typing. submit() filters by visibleExtras.
  const extrasFieldsVisible = useMemo(
    () => visibleExtras(shape?.extras, kind),
    [shape, kind],
  );

  useEffect(() => {
    if (!shape) setError(`No practice-area shape found for "${areaId}".`);
  }, [shape, areaId]);

  if (!shape) {
    return (
      <div className="oscar__panel-section-body" data-testid="matter-facts-editor-no-shape">
        <p className="oscar__matters-error">{error ?? 'Practice area shape missing.'}</p>
        <button type="button" onClick={onCancel}>Close</button>
      </div>
    );
  }

  const submit = async (): Promise<void> => {
    if (!name.trim() || !subjectLabel.trim() || !kind) {
      setError(`Name, ${shape.subject.label.toLowerCase()}, and kind are required.`);
      return;
    }
    if (shape.counterparty?.required && !counterpartyName.trim()) {
      setError(`${shape.counterparty.label} is required.`);
      return;
    }
    setSaving(true);
    setError(null);
    const counterparty =
      shape.counterparty && counterpartyName.trim().length > 0
        ? { role: counterpartyRole, name: counterpartyName.trim() }
        : null;
    const extrasOut: Record<string, string> = {};
    for (const f of extrasFieldsVisible) {
      const v = extras[f.key];
      if (v && v.trim().length > 0) extrasOut[f.key] = v.trim();
    }
    try {
      const res = await window.electron.matters.update(areaId, slug, {
        name: name.trim(),
        subject: {
          type: shape.subject.type as SubjectType,
          label: subjectLabel.trim(),
        },
        counterparty,
        kind,
        stakeholder: stakeholder.trim().length > 0 ? stakeholder.trim() : null,
        extras: Object.keys(extrasOut).length > 0 ? extrasOut : undefined,
        privileged,
        key_facts: keyFacts,
      });
      if (!res.ok) {
        setError(res.message ?? 'Save failed');
        return;
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openForge = (): void => {
    navigate(`/forge?modifyArea=${encodeURIComponent(areaId)}`, {
      state: { disableAnimation: true },
    });
  };

  return (
    <div className="oscar__panel-section-body" data-testid="matter-facts-editor">
      {error && (
        <p className="oscar__matters-error" data-testid="matter-facts-error">{error}</p>
      )}
      <div className="oscar__matter-edit-field">
        <label className="oscar__eyebrow oscar__eyebrow--bare">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="matter-facts-edit-name"
        />
      </div>
      <div className="oscar__matter-edit-field">
        <label className="oscar__eyebrow oscar__eyebrow--bare">{shape.subject.label}</label>
        <input
          type="text"
          value={subjectLabel}
          onChange={(e) => setSubjectLabel(e.target.value)}
          placeholder={shape.subject.placeholder}
          data-testid="matter-facts-edit-subject"
        />
      </div>
      {shape.counterparty && (
        <div className="oscar__matter-edit-field">
          <label className="oscar__eyebrow oscar__eyebrow--bare">{shape.counterparty.label}</label>
          <div className="oscar__matter-edit-counterparty">
            <select
              value={counterpartyRole}
              onChange={(e) => setCounterpartyRole(e.target.value as PartyRole)}
              data-testid="matter-facts-edit-counterparty-role"
            >
              {shape.counterparty.roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder={shape.counterparty.placeholder}
              data-testid="matter-facts-edit-counterparty-name"
            />
          </div>
        </div>
      )}
      <div className="oscar__matter-edit-field">
        <label className="oscar__eyebrow oscar__eyebrow--bare">{shape.kind.label}</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          data-testid="matter-facts-edit-kind"
        >
          {shape.kind.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="oscar__matter-edit-field">
        <label className="oscar__eyebrow oscar__eyebrow--bare">{shape.stakeholder.label}</label>
        <input
          type="text"
          value={stakeholder}
          onChange={(e) => setStakeholder(e.target.value)}
          placeholder={shape.stakeholder.placeholder}
          data-testid="matter-facts-edit-stakeholder"
        />
      </div>
      {extrasFieldsVisible.map((field) => (
        <div className="oscar__matter-edit-field" key={field.key}>
          <label className="oscar__eyebrow oscar__eyebrow--bare">{field.label}</label>
          {field.enumValues ? (
            <select
              value={extras[field.key] ?? ''}
              onChange={(e) => setExtras({ ...extras, [field.key]: e.target.value })}
              data-testid={`matter-facts-edit-extras-${field.key}`}
            >
              <option value=""></option>
              {field.enumValues.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={extras[field.key] ?? ''}
              onChange={(e) => setExtras({ ...extras, [field.key]: e.target.value })}
              placeholder={field.placeholder ?? ''}
              data-testid={`matter-facts-edit-extras-${field.key}`}
            />
          )}
        </div>
      ))}
      <div className="oscar__matter-edit-field oscar__matter-edit-field--inline">
        <label>
          <input
            type="checkbox"
            checked={privileged}
            onChange={(e) => setPrivileged(e.target.checked)}
            data-testid="matter-facts-edit-privileged"
          />
          {' Privileged'}
        </label>
      </div>
      <div className="oscar__matter-edit-field">
        <label className="oscar__eyebrow oscar__eyebrow--bare">Key facts</label>
        <textarea
          rows={6}
          value={keyFacts}
          onChange={(e) => setKeyFacts(e.target.value)}
          data-testid="matter-facts-edit-key-facts"
        />
      </div>
      <div className="oscar__matter-edit-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          data-testid="matter-facts-edit-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          data-testid="matter-facts-edit-save"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="oscar__matter-edit-forge">
        <button
          type="button"
          className="oscar__matter-edit-forge-button"
          onClick={openForge}
          data-testid="matter-facts-edit-open-forge"
        >
          → Ask Forge to change this area's loadout
        </button>
        <p className="oscar__matter-edit-forge-pitch">
          Forge is the meta-agent for conversational edits to this area's agent —
          description, skills, tools — when the form above isn't enough.
        </p>
      </div>
    </div>
  );
}
