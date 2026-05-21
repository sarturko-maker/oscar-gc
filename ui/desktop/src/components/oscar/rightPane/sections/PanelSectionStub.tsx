// Sprint M2 (ADR-070): shared stub renderer for every PanelSectionId. M2
// is the wiring sprint — every section maps here. M3+ swap individual
// entries in registry.ts to real components.

import { SECTION_META, type PanelSectionProps } from './registry';

export default function PanelSectionStub({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      {meta.comingIn && (
        <p className="oscar__panel-section-stub-body">
          coming in {meta.comingIn}
        </p>
      )}
    </section>
  );
}
