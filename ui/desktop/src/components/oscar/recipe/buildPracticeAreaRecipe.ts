// Sprint 12 (ADR-041): per-recipe MCP loadout convention + matter scope-down.
// Generic builder consumed by every practice area. Commercial composes on top
// (its system prompt + redline MCP); the other 12 areas use the base shape.
//
// Load-bearing:
// - NO 'developer' platform extension (per ADR-041): Goose's Developer ships
//   bash + filesystem; agents with it have effective full-system access.
// - oscar-fs allowed-directories narrows to the matter folder (matter
//   scope-down). Sibling matters in the same area are not visible.

import type { ExtensionConfig, Recipe } from '../../../api';
import type { PracticeArea } from '../practiceAreas';
import { buildTavilyExtension } from '../onboarding/onboardingRecipe';
import type { OscarCompanyContext } from '../hooks/useOscarProfile';
import { renderCompanyContextBlock } from './companyContextBlock';

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
  // Extra extensions append AFTER oscar-fs and the platform-extension set.
  extraExtensions?: Recipe['extensions'];
  // Sprint 18 (ADR-065): platform extensions the user has enabled in
  // config.yaml (Extensions Settings page). Threaded by call sites from
  // ConfigContext.extensionsList → deriveEnabledPlatformExtensions. The
  // recipe carries them explicitly because resolve_extensions_for_new_session
  // returns recipe extensions only when a recipe is in play.
  enabledPlatformExtensions?: ExtensionConfig[];
  // Sprint 15 (ADR-053): company_context block injected at recipe-build
  // time. Renders to a markdown "## About this company" block prepended
  // to instructions — the load-bearing wire that briefs the agent at
  // turn 1. Null when v2-migrated stub (captured_via="needs-re-intake")
  // or when intake hasn't run; OscarOnboardingGuard catches that case.
  companyContext?: OscarCompanyContext | null;
}

const defaultSystemPrompt = (
  area: PracticeArea,
  workingDir: string,
  stateFolder: string,
): string => `
You are Oscar GC's ${area.name} agent.

${area.body}

# Use the "About this company" block actively

The "About this company" block at the top of these instructions (above this
prompt) captures the in-house lawyer's industry depth, geography, regulatory
baseline (with provenance per framework), recurring matter shapes,
stakeholders and escalation thresholds, risk appetite, and any open notes
from intake. **This block is load-bearing — use it on every substantive
response.** Cite specific frameworks, jurisdictions, stakeholder thresholds,
and recurring-matter patterns when they bear on the question. If the
regulatory baseline lists DORA, PSD2, HIPAA, AI Act, or any framework
relevant to the current matter, reference it by name. If the stakeholders
block names a CFO escalation threshold of £500k, factor that into commercial
advice. **Do not give a generic answer when the company context makes a
sharper one available** — that is the failure mode this block exists to
prevent.

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
  const extensions: NonNullable<Recipe['extensions']> = [
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
    // Sprint 18 (ADR-063, ADR-065): the user's enabled platform extensions
    // (Memory, Top of Mind, Apps, Todo, Summon, Extension Manager, Chat
    // Recall, Auto Visualiser by default — flip on/off in Extensions UI).
    ...(opts.enabledPlatformExtensions ?? []),
    ...(opts.extraExtensions ?? []),
    // Sprint 16 (ADR-057): Tavily attached unconditionally; env_keys +
    // URI substitution resolve the key at session-spawn from env or
    // keyring. Absent key → SSE connect fails → rule 4 fallback narrates.
    buildTavilyExtension(),
  ];
  const baseInstructions =
    opts.systemPrompt ??
    defaultSystemPrompt(opts.area, opts.workingDir, opts.stateFolder);
  const companyBlock = renderCompanyContextBlock(opts.companyContext);
  const instructions = companyBlock
    ? `${companyBlock}\n\n${baseInstructions}`
    : baseInstructions;
  return {
    version: '1.0.0',
    title: `Oscar GC — ${opts.area.name}`,
    description: opts.area.body,
    instructions,
    extensions,
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
