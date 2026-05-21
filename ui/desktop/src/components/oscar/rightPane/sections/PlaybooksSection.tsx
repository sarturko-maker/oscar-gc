// Sprint 20-M4 (ADR-084, ADR-085): Playbooks section body. Drop zone with
// click-to-browse fallback; file rows with always-on chip + delete X. Two
// scope tiers (_global + per-area) listed in that order, alphabetical
// within each. Polls oscar:playbooks:list every 2 s via usePanelReader —
// same shape M3's MatterFactsSection uses.

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useRightPaneCoords } from '../RightPaneContext';
import { usePanelReader } from './usePanelReader';
import { SECTION_META, type PanelSectionProps } from './registry';
import type { PlaybookEntry } from '../../../../preload';

const ALLOWED_EXT = [
  '.pdf', '.docx', '.md', '.txt', '.html', '.json', '.yaml', '.yml', '.csv',
] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i).toLowerCase();
}

function isAllowed(filename: string): boolean {
  return (ALLOWED_EXT as readonly string[]).includes(extOf(filename));
}

interface BudgetWarning {
  relPath: string;
  extractedLength: number;
  cap: number;
}

export default function PlaybooksSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { areaId } = useRightPaneCoords();
  const { data, error } = usePanelReader<PlaybookEntry[]>(
    async () => {
      if (!areaId) return [];
      return window.electron.playbooks.list(areaId);
    },
    [areaId],
  );

  const items = data ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<BudgetWarning | null>(null);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    if (!areaId) return;
    // The polled reader will catch up on the next tick; this call gives an
    // immediate refresh after a mutation. Best-effort — failures are
    // surfaced through the next poll cycle.
    try {
      await window.electron.playbooks.list(areaId);
    } catch {
      // ignore
    }
  }, [areaId]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!isAllowed(file.name)) {
        setUploadError(
          `${file.name}: unsupported file type. Allowed: ${ALLOWED_EXT.join(', ')}.`,
        );
        return;
      }
      setUploadError(null);
      setPendingUpload(file);
    },
    [],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleFiles(e.dataTransfer?.files ?? null);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const confirmUpload = useCallback(
    async (scope: 'global' | 'area') => {
      if (!pendingUpload || !areaId) return;
      setBusy(pendingUpload.name);
      setUploadError(null);
      try {
        const buf = new Uint8Array(await pendingUpload.arrayBuffer());
        const res = await window.electron.playbooks.upload(
          areaId,
          scope,
          pendingUpload.name,
          buf,
        );
        if (!res.ok) {
          setUploadError(
            res.code === 'EEXIST'
              ? `${pendingUpload.name} already exists; delete first to replace.`
              : `${pendingUpload.name}: ${res.message}`,
          );
        } else {
          await refreshList();
        }
      } finally {
        setBusy(null);
        setPendingUpload(null);
      }
    },
    [pendingUpload, areaId, refreshList],
  );

  const cancelUpload = useCallback(() => {
    setPendingUpload(null);
  }, []);

  const onToggleAlwaysOn = useCallback(
    async (item: PlaybookEntry) => {
      if (!areaId) return;
      setBusy(item.relPath);
      setBudgetWarning(null);
      try {
        const res = await window.electron.playbooks.toggleAlwaysOn(
          areaId,
          item.relPath,
          !item.alwaysOn,
        );
        if (!res.ok) {
          if (res.code === 'EBUDGET') {
            setBudgetWarning({
              relPath: item.relPath,
              extractedLength: res.extractedLength ?? 0,
              cap: res.cap ?? 8000,
            });
          } else {
            setUploadError(`${item.filename}: ${res.message}`);
          }
        } else {
          await refreshList();
        }
      } finally {
        setBusy(null);
      }
    },
    [areaId, refreshList],
  );

  const onDelete = useCallback(
    async (item: PlaybookEntry) => {
      if (!areaId) return;
      setBusy(item.relPath);
      try {
        await window.electron.playbooks.delete(areaId, item.relPath);
        await refreshList();
      } finally {
        setBusy(null);
      }
    },
    [areaId, refreshList],
  );

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      <div className="oscar__panel-section-body">
        <div
          className="oscar__playbooks-drop"
          data-testid="playbooks-dropzone"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop a playbook or click to browse"
        >
          Drop a PDF, .docx, .md, .txt, .html, .json, .yaml, or .csv — or click to browse.
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXT.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
            data-testid="playbooks-file-input"
          />
        </div>
        {pendingUpload && (
          <div className="oscar__playbooks-upload-confirm" data-testid="playbooks-upload-confirm">
            <p className="oscar__playbooks-upload-name">{pendingUpload.name}</p>
            <p className="oscar__panel-section-stub-body">Save as:</p>
            <button
              type="button"
              data-testid="playbooks-upload-scope-area"
              onClick={() => void confirmUpload('area')}
              disabled={busy !== null}
            >
              {areaId ? `${areaId} only` : 'Area only'}
            </button>
            <button
              type="button"
              data-testid="playbooks-upload-scope-global"
              onClick={() => void confirmUpload('global')}
              disabled={busy !== null}
            >
              Global (all areas)
            </button>
            <button
              type="button"
              data-testid="playbooks-upload-cancel"
              onClick={cancelUpload}
              disabled={busy !== null}
            >
              Cancel
            </button>
          </div>
        )}
        {uploadError && (
          <p className="oscar__playbooks-error" data-testid="playbooks-error">
            {uploadError}
          </p>
        )}
        {budgetWarning && (
          <p className="oscar__playbooks-budget-warning" data-testid="playbooks-budget-warning">
            Exceeds the {Math.round(budgetWarning.cap / 1000)}K always-on budget — kept on-demand
            instead. ({budgetWarning.extractedLength.toLocaleString()} chars extracted.)
          </p>
        )}
        {items.length === 0 ? (
          <p className="oscar__panel-section-stub-body" data-testid="playbooks-empty">
            No playbooks yet. Drop a file above.
          </p>
        ) : (
          <ul className="oscar__playbooks-list" data-testid="playbooks-list">
            {items.map((item) => (
              <PlaybookRow
                key={item.relPath}
                item={item}
                busy={busy === item.relPath}
                onToggleAlwaysOn={() => void onToggleAlwaysOn(item)}
                onDelete={() => void onDelete(item)}
              />
            ))}
          </ul>
        )}
        {error && (
          <p className="oscar__panel-section-stub-body">List failed: {error.message}</p>
        )}
      </div>
    </section>
  );
}

interface RowProps {
  item: PlaybookEntry;
  busy: boolean;
  onToggleAlwaysOn: () => void;
  onDelete: () => void;
}

function PlaybookRow({ item, busy, onToggleAlwaysOn, onDelete }: RowProps) {
  return (
    <li
      className="oscar__playbooks-row"
      data-testid={`playbooks-row-${item.relPath}`}
      data-scope={item.scope}
    >
      <span className="oscar__playbooks-name">{item.filename}</span>
      <span className="oscar__playbooks-meta">
        <span className="oscar__playbooks-scope" data-testid="playbooks-scope">
          {item.scope === 'global' ? 'Global' : item.relPath.split('/')[0]}
        </span>
        <span className="oscar__playbooks-size">{formatBytes(item.sizeBytes)}</span>
      </span>
      <button
        type="button"
        className="oscar__playbooks-chip"
        data-testid="playbooks-always-on-toggle"
        aria-pressed={item.alwaysOn}
        disabled={busy}
        onClick={onToggleAlwaysOn}
      >
        Always-on
      </button>
      <button
        type="button"
        className="oscar__playbooks-delete"
        data-testid="playbooks-delete"
        aria-label={`Delete ${item.filename}`}
        disabled={busy}
        onClick={onDelete}
      >
        ×
      </button>
    </li>
  );
}
