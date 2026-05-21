// Sprint 20-M5 (ADR-086): renderer-side wrapper. Main composes the
// `## Skills available in this area` block from area_overrides.enabled_skills,
// the bundled-library inventory (<resourcesRoot>/skills/in-house-legal/),
// the user-added inventory (~/.agents/skills/), and goosed's auto-discovered
// skill metadata (GET /config/slash_commands). On any failure the recipe
// still spawns — block is omitted (matches renderPlaybooksBlock fallback).

export async function renderSkillsBlock(
  areaId: string | null | undefined,
): Promise<string | null> {
  if (!areaId) return null;
  try {
    return await window.electron.skills.renderBlock(areaId);
  } catch (err) {
    console.warn('[skills] renderBlock failed; recipe omits Skills block', err);
    return null;
  }
}
