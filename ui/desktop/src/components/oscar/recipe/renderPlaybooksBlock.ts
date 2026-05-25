// Sprint 20-M4 (ADR-085): renderer-side wrapper that asks the main process
// to extract always-on playbooks and format the `## Playbooks in scope`
// block. Mirrors renderCompanyContextBlock shape (string | null), but is
// async because extraction hits the bundled computercontroller MCP.
//
// Single IPC call returns the finished markdown block. main-process handler
// owns extraction, per-file budget redistribution, and truncation — see
// playbookStore.ts + main.ts:oscar:playbooks:render-block.

import type { OscarAreaOverrides } from '../hooks/useOscarProfile';

export const PLAYBOOKS_ALWAYS_ON_CHAR_CAP = 8000;

export async function renderPlaybooksBlock(
  areaOverrides: OscarAreaOverrides | null | undefined,
  charCap: number = PLAYBOOKS_ALWAYS_ON_CHAR_CAP,
): Promise<string | null> {
  const alwaysOn = areaOverrides?.playbooks?.always_on ?? [];
  if (alwaysOn.length === 0) return null;
  try {
    return await window.electron.playbooks.renderBlock(alwaysOn, charCap);
  } catch (err) {
    // Failure-to-extract should NOT break recipe build. Recipe still spawns
    // without the playbooks block; lawyer sees pane state immediately so
    // they have visual feedback. ADR-085 documents this.
    console.warn('[playbooks] renderBlock failed; recipe omits Playbooks block', err);
    return null;
  }
}

// Sprint 29 M6 (ADR-099): on-demand discovery block. Empty list → null;
// builder skips the slot.
export async function renderOnDemandPlaybooksBlock(
  areaId: string,
  areaOverrides: OscarAreaOverrides | null | undefined,
): Promise<string | null> {
  const alwaysOn = areaOverrides?.playbooks?.always_on ?? [];
  try {
    return await window.electron.playbooks.renderOnDemandBlock(areaId, alwaysOn);
  } catch (err) {
    console.warn('[playbooks] renderOnDemandBlock failed; recipe omits on-demand block', err);
    return null;
  }
}
