// Sprint 20-M8 (ADR-090): main-process watcher for Forge Mode E marker
// files. Mirrors the M7 profileWriteWatcher mechanism (fs.watch on the
// parent dir + 100ms debounce + Zod validate); the difference is the
// payload (one marker per delete request, not a continuously-rewritten
// document) and the output (emit an IPC event to all BrowserWindows
// rather than write a .bak rollback).
//
// Forge writes ~/.config/oscar/_forge_request_delete_<areaId>.json via
// oscar-fs__write_file (oscar-fs already has the allowed-dir per
// ADR-039). The watcher sees the file, validates, drops if older than
// 5s (stale-marker mitigation across app restarts), and webContents-
// sends `oscar:forge:delete-prepare` to all open BrowserWindows. The
// renderer hook in useDeleteAreaConfirm subscribes; the modal renders.
// Confirm / Cancel IPCs from the modal own marker deletion — the
// watcher is read-only.
//
// Could share the fs.watch instance with profileWriteWatcher (same
// parent dir). Kept parallel for now; if a third watcher appears post-
// M8, factor into a shared `oscarConfigDirWatcher` dispatcher.

import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import log from '../../../utils/logger';
import {
  ForgeDeleteRequestSchema,
  type ForgeDeleteRequest,
} from './forgeDeleteRequestSchema';

const DEBOUNCE_MS = 100;
const STALE_WINDOW_MS = 5000;
const MARKER_FILENAME_RE = /^_forge_request_delete_([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;

interface WatcherHandle {
  stop(): void;
}

interface StartWatcherOpts {
  configDir: string;
  onMarker: (marker: ForgeDeleteRequest & { markerPath: string }) => void;
}

async function readIfPresent(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

function tryParse(
  raw: string,
): { ok: true; value: ForgeDeleteRequest } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `JSON parse failed: ${(err as Error).message}` };
  }
  const result = ForgeDeleteRequestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      reason: result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }
  return { ok: true, value: result.data };
}

export function startForgeDeleteWatcher({
  configDir,
  onMarker,
}: StartWatcherOpts): WatcherHandle {
  let watcher: FSWatcher | null = null;
  let stopped = false;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const handleMarker = async (filename: string): Promise<void> => {
    if (stopped) return;
    const match = MARKER_FILENAME_RE.exec(filename);
    if (!match) return;
    const filenameAreaId = match[1];
    const markerPath = path.join(configDir, filename);
    const raw = await readIfPresent(markerPath);
    if (raw === null) return;
    const verdict = tryParse(raw);
    if (!verdict.ok) {
      log.error('forgeDeleteWatcher rejecting invalid marker', {
        markerPath,
        reason: verdict.reason,
      });
      return;
    }
    const marker = verdict.value;
    if (marker.areaId !== filenameAreaId) {
      log.error('forgeDeleteWatcher areaId mismatch between filename and body', {
        markerPath,
        filenameAreaId,
        bodyAreaId: marker.areaId,
      });
      return;
    }
    const ageMs = Date.now() - new Date(marker.timestamp).getTime();
    if (Number.isNaN(ageMs) || ageMs > STALE_WINDOW_MS) {
      log.warn('forgeDeleteWatcher ignoring stale marker', {
        markerPath,
        ageMs,
      });
      return;
    }
    onMarker({ ...marker, markerPath });
  };

  const schedule = (filename: string): void => {
    const existing = pending.get(filename);
    if (existing) clearTimeout(existing);
    pending.set(
      filename,
      setTimeout(() => {
        pending.delete(filename);
        void handleMarker(filename);
      }, DEBOUNCE_MS),
    );
  };

  try {
    void fs.mkdir(configDir, { recursive: true });
    watcher = watch(configDir, { persistent: false }, (_eventType, filename) => {
      if (!filename || !MARKER_FILENAME_RE.test(filename)) return;
      schedule(filename);
    });
    watcher.on('error', (err) => {
      log.error('forgeDeleteWatcher fs.watch error', {
        configDir,
        error: err.message,
      });
    });
  } catch (err) {
    log.error('forgeDeleteWatcher could not start fs.watch', {
      configDir,
      error: (err as Error).message,
    });
  }

  return {
    stop(): void {
      stopped = true;
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      if (watcher) {
        try {
          watcher.close();
        } catch {
          /* already closed */
        }
      }
    },
  };
}
