import type { ExtensionConfig, Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';
import { buildPracticeAreaRecipe } from '../recipe/buildPracticeAreaRecipe';
import type { OscarCompanyContext } from '../hooks/useOscarProfile';

const DEV_REDLINE_VENV_BIN = '/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server';

function resolveRedlineBin(resourcesRoot: string | null): string {
  if (resourcesRoot) {
    return `${resourcesRoot}/python/adeu-venv/bin/adeu-server`;
  }
  return DEV_REDLINE_VENV_BIN;
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
export function buildCommercialRecipe(
  workingDir: string,
  stateFolder: string,
  resourcesRoot: string | null,
  companyContext: OscarCompanyContext | null,
  installedConfigs: NonNullable<Recipe['extensions']> = [],
  // Sprint 18 (ADR-065): user-enabled platform extensions threaded from
  // MattersLanding.openMatter (ConfigContext.extensionsList snapshot).
  enabledPlatformExtensions: ExtensionConfig[] = [],
): Recipe {
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
    systemPrompt: SYSTEM_PROMPT,
    companyContext,
    enabledPlatformExtensions,
    extraExtensions: [
      {
        type: 'stdio',
        name: 'redline',
        description: 'Redline tool for legal documents (.docx). Backed by adeu==1.6.9.',
        cmd: resolveRedlineBin(resourcesRoot),
        args: [],
        timeout: 300,
        available_tools: ['read_docx', 'process_document_batch', 'diff_docx_files'],
      },
      ...installedConfigs,
    ],
  });
}
