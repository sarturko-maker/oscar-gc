// Sprint 20-M5 (ADR-086): main-process skill store. Joins Goose's
// auto-discovered skill metadata (served from /config/slash_commands with
// command_type === 'Skill') against the bundled library inventory
// (<resourcesRoot>/skills/in-house-legal/<plugin>/skills/) and the user-
// added inventory (~/.agents/skills/). No YAML parser — Goose already
// parsed SKILL.md frontmatter server-side via serde_yaml. No new npm dep
// (reuse per CLAUDE.md; mirrors M4 ADR-085 computercontroller pivot).

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SkillMode = 'all' | 'allow' | 'deny';

export interface SkillEntry {
  slug: string;
  name: string;
  description: string;
  source: 'bundled' | 'user';
  bundled: boolean;
  // True when the skill is in-scope under the current (mode, slugs):
  //   all   → always true
  //   allow → slug ∈ slugs
  //   deny  → slug ∉ slugs
  enabled: boolean;
}

export interface SkillsListResult {
  mode: SkillMode;
  skills: SkillEntry[];
}

// Subset of GET /config/slash_commands entries — kept here so this module
// is free of api/types.gen.ts imports (which transit the full SDK closure).
export interface SkillSlashCommand {
  command: string;
  command_type: string;
  help: string;
}

const USER_SKILLS_ROOT = path.join(os.homedir(), '.agents', 'skills');

export const userSkillsRoot = (): string => USER_SKILLS_ROOT;

// Walk <inHouseLegalRoot>/<plugin>/skills/<slug>/SKILL.md for every plugin
// in `plugins`. Pass [] (or all 9 plugins) to compute the global bundled
// set for delete-safety; pass area.bundled_skill_sources to scope to one
// practice area.
export async function readBundledInventory(
  inHouseLegalRoot: string,
  plugins: readonly string[],
): Promise<Set<string>> {
  const slugs = new Set<string>();
  for (const plugin of plugins) {
    const skillsDir = path.join(inHouseLegalRoot, plugin, 'skills');
    let entries: string[] = [];
    try {
      entries = await fs.readdir(skillsDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      try {
        const stat = await fs.stat(path.join(skillsDir, name));
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }
      try {
        await fs.access(path.join(skillsDir, name, 'SKILL.md'));
      } catch {
        continue;
      }
      slugs.add(name);
    }
  }
  return slugs;
}

// Walk ~/.agents/skills/<slug>/SKILL.md (Sprint 11 / ADR-031 convention).
// Returns the set of user-added slugs that resolve to a real SKILL.md.
export async function readUserSkillSlugs(): Promise<Set<string>> {
  const slugs = new Set<string>();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(USER_SKILLS_ROOT);
  } catch {
    return slugs;
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    try {
      const stat = await fs.stat(path.join(USER_SKILLS_ROOT, name));
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    try {
      await fs.access(path.join(USER_SKILLS_ROOT, name, 'SKILL.md'));
    } catch {
      continue;
    }
    slugs.add(name);
  }
  return slugs;
}

// Pure shape. Joins slash-commands with bundled + user sets, filters
// orphans (slugs that appear in neither set), computes the per-row
// enabled state. Bundled rows first, then user rows; alpha within group.
export function joinSkills(
  slashCommands: readonly SkillSlashCommand[],
  areaBundledSlugs: ReadonlySet<string>,
  userSlugs: ReadonlySet<string>,
  mode: SkillMode,
  overrideSlugs: readonly string[],
): SkillEntry[] {
  const overrideSet = new Set(overrideSlugs);
  const seen = new Set<string>();
  const rows: SkillEntry[] = [];
  for (const cmd of slashCommands) {
    if (cmd.command_type !== 'Skill') continue;
    const slug = cmd.command;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const bundled = areaBundledSlugs.has(slug);
    const user = userSlugs.has(slug);
    if (!bundled && !user) continue;
    let enabled: boolean;
    if (mode === 'all') enabled = true;
    else if (mode === 'allow') enabled = overrideSet.has(slug);
    else enabled = !overrideSet.has(slug);
    rows.push({
      slug,
      name: slug,
      description: cmd.help ?? '',
      source: bundled ? 'bundled' : 'user',
      bundled,
      enabled,
    });
  }
  rows.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'bundled' ? -1 : 1;
    return a.slug.localeCompare(b.slug);
  });
  return rows;
}

// Resolve the slug list to render in the prompt enumeration block. Honours
// mode and intersects against on-disk presence via joined (so ghost slugs
// in override slugs don't surface).
export function resolveEnabledSlugs(joined: readonly SkillEntry[]): string[] {
  return joined.filter((r) => r.enabled).map((r) => r.slug);
}

const SKILLS_BLOCK_HEADING = '## Skills available in this area';
const SKILLS_BLOCK_BODY_INTRO = 'You may use these skills when relevant:';
const SKILLS_BLOCK_FOOTER = 'Ignore any other skills you may discover.';

// Compose the recipe-instructions block. Returns null when zero slugs
// resolve so the recipe-builder skips the slot. Block shape is stable
// across modes; the "ignore others" footer is the soft-scoping signal.
export function renderSkillsBlockMarkdown(allowed: readonly string[]): string | null {
  if (allowed.length === 0) return null;
  const bullets = allowed.map((slug) => `- ${slug}`).join('\n');
  return [
    SKILLS_BLOCK_HEADING,
    '',
    SKILLS_BLOCK_BODY_INTRO,
    bullets,
    '',
    SKILLS_BLOCK_FOOTER,
  ].join('\n');
}

export interface DeleteUserSkillResult {
  ok: boolean;
  code?: 'EBUNDLED_DELETE' | 'ENOENT' | 'EIO';
  message?: string;
}

// Remove a user-added skill directory. Refuses if the slug is in the
// bundled set (caller passes the global bundled set across all plugins).
// Defence in depth — the pane already hides the delete affordance for
// bundled rows.
export async function deleteUserSkillDir(
  slug: string,
  globalBundledSlugs: ReadonlySet<string>,
): Promise<DeleteUserSkillResult> {
  if (globalBundledSlugs.has(slug)) {
    return {
      ok: false,
      code: 'EBUNDLED_DELETE',
      message: 'Bundled skills cannot be deleted',
    };
  }
  const target = path.join(USER_SKILLS_ROOT, slug);
  try {
    const stat = await fs.stat(target);
    if (!stat.isDirectory()) {
      return { ok: false, code: 'ENOENT', message: 'Skill directory not found' };
    }
  } catch {
    return { ok: false, code: 'ENOENT', message: 'Skill directory not found' };
  }
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    return { ok: false, code: 'EIO', message: (err as Error).message };
  }
  return { ok: true };
}
