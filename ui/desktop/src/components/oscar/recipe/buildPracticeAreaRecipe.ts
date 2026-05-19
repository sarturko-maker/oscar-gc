// Sprint 12 (ADR-041): per-recipe MCP loadout convention + matter scope-down.
// Generic builder consumed by every practice area. Commercial composes on top
// (its system prompt + redline MCP); the other 12 areas use the base shape.
//
// Load-bearing:
// - NO 'developer' platform extension (per ADR-041): Goose's Developer ships
//   bash + filesystem; agents with it have effective full-system access.
// - oscar-fs allowed-directories narrows to the matter folder (matter
//   scope-down). Sibling matters in the same area are not visible.

import type { Recipe } from '../../../api';
import type { PracticeArea } from '../practiceAreas';

const DEV_NODE_CMD = '/usr/bin/node';
const DEV_OSCAR_FS_BUNDLE = '/srv/projects/goose/ui/desktop/src/resources/mcps/oscar-fs/index.js';

function resolveNodeCmd(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/node/bin/node` : DEV_NODE_CMD;
}

function resolveOscarFsBundle(resourcesRoot: string | null): string {
  return resourcesRoot ? `${resourcesRoot}/mcps/oscar-fs/index.js` : DEV_OSCAR_FS_BUNDLE;
}

export interface BuildPracticeAreaRecipeOptions {
  area: PracticeArea;
  // Sprint 14 (ADR-047): two-folder layout. workingDir is the user-visible
  // matter folder under ~/Documents/Oscar GC/<Area>/<Matter>/ — where
  // matter.md, source documents, and outputs/ live. stateFolder is the
  // operational folder under ~/.config/oscar/state/ — where history.md
  // and notes.md live. Both are added to oscar-fs allowed-directories.
  workingDir: string;
  stateFolder: string;
  matterSlug?: string;
  resourcesRoot: string | null;
  // Commercial passes its bespoke system prompt; the generic default
  // anchors the agent to the practice-area scope when omitted.
  systemPrompt?: string;
  // Commercial passes the redline MCP; everywhere else this is empty.
  // Extra extensions append AFTER oscar-fs.
  extraExtensions?: Recipe['extensions'];
}

const defaultSystemPrompt = (
  area: PracticeArea,
  workingDir: string,
  stateFolder: string,
): string => `
You are Oscar GC's ${area.name} agent.

${area.body}

The current matter has two folders, both scoped via oscar-fs:
- Working folder: ${workingDir}
  Contains matter.md, user-droppable source documents, and outputs/ for
  generated artefacts (redlined .docx, etc.). $OSCAR_MATTER_DIR points here.
- State folder: ${stateFolder}
  Contains history.md (append-only event log) and notes.md (your free-form
  notes). Sibling matters are not visible.

The "Top of Mind" injection above contains the matter facts (subject,
counterparty, kind, key facts, privileged status, and any extras). Don't
ask the user to repeat them.

Skills in ~/.agents/skills/in-house-legal/ are auto-discovered. Invoke
skills by name when their procedural guidance is helpful; defer to skill
bodies for scope and steps.

Plain English. In-house perspective. Cite specific facts; flag uncertainty
rather than guessing. Match output to the audience: legal team in legal
idiom; business stakeholders in plain business framing.
`.trim();

export function buildPracticeAreaRecipe(opts: BuildPracticeAreaRecipeOptions): Recipe {
  return {
    version: '1.0.0',
    title: `Oscar GC — ${opts.area.name}`,
    description: opts.area.body,
    instructions:
      opts.systemPrompt ??
      defaultSystemPrompt(opts.area, opts.workingDir, opts.stateFolder),
    extensions: [
      {
        type: 'stdio',
        name: 'oscar-fs',
        description:
          'Filesystem MCP scoped to the matter working + state folders (Sprint 12 ADR-040, Sprint 14 ADR-047).',
        cmd: resolveNodeCmd(opts.resourcesRoot),
        args: [
          resolveOscarFsBundle(opts.resourcesRoot),
          opts.workingDir,
          opts.stateFolder,
        ],
        envs: {
          // Sprint 12 (ADR-037), Sprint 14 (ADR-047): skills consume
          // $OSCAR_MATTER_DIR to resolve matter-scoped paths. Points at the
          // working folder (user-visible matter dir), not state.
          OSCAR_MATTER_DIR: opts.workingDir,
        },
        timeout: 30,
      },
      ...(opts.extraExtensions ?? []),
    ],
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
