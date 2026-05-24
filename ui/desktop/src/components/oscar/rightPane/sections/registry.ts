// Sprint M2 (ADR-070): closed section-ID enum + per-section meta + component
// registry. M2 maps every ID to the shared PanelSectionStub; M3 fills
// MatterFacts + ProgrammeFacts + History; M4 fills Playbooks; M5 fills
// Skills. RightPaneShell never imports section bodies directly — it reads
// from sectionRegistry, so adding a real body is a one-line edit here.
// Sprint 28 M2 (ADR-092): Tools added — surfaces MCPs (bundled + per-area
// installed integrations) that today only Forge Mode D could affect.

import type { ComponentType } from 'react';
import PanelSectionStub from './PanelSectionStub';
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
  'Redlining',
  'Forum',
  'Deadlines',
  'History',
] as const;

export type PanelSectionId = (typeof PANEL_SECTION_IDS)[number];

export const isPanelSectionId = (v: unknown): v is PanelSectionId =>
  typeof v === 'string' &&
  (PANEL_SECTION_IDS as readonly string[]).includes(v);

interface SectionMeta {
  title: string;
  /** Set on stub entries only; omitted once the section has a real body. */
  comingIn?: string;
}

export const SECTION_META: Record<PanelSectionId, SectionMeta> = {
  MatterFacts: { title: 'Matter Facts' },
  ProgrammeFacts: { title: 'Programme Facts' },
  Tools: { title: 'Tools' },
  Skills: { title: 'Skills' },
  Playbooks: { title: 'Playbooks' },
  Redlining: { title: 'Redlining', comingIn: 'soon' },
  Forum: { title: 'Forum', comingIn: 'soon' },
  Deadlines: { title: 'Deadlines', comingIn: 'soon' },
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
  Redlining: PanelSectionStub,
  Forum: PanelSectionStub,
  Deadlines: PanelSectionStub,
  History: HistorySection,
};
