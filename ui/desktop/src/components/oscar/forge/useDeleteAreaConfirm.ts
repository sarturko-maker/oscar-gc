// Sprint 20-M8 (ADR-090): renderer hook that lifts state for the Forge
// Mode E delete-area confirm modal. Subscribes to the
// `oscar:forge:delete-prepare` channel emitted by the main-process
// marker-file watcher. The modal component reads from this hook; one
// instance per renderer (mount in AppLayout once).

import { useEffect, useState } from 'react';
import type { ForgeDeletePreparePayload } from '../../../preload';

export interface DeleteAreaState extends ForgeDeletePreparePayload {}

export function useDeleteAreaConfirm(): {
  pending: DeleteAreaState | null;
  clear: () => void;
} {
  const [pending, setPending] = useState<DeleteAreaState | null>(null);

  useEffect(() => {
    const onPrepare = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ): void => {
      const payload = args[0] as DeleteAreaState | undefined;
      if (!payload || typeof payload !== 'object' || !payload.areaId) return;
      setPending(payload);
    };

    window.electron.on('oscar:forge:delete-prepare', onPrepare);
    return () => {
      window.electron.off('oscar:forge:delete-prepare', onPrepare);
    };
  }, []);

  return {
    pending,
    clear: () => setPending(null),
  };
}
