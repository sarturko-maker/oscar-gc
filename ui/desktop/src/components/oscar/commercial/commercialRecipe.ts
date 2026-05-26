// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ExtensionConfig, Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';
import { buildPracticeAreaRecipe } from '../recipe/buildPracticeAreaRecipe';
import type {
  OscarAreaOverrides,
  OscarCompanyContext,
} from '../hooks/useOscarProfile';

const DEV_REDLINE_VENV_BIN = '/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server';

// Sprint 31 (ADR-103, supersedes ADR-022): bundled adeu lives in CPython's
// site-packages, not a venv. Invoke via `python -m adeu.server` so the
// bundled python interpreter loads the module directly — sidesteps the
// console-script's hardcoded shebang that would point at the build host.
// Dev path keeps the in-place venv (shebang correct because venv lives at
// the path the dev shell created it).
function resolveRedlineCmd(resourcesRoot: string | null): {
  cmd: string;
  args: string[];
} {
  if (resourcesRoot) {
    return {
      cmd: `${resourcesRoot}/python/cpython/bin/python3`,
      args: ['-m', 'adeu.server'],
    };
  }
  return { cmd: DEV_REDLINE_VENV_BIN, args: [] };
}

// Sprint 12 (ADR-041), Sprint 14 (ADR-047): composes the generic practice-area
// builder. oscar-fs scoped to BOTH the working folder (~/Documents/Oscar GC/...)
// and the state folder (~/.config/oscar/state/...); redline MCP added for
// adeu redlines; bespoke SYSTEM_PROMPT replaces the generic default.
// Sprint 15 (ADR-053): companyContext pass through.
// Sprint 16 (ADR-057): tavily key handled via env_keys on the extension; no
// per-call param needed.
// Sprint 17 (ADR-061): installedConfigs threaded through — lawyer-added
// integrations from installed_integrations.json land after redline in
// extraExtensions. Empty array when nothing's been added.
export async function buildCommercialRecipe(
  workingDir: string,
  stateFolder: string,
  resourcesRoot: string | null,
  homeDir: string,
  companyContext: OscarCompanyContext | null,
  installedConfigs: NonNullable<Recipe['extensions']> = [],
  // Sprint 18 (ADR-065): user-enabled platform extensions threaded from
  // MattersLanding.openMatter (ConfigContext.extensionsList snapshot).
  enabledPlatformExtensions: ExtensionConfig[] = [],
  // Sprint 20 (ADR-067): per-area overrides from profile.json; M0 wires
  // description_override through to the generic builder.
  areaOverrides: OscarAreaOverrides | null = null,
): Promise<Recipe> {
  return buildPracticeAreaRecipe({
    area: {
      id: 'commercial',
      name: 'Commercial',
      body: 'Commercial practice area. Redline tooling for legal documents (.docx) via the adeu MCP.',
      source: 'default',
      bundled_skill_sources: ['commercial-legal'],
    },
    workingDir,
    stateFolder,
    resourcesRoot,
    homeDir,
    systemPrompt: SYSTEM_PROMPT,
    companyContext,
    enabledPlatformExtensions,
    areaOverrides,
    extraExtensions: [
      ((): NonNullable<Recipe['extensions']>[number] => {
        const redline = resolveRedlineCmd(resourcesRoot);
        return {
          type: 'stdio',
          name: 'redline',
          description:
            'Redline tool for legal documents (.docx). Backed by adeu==1.6.9.',
          cmd: redline.cmd,
          args: redline.args,
          timeout: 300,
          available_tools: ['read_docx', 'process_document_batch', 'diff_docx_files'],
        };
      })(),
      ...installedConfigs,
    ],
  });
}
