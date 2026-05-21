// Sprint 20-M7 (ADR-089): defence-in-depth validator for profile.json
// writes. Forge writes area_overrides via oscar-fs__write_file (same tool
// as Mode B/C per the M7 brief's "same write tool" rule); oscar-fs runs as
// a goosed subprocess, so main.ts is NOT in the pre-write path. Mechanism
// is post-write: fs.watch + debounce + Zod parse + .bak revert.
//
// On every write event:
//   - Read profile.json; JSON-parse; Zod-parse against the schema in
//     areaOverrideSchema.ts (only checks area_overrides shape; other
//     fields pass through untouched).
//   - If valid: atomic-write a refreshed .bak (the rollback target).
//   - If invalid: atomic-copy .bak over profile.json (revert).
//
// Forge's Mode D procedure step 7 reads profile.json back after each
// write; a reverted write surfaces conversationally — no separate IPC
// channel needed. The race window between Forge's bad write and the
// watcher's revert is microseconds; profile.json is user config, not
// security-critical state.
//
// Self-induced loop avoidance: track the SHA-256 hash of the last valid
// content. Events whose post-read content hashes match the last valid
// state (i.e., our own .bak write OR our own revert) skip the validate
// step.

import { createHash } from 'node:crypto';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import log from '../../../utils/logger';
import { ProfileForWriteValidationSchema } from './areaOverrideSchema';

const DEBOUNCE_MS = 100;

interface WatcherHandle {
  stop(): void;
}

interface StartWatcherOpts {
  profilePath: string;
  backupPath: string;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function readIfPresent(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function atomicWrite(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, content, { mode: 0o600 });
  await fs.rename(tmp, target);
}

function tryValidate(rawContent: string): { ok: true } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return { ok: false, reason: `JSON parse failed: ${(err as Error).message}` };
  }
  const result = ProfileForWriteValidationSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true };
}

export function startProfileWriteWatcher({
  profilePath,
  backupPath,
}: StartWatcherOpts): WatcherHandle {
  let lastValidHash: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;
  let stopped = false;

  const handleChange = async (): Promise<void> => {
    if (stopped) return;
    const content = await readIfPresent(profilePath);
    if (content === null) return;
    const hash = sha256(content);
    if (hash === lastValidHash) return;

    const verdict = tryValidate(content);
    if (verdict.ok) {
      try {
        await atomicWrite(backupPath, content);
        lastValidHash = hash;
      } catch (err) {
        log.error('profileWriteWatcher backup-write failed', {
          backupPath,
          error: (err as Error).message,
        });
      }
      return;
    }

    log.error('profileWriteWatcher rejecting invalid profile.json write', {
      profilePath,
      reason: verdict.reason,
    });
    const lastValid = await readIfPresent(backupPath);
    if (lastValid === null) {
      log.error('profileWriteWatcher cannot revert — no backup present', {
        backupPath,
      });
      return;
    }
    try {
      await atomicWrite(profilePath, lastValid);
      lastValidHash = sha256(lastValid);
    } catch (err) {
      log.error('profileWriteWatcher revert failed', {
        profilePath,
        error: (err as Error).message,
      });
    }
  };

  const scheduleHandleChange = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void handleChange();
    }, DEBOUNCE_MS);
  };

  const bootstrap = async (): Promise<void> => {
    const initial = await readIfPresent(profilePath);
    if (initial === null) return;
    const verdict = tryValidate(initial);
    if (!verdict.ok) {
      log.error('profileWriteWatcher startup: profile.json present but invalid; will not seed backup', {
        profilePath,
        reason: verdict.reason,
      });
      return;
    }
    const existingBackup = await readIfPresent(backupPath);
    if (existingBackup === null) {
      try {
        await atomicWrite(backupPath, initial);
      } catch (err) {
        log.error('profileWriteWatcher startup backup-seed failed', {
          backupPath,
          error: (err as Error).message,
        });
        return;
      }
    }
    lastValidHash = sha256(initial);
  };

  void bootstrap();

  // Watch the parent directory rather than the file itself so the watcher
  // survives the pre-onboarding case (profile.json doesn't exist yet).
  // fs.watch on a missing file throws ENOENT; fs.watch on the directory
  // fires for any create/rename/change in it. Filter by filename to skip
  // .bak / .tmp churn from our own atomic writes.
  const profileDir = path.dirname(profilePath);
  const profileBasename = path.basename(profilePath);
  try {
    void fs.mkdir(profileDir, { recursive: true });
    watcher = watch(profileDir, { persistent: false }, (_eventType, filename) => {
      if (filename !== profileBasename) return;
      scheduleHandleChange();
    });
    watcher.on('error', (err) => {
      log.error('profileWriteWatcher fs.watch error', {
        profileDir,
        error: err.message,
      });
    });
  } catch (err) {
    log.error('profileWriteWatcher could not start fs.watch', {
      profileDir,
      error: (err as Error).message,
    });
  }

  return {
    stop(): void {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
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
