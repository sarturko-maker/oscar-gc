// Sprint 20-M4 (ADR-084, ADR-085): main-process playbook store. Lists files,
// extracts text. Binary formats (.pdf, .docx) go through Goose's bundled
// computercontroller MCP via `goosed mcp computercontroller` — reused per
// CLAUDE.md "Reuse over rebuild" rather than adding pdf-parse + mammoth deps.
// Text formats (.md, .txt, .html, .json, .yaml, .csv) are raw fs.readFile;
// html stripped of tags via a one-line regex.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const PLAYBOOKS_ROOT = path.join(os.homedir(), '.config', 'oscar', 'playbooks');
export const GLOBAL_SCOPE_DIR = '_global';

export const TEXT_EXTS = ['.md', '.txt', '.html', '.json', '.yaml', '.yml', '.csv'] as const;
export const BINARY_EXTS = ['.pdf', '.docx'] as const;
export const ALL_ALLOWED_EXTS = [...TEXT_EXTS, ...BINARY_EXTS] as const;

export type PlaybookScope = 'global' | 'area';

export interface PlaybookEntry {
  /** Scoped relative path from PLAYBOOKS_ROOT, e.g. "_global/foo.md". */
  relPath: string;
  filename: string;
  scope: PlaybookScope;
  sizeBytes: number;
  mtimeMs: number;
  alwaysOn: boolean;
}

const extOf = (filename: string): string => path.extname(filename).toLowerCase();

export const isAllowedExt = (filename: string): boolean =>
  (ALL_ALLOWED_EXTS as readonly string[]).includes(extOf(filename));

export const isBinaryExt = (filename: string): boolean =>
  (BINARY_EXTS as readonly string[]).includes(extOf(filename));

// ADR-084: scope = _global (cross-area) or <areaId> (per-area). Underscore
// prefix on _global keeps it from colliding with any future area-id named
// "global".
const dirForScope = (scope: PlaybookScope, areaId: string): string =>
  path.join(PLAYBOOKS_ROOT, scope === 'global' ? GLOBAL_SCOPE_DIR : areaId);

export async function ensurePlaybookDirs(areaId: string): Promise<void> {
  await fs.mkdir(dirForScope('global', areaId), { recursive: true });
  await fs.mkdir(dirForScope('area', areaId), { recursive: true });
}

async function listScope(
  scope: PlaybookScope,
  areaId: string,
  alwaysOnSet: Set<string>,
): Promise<PlaybookEntry[]> {
  const dir = dirForScope(scope, areaId);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries: PlaybookEntry[] = [];
  for (const name of names) {
    if (!isAllowedExt(name)) continue;
    const abs = path.join(dir, name);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const relPath = path.posix.join(
      scope === 'global' ? GLOBAL_SCOPE_DIR : areaId,
      name,
    );
    entries.push({
      relPath,
      filename: name,
      scope,
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      alwaysOn: alwaysOnSet.has(relPath),
    });
  }
  entries.sort((a, b) => a.filename.localeCompare(b.filename));
  return entries;
}

export async function listPlaybooks(
  areaId: string,
  alwaysOn: readonly string[],
): Promise<PlaybookEntry[]> {
  await ensurePlaybookDirs(areaId);
  const set = new Set(alwaysOn);
  const global = await listScope('global', areaId, set);
  const area = await listScope('area', areaId, set);
  return [...global, ...area];
}

// ADR-085 Layer 1 extraction. Text formats read raw; binary formats go
// through computercontroller. Used both by recipe-build (always-on
// injection) and by toggle-time budget checks.
export async function extractText(
  absPath: string,
  cc: ComputerControllerClient | null = null,
): Promise<string> {
  const ext = extOf(absPath);
  if ((TEXT_EXTS as readonly string[]).includes(ext)) {
    const raw = await fs.readFile(absPath, 'utf8');
    if (ext === '.html') return stripHtmlTags(raw);
    return raw;
  }
  if (ext === '.pdf' || ext === '.docx') {
    if (!cc) throw new Error(`extractText: binary format ${ext} needs ComputerControllerClient`);
    return ext === '.pdf' ? cc.extractPdf(absPath) : cc.extractDocx(absPath);
  }
  throw new Error(`extractText: unsupported extension ${ext}`);
}

const stripHtmlTags = (s: string): string =>
  s.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Wraps `goosed mcp computercontroller` as a stdio MCP child process.
// One client per recipe build (or per IPC burst); call extract* multiple
// times; then close(). Boot cost ~200-400 ms is paid once.
export class ComputerControllerClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private readonly goosedBin: string) {}

  private async ensureStarted(): Promise<Client> {
    if (this.client) return this.client;
    this.transport = new StdioClientTransport({
      command: this.goosedBin,
      args: ['mcp', 'computercontroller'],
      stderr: 'pipe',
    });
    this.client = new Client(
      { name: 'oscar-playbooks', version: '1.0.0' },
      { capabilities: {} },
    );
    await this.client.connect(this.transport);
    return this.client;
  }

  async extractPdf(absPath: string): Promise<string> {
    return this.extract('pdf_tool', absPath);
  }

  async extractDocx(absPath: string): Promise<string> {
    return this.extract('docx_tool', absPath);
  }

  private async extract(toolName: 'pdf_tool' | 'docx_tool', absPath: string): Promise<string> {
    const client = await this.ensureStarted();
    const result = await client.callTool({
      name: toolName,
      arguments: { path: absPath, operation: 'extract_text' },
    });
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    const text = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    return text;
  }

  async close(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      // ignore
    }
    this.client = null;
    this.transport = null;
  }
}

// Validate that a filename has no traversal components and an allowed ext.
// Returns the safe basename on success, throws on rejection.
export function sanitiseFilename(filename: string): string {
  const base = path.basename(filename);
  if (base !== filename || base.startsWith('.') || base.includes('\0')) {
    throw Object.assign(new Error('Invalid filename'), { code: 'EBADNAME' });
  }
  if (!isAllowedExt(base)) {
    throw Object.assign(new Error('Unsupported file extension'), { code: 'EBADEXT' });
  }
  return base;
}

// Renders the ## Playbooks in scope block (Layer 1 always-on injection).
// Called from the renderer via the oscar:playbooks:render-block IPC at
// recipe-build time. Per-file budget = floor(cap / max(1, count)). Stale
// entries (file deleted out-of-band) are silently skipped.
export async function renderPlaybooksBlock(
  relPaths: readonly string[],
  charCap: number,
  goosedBin: string,
): Promise<string | null> {
  if (relPaths.length === 0) return null;

  // Resolve absolute paths up front; drop stale entries silently.
  const resolved: Array<{ relPath: string; abs: string; isBinary: boolean }> = [];
  for (const rel of relPaths) {
    let abs: string;
    try {
      abs = absPathForRel(rel);
    } catch {
      continue;
    }
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    resolved.push({ relPath: rel, abs, isBinary: isBinaryExt(abs) });
  }
  if (resolved.length === 0) return null;

  // Spawn computercontroller lazily — only if at least one binary file is
  // present. Text-only always-on lists skip the subprocess entirely.
  const needsCc = resolved.some((r) => r.isBinary);
  const cc = needsCc ? new ComputerControllerClient(goosedBin) : null;

  const perFileBudget = Math.floor(charCap / Math.max(1, resolved.length));

  const sections: string[] = [];
  try {
    for (const r of resolved) {
      let extracted: string;
      try {
        extracted = await extractText(r.abs, cc);
      } catch {
        continue;
      }
      const truncated = truncateAtBoundary(extracted, perFileBudget);
      const scopeLabel = r.relPath.startsWith(`${GLOBAL_SCOPE_DIR}/`) ? 'global' : r.relPath.split('/')[0];
      sections.push(`### ${path.basename(r.relPath)} (${scopeLabel})\n${truncated}`);
    }
  } finally {
    await cc?.close();
  }

  if (sections.length === 0) return null;

  return [
    '## Playbooks in scope',
    '',
    'The following playbooks are always-on guidance for this area. Apply when',
    'relevant; cite by filename.',
    '',
    ...sections,
  ].join('\n');
}

const TRUNCATION_SENTINEL = '\n…[truncated; full file available on-demand via oscar-fs or computercontroller]…';

function truncateAtBoundary(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const head = text.slice(0, budget);
  // Prefer a paragraph break; fall back to a line break; fall back to hard cut.
  const lastPara = head.lastIndexOf('\n\n');
  const lastLine = head.lastIndexOf('\n');
  const cutAt = lastPara > budget * 0.5 ? lastPara : lastLine > budget * 0.5 ? lastLine : budget;
  return head.slice(0, cutAt).trimEnd() + TRUNCATION_SENTINEL;
}

// Sprint 29 M6 (ADR-099): on-demand playbook discovery block. Lists
// every non-always-on playbook for the area so the agent knows what to
// reach for via oscar-fs / computercontroller. Cheap: filename + size +
// scope for everything; first-line peek for text formats only.
export async function renderOnDemandPlaybooksBlock(
  areaId: string,
  alwaysOn: readonly string[],
): Promise<string | null> {
  const items = await listPlaybooks(areaId, alwaysOn);
  const onDemand = items.filter((it) => !it.alwaysOn);
  if (onDemand.length === 0) return null;

  const lines: string[] = [];
  for (const it of onDemand) {
    const scopeLabel = it.scope === 'global' ? 'global' : 'this area';
    const sizeKb =
      it.sizeBytes < 1024
        ? `${it.sizeBytes} B`
        : `${Math.round(it.sizeBytes / 1024)} KB`;
    let hint = '';
    if ((TEXT_EXTS as readonly string[]).includes(extOf(it.filename))) {
      hint = await peekFirstLine(path.join(PLAYBOOKS_ROOT, it.relPath));
    }
    const hintSuffix = hint ? ` — ${hint}` : '';
    lines.push(`- \`${it.relPath}\` (${scopeLabel}, ${sizeKb})${hintSuffix}`);
  }
  return [
    '## On-demand playbooks',
    '',
    'These playbooks live in `~/.config/oscar/playbooks/`. They are NOT auto-injected;',
    'load any that apply to the question via `oscar-fs__read_file` (text formats) or',
    "computercontroller's `pdf_tool` / `docx_tool` (binary formats). Filenames are the",
    'load-bearing signal — pick by purpose.',
    '',
    ...lines,
  ].join('\n');
}

const FIRST_LINE_MAX = 80;

async function peekFirstLine(absPath: string): Promise<string> {
  try {
    const raw = await fs.readFile(absPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim().replace(/^#+\s*/, '').replace(/<!--.*?-->/g, '').trim();
      if (t.length === 0) continue;
      return t.length > FIRST_LINE_MAX ? `${t.slice(0, FIRST_LINE_MAX - 1)}…` : t;
    }
  } catch {
    // ignore — fall through to no hint
  }
  return '';
}

export function absPathForRel(relPath: string): string {
  // relPath is "<scope>/<filename>" with POSIX separator. Reject anything
  // else as a path-traversal attempt.
  const parts = relPath.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw Object.assign(new Error('Invalid playbook path'), { code: 'EBADNAME' });
  }
  const [scopeDir, filename] = parts;
  sanitiseFilename(filename);
  if (scopeDir.includes('..') || filename.includes('..')) {
    throw Object.assign(new Error('Invalid playbook path'), { code: 'EBADNAME' });
  }
  return path.join(PLAYBOOKS_ROOT, scopeDir, filename);
}

