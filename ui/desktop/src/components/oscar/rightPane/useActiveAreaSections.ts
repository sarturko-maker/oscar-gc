// Sprint M2 (ADR-070): composition hook for the right-pane section stack.
// Pure derivation from (areaId, profile) — no IPC. Resolution order:
//   override (area_overrides.panel_sections)
//     ?? shape default (PRACTICE_AREA_SHAPES[areaId].defaultPanelSections)
//     ?? Forge fall-through (entry_noun → trio).
// The override array is filter-guarded against stale string IDs so a future
// enum-member drop doesn't render unknown sections.

import { useOscarProfile } from '../hooks/useOscarProfile';
import { PRACTICE_AREA_SHAPES } from '../matters/practiceAreaShapes';
import {
  isPanelSectionId,
  type PanelSectionId,
} from './sections/registry';

const PROGRAMME_FALLTHROUGH: PanelSectionId[] = [
  'ProgrammeFacts',
  'Skills',
  'Playbooks',
];
const MATTER_FALLTHROUGH: PanelSectionId[] = [
  'MatterFacts',
  'Skills',
  'Playbooks',
];

// Sprint 35 (ADR-113): Tabular Review is a general batch-review capability, so
// its launcher is appended to every area's section stack (after the area's own
// sections, before any History tail) rather than added to all 13 shapes.
function withTabularReview(sections: PanelSectionId[]): PanelSectionId[] {
  if (sections.includes('TabularReview')) return sections;
  const i = sections.indexOf('History');
  if (i === -1) return [...sections, 'TabularReview'];
  return [...sections.slice(0, i), 'TabularReview', ...sections.slice(i)];
}

export function useActiveAreaSections(
  areaId: string | null,
): PanelSectionId[] {
  const { profile } = useOscarProfile();
  if (!areaId) return [];

  const areaEntry = profile?.practice_areas.find((pa) => pa.id === areaId);
  const override = areaEntry?.area_overrides?.panel_sections;
  if (override && override.length > 0) {
    return withTabularReview(override.filter(isPanelSectionId));
  }

  const shape = PRACTICE_AREA_SHAPES[areaId];
  if (shape) return withTabularReview(shape.defaultPanelSections);

  const isProgramme = areaEntry?.entry_noun?.singular === 'Programme';
  return withTabularReview(isProgramme ? PROGRAMME_FALLTHROUGH : MATTER_FALLTHROUGH);
}
