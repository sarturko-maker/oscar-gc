import type { Recipe } from '../../../api';
import { SYSTEM_PROMPT } from './systemPrompt';

const DEV_REDLINE_VENV_BIN = '/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server';

function resolveRedlineBin(resourcesRoot: string | null): string {
  if (resourcesRoot) {
    return `${resourcesRoot}/python/adeu-venv/bin/adeu-server`;
  }
  return DEV_REDLINE_VENV_BIN;
}

export function buildCommercialRecipe(resourcesRoot: string | null): Recipe {
  return {
    version: '1.0.0',
    title: 'Oscar GC — Commercial',
    description:
      'Commercial practice area. Redline tooling for legal documents (.docx) via the adeu MCP, scoped to read_docx, process_document_batch, and diff_docx_files.',
    instructions: SYSTEM_PROMPT,
    extensions: [
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
    settings: {
      goose_provider: 'minimax',
      goose_model: 'MiniMax-M2.5',
    },
  };
}
