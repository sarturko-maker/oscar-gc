#!/usr/bin/env node
// Sprint 12 (ADR-037): orchestrator pass over skills/in-house-legal/**/SKILL.md.
// Replaces hardcoded plugin-slug-keyed matter paths with $OSCAR_MATTER_DIR
// per ADR-037; deletes the 9 matter-workspace stub skills (superseded by
// the Sprint 12 MattersLanding UI per ADR-036); appends an Apache modification
// provenance line per ADR-035.
//
// Idempotent: re-running on already-rewritten files is a no-op.

const fs = require('node:fs');
const path = require('node:path');

const SKILLS_ROOT = path.resolve(__dirname, '..', 'skills', 'in-house-legal');

const PROVENANCE_MARKER = '<!-- Oscar GC modifications (Sprint 12, ADR-037): matter paths rewritten to $OSCAR_MATTER_DIR -->';

const REWRITES = [
  // Matter folder + subpath references — the typical shape is
  //   `~/.config/oscar/state/<plugin-slug>/matters/<matter-slug>/<rest>`
  // and the matter slug is a literal placeholder string in the source.
  // Match patterns first; longer match wins (subpath before bare folder).
  {
    name: 'matter_archived_subpath',
    re: /~?\/?\.?config\/oscar\/state\/[a-z-]+\/matters\/_archived\/[^/\s`)\]]+(?=[/\s`)\]])/g,
    rep: '$OSCAR_MATTER_DIR/../_archived/${slug}',
  },
  {
    name: 'matter_subpath',
    re: /(~?\/?\.?config\/oscar\/state\/[a-z-]+\/matters\/<[^>]+>)\/([a-zA-Z0-9_.-]+)/g,
    rep: '$OSCAR_MATTER_DIR/$2',
  },
  {
    name: 'matter_folder',
    re: /~?\/?\.?config\/oscar\/state\/[a-z-]+\/matters\/<[^>]+>\/?/g,
    rep: '$OSCAR_MATTER_DIR/',
  },
];

const MATTER_WORKSPACE_DIRS = [];

function findSkillFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Track matter-workspace stub dirs separately for deletion.
      if (entry.name === 'matter-workspace' && /\/skills\/matter-workspace$/.test(p)) {
        MATTER_WORKSPACE_DIRS.push(p);
        continue;
      }
      out.push(...findSkillFiles(p));
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      out.push(p);
    }
  }
  return out;
}

function rewriteFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let next = original;
  const matched = {};
  for (const { name, re, rep } of REWRITES) {
    next = next.replace(re, (...args) => {
      matched[name] = (matched[name] ?? 0) + 1;
      // Build replacement using captures (replace doesn't expand $N in
      // function form — do it explicitly).
      if (typeof rep === 'string') {
        // Manually substitute $1, $2 with the captures (last arg is offset/string).
        const captures = args.slice(1, -2);
        return rep.replace(/\$(\d+)/g, (_, n) => captures[Number(n) - 1] ?? '');
      }
      return args[0];
    });
  }
  const changedPaths = next !== original;
  if (changedPaths && !next.includes(PROVENANCE_MARKER)) {
    // Append provenance after any existing provenance comment.
    const m = next.match(/<!-- Sourced from [^>]*-->\n?/);
    if (m) {
      const idx = (m.index ?? 0) + m[0].length;
      next = next.slice(0, idx) + PROVENANCE_MARKER + '\n' + next.slice(idx);
    } else {
      next = PROVENANCE_MARKER + '\n' + next;
    }
  }
  if (next !== original) {
    fs.writeFileSync(filePath, next, 'utf8');
    return { changed: true, matched };
  }
  return { changed: false, matched };
}

function deleteStubs() {
  for (const dir of MATTER_WORKSPACE_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[stub-delete] ${dir.replace(SKILLS_ROOT + '/', '')}`);
  }
  return MATTER_WORKSPACE_DIRS.length;
}

function main() {
  if (!fs.existsSync(SKILLS_ROOT)) {
    console.error(`SKILLS_ROOT not found: ${SKILLS_ROOT}`);
    process.exit(1);
  }
  const files = findSkillFiles(SKILLS_ROOT);
  console.log(`Found ${files.length} SKILL.md files (excl. matter-workspace stubs)`);
  console.log(`Found ${MATTER_WORKSPACE_DIRS.length} matter-workspace stub dirs to delete`);
  let changedCount = 0;
  const aggregate = {};
  for (const file of files) {
    const { changed, matched } = rewriteFile(file);
    if (changed) {
      changedCount += 1;
      for (const [k, v] of Object.entries(matched)) {
        aggregate[k] = (aggregate[k] ?? 0) + v;
      }
    }
  }
  console.log(`Rewrote ${changedCount} SKILL.md files`);
  for (const [k, v] of Object.entries(aggregate)) {
    console.log(`  ${k}: ${v} replacements`);
  }
  const deleted = deleteStubs();
  console.log(`Deleted ${deleted} matter-workspace stub dirs`);
}

main();
