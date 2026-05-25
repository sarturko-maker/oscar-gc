// Sprint 20-M3 (ADR-083): MatterFacts + ProgrammeFacts section body.
// One component serves both IDs — the only difference is the eyebrow title,
// which comes from SECTION_META[sectionId]. Polls
// oscar:right-pane:read-matter-facts every 2 s; renders a labelled fact
// list when the matter has content, a faint placeholder when it doesn't.
//
// Sprint 29 M5 (ADR-098): when editingFacts is on, the section body swaps
// to a manual editor (MatterFactsEditor) that writes through
// oscar:matters:update + carries the Forge entry as a labelled footer.

import { useState } from 'react';
import {
  partyRoleLabel,
  subjectTypeLabel,
  extrasKeyLabel,
} from '../../matters/matterLabels';
import { kindLabel } from '../../matters/practiceAreaShapes';
import type { PartyRole, SubjectType } from '../../matters/types';
import { useRightPaneCoords, useRightPaneEditing } from '../RightPaneContext';
import { SECTION_META, type PanelSectionProps } from './registry';
import { usePanelReader } from './usePanelReader';
import MatterFactsEditor from './MatterFactsEditor';

interface FactRow {
  key: string;
  value: string;
}

export default function MatterFactsSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { areaId, slug } = useRightPaneCoords();
  const { editingFacts, endEditingFacts } = useRightPaneEditing();
  const { data, refresh } = usePanelReader(
    async () => {
      if (!areaId || !slug) return null;
      return window.electron.rightPane.readMatterFacts(areaId, slug);
    },
    [areaId, slug],
  );
  if (editingFacts && areaId && slug && data) {
    return (
      <section className="oscar__panel-section" data-section-id={sectionId} data-editing="true">
        <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
          {meta.title} — editing
        </span>
        <MatterFactsEditor
          areaId={areaId}
          slug={slug}
          initial={{
            name: data.name,
            subject: data.subject,
            counterparty: data.counterparty,
            kind: data.kind,
            stakeholder: data.stakeholder,
            privileged: data.privileged,
            key_facts_md: data.key_facts_md,
            extras: data.extras ?? {},
          }}
          onCancel={endEditingFacts}
          onSaved={() => {
            endEditingFacts();
            void refresh();
          }}
        />
      </section>
    );
  }

  const rows: FactRow[] = [];
  if (data?.subject) {
    rows.push({
      key: subjectTypeLabel(data.subject.type as SubjectType),
      value: data.subject.label,
    });
  }
  if (data?.counterparty) {
    rows.push({
      key: partyRoleLabel(data.counterparty.role as PartyRole),
      value: data.counterparty.name,
    });
  }
  if (data?.kind && areaId) {
    rows.push({ key: 'Kind', value: kindLabel(areaId, data.kind) });
  }
  if (data?.stakeholder) {
    rows.push({ key: 'Stakeholder', value: data.stakeholder });
  }
  if (data) {
    rows.push({ key: 'Privileged', value: data.privileged ? 'Yes' : 'No' });
  }
  if (data?.extras) {
    for (const [k, v] of Object.entries(data.extras)) {
      rows.push({ key: extrasKeyLabel(k), value: v });
    }
  }

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      {data ? (
        <div className="oscar__panel-section-body">
          <dl className="oscar__panel-section-dl">
            {rows.map((row) => (
              <div key={row.key} className="oscar__panel-section-dl-row">
                <dt>{row.key}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {data.key_facts_md.length > 0 && (
            <div className="oscar__panel-section-keyfacts">
              <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-subtitle">
                Key facts
              </span>
              <pre className="oscar__panel-section-keyfacts-body">
                {data.key_facts_md}
              </pre>
            </div>
          )}
          {data.tom_md && <TomBlock tomMd={data.tom_md} />}
        </div>
      ) : (
        <p className="oscar__panel-section-stub-body">No matter facts yet.</p>
      )}
    </section>
  );
}

function TomBlock({ tomMd }: { tomMd: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="oscar__panel-section-tom">
      <button
        type="button"
        className="oscar__panel-section-tom-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-subtitle">
          Top of mind {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <pre className="oscar__panel-section-tom-body">{tomMd}</pre>
      )}
    </div>
  );
}
