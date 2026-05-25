// Sprint M2 (ADR-070): closed section-ID enum + per-section meta + component
// registry. RightPaneShell never imports section bodies directly — it reads
// from sectionRegistry, so adding a real body is a one-line edit here.
// Sprint 28 M2 (ADR-092): Tools added.
// Sprint 29 M2 (ADR-095): Redlining / Forum / Deadlines stubs dropped —
// `redline` already lives in Tools, the others advertised functionality
// that does not yet ship.

import type { ComponentType } from 'react';
import MatterFactsSection from './MatterFactsSection';
import HistorySection from './HistorySection';
import PlaybooksSection from './PlaybooksSection';
import SkillsSection from './SkillsSection';
import ToolsSection from './ToolsSection';

export const PANEL_SECTION_IDS = [
  'MatterFacts',
  'ProgrammeFacts',
  'Tools',
  'Skills',
  'Playbooks',
  'History',
] as const;

export type PanelSectionId = (typeof PANEL_SECTION_IDS)[number];

export const isPanelSectionId = (v: unknown): v is PanelSectionId =>
  typeof v === 'string' &&
  (PANEL_SECTION_IDS as readonly string[]).includes(v);

interface SectionMeta {
  title: string;
}

export const SECTION_META: Record<PanelSectionId, SectionMeta> = {
  MatterFacts: { title: 'Matter Facts' },
  ProgrammeFacts: { title: 'Programme Facts' },
  Tools: { title: 'Tools' },
  Skills: { title: 'Skills' },
  Playbooks: { title: 'Playbooks' },
  History: { title: 'History' },
};

export interface PanelSectionProps {
  sectionId: PanelSectionId;
}

export const sectionRegistry: Record<
  PanelSectionId,
  ComponentType<PanelSectionProps>
> = {
  MatterFacts: MatterFactsSection,
  ProgrammeFacts: MatterFactsSection,
  Tools: ToolsSection,
  Skills: SkillsSection,
  Playbooks: PlaybooksSection,
  History: HistorySection,
};
