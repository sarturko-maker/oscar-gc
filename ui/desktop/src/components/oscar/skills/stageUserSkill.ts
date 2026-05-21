// Sprint 20-M6 (ADR-087): atomic stage of a user-uploaded SKILL.md into
// ~/.agents/skills/<slug>/SKILL.md. Sibling to skillStore.ts — same
// USER_SKILLS_ROOT. Drop affordance in SkillsSection.tsx hands off
// (slug, content) here via the oscar:skills:stage-for-review IPC; the
// renderer then deep-links Forge to #/forge?reviewSkill=<absPath> where
// Mode C reads, enriches, and binds (systemPrompt.ts Mode C).
//
// Validation gates (in order): safeSlug regex → bundled-collision →
// frontmatter delimiters + `name:` field → no existing SKILL.md at the
// target. Atomicity via fs.writeFile { flag: 'wx' } — mirrors M4's
// oscar:playbooks:upload pattern (main.ts:2405). No YAML parser — Goose's
// /config/slash_commands re-walks ~/.agents/skills/ on every call and
// parses frontmatter server-side via serde_yaml.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USER_SKILLS_ROOT = path.join(os.homedir(), '.agents', 'skills');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const FRONTMATTER_RE =
  /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

const NAME_FIELD_RE = /^name\s*:\s*\S/m;

export type StageUserSkillErrorCode =
  | 'EBADSLUG'
  | 'EBUNDLED_COLLISION'
  | 'EBADFRONTMATTER'
  | 'EEXIST'
  | 'EIO';

export type StageUserSkillResult =
  | { ok: true; absPath: string }
  | { ok: false; code: StageUserSkillErrorCode; message: string };

function safeSlug(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;
  if (!SLUG_RE.test(raw)) return null;
  return raw;
}

function validateFrontmatter(content: string): boolean {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return false;
  const body = match[1] ?? '';
  return NAME_FIELD_RE.test(body);
}

export async function stageUserSkill(
  slugRaw: string,
  contentRaw: string,
  globalBundledSlugs: ReadonlySet<string>,
): Promise<StageUserSkillResult> {
  const slug = safeSlug(slugRaw);
  if (!slug) {
    return {
      ok: false,
      code: 'EBADSLUG',
      message: 'Slug must be lowercase kebab-case (a–z, 0–9, hyphens), up to 64 chars',
    };
  }

  if (globalBundledSlugs.has(slug)) {
    return {
      ok: false,
      code: 'EBUNDLED_COLLISION',
      message: `Slug '${slug}' is already used by a bundled in-house skill. Rename the file and drop again.`,
    };
  }

  if (typeof contentRaw !== 'string' || !validateFrontmatter(contentRaw)) {
    return {
      ok: false,
      code: 'EBADFRONTMATTER',
      message:
        'SKILL.md must start with --- … --- frontmatter containing a `name:` field',
    };
  }

  const slugDir = path.join(USER_SKILLS_ROOT, slug);
  const target = path.join(slugDir, 'SKILL.md');

  try {
    await fs.mkdir(slugDir, { recursive: true, mode: 0o700 });
  } catch (err) {
    return {
      ok: false,
      code: 'EIO',
      message: `mkdir failed: ${(err as Error).message}`,
    };
  }

  try {
    await fs.writeFile(target, contentRaw, { flag: 'wx', mode: 0o600 });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'EEXIST') {
      return {
        ok: false,
        code: 'EEXIST',
        message: `~/.agents/skills/${slug}/SKILL.md already exists. Delete the existing skill first.`,
      };
    }
    return {
      ok: false,
      code: 'EIO',
      message: `write failed: ${(err as Error).message}`,
    };
  }

  return { ok: true, absPath: target };
}

export const userSkillsRootForStage = (): string => USER_SKILLS_ROOT;
