// Sprint M2 (ADR-070): closed section-ID enum + per-section meta + component
// registry. M2 maps every ID to the shared PanelSectionStub; M3 fills
// MatterFacts + ProgrammeFacts + History; M4 fills Playbooks; M5 fills
// Skills. RightPaneShell never imports section bodies directly — it reads
// from sectionRegistry, so adding a real body is a one-line edit here.

import type { ComponentType } from 'react';
import PanelSectionStub from './PanelSectionStub';
import MatterFactsSection from './MatterFactsSection';
import HistorySection from './HistorySection';

export const PANEL_SECTION_IDS = [
  'MatterFacts',
  'ProgrammeFacts',
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
  Skills: { title: 'Skills', comingIn: 'M5' },
  Playbooks: { title: 'Playbooks', comingIn: 'M4' },
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
  Skills: PanelSectionStub,
  Playbooks: PanelSectionStub,
  Redlining: PanelSectionStub,
  Forum: PanelSectionStub,
  Deadlines: PanelSectionStub,
  History: HistorySection,
};
