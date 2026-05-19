import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';
import { buildPracticeAreaRecipe } from '../recipe/buildPracticeAreaRecipe';

const DEV_REDLINE_VENV_BIN = '/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server';

function resolveRedlineBin(resourcesRoot: string | null): string {
  if (resourcesRoot) {
    return `${resourcesRoot}/python/adeu-venv/bin/adeu-server`;
  }
  return DEV_REDLINE_VENV_BIN;
}

// Sprint 12 (ADR-041): composes the generic practice-area builder. oscar-fs
// scoped to the matter folder; redline MCP added for adeu redlines; bespoke
// SYSTEM_PROMPT replaces the generic default.
export function buildCommercialRecipe(
  matterFolder: string,
  resourcesRoot: string | null,
): Recipe {
  return buildPracticeAreaRecipe({
    area: {
      id: 'commercial',
      name: 'Commercial',
      body: 'Commercial practice area. Redline tooling for legal documents (.docx) via the adeu MCP.',
      source: 'default',
      bundled_skill_sources: ['commercial-legal'],
    },
    matterFolder,
    resourcesRoot,
    systemPrompt: SYSTEM_PROMPT,
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
    ],
  });
}
