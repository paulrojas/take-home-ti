import { memo, useCallback, useSyncExternalStore } from 'react';
import { useStore, useSync } from '../store/AppContext';
import type { SyncStatus } from '../services/syncController';
import { cascadeRect } from '../utils/geometry';

const STATUS_LABELS: Record<SyncStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Could not save',
};

function SyncIndicator() {
  const sync = useSync();
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus);

  return (
    <div className={`sync sync--${status}`} role="status" aria-live="polite">
      <span>{STATUS_LABELS[status]}</span>
      {status === 'error' && (
        <button type="button" className="link-button" onClick={sync.retry}>
          Retry
        </button>
      )}
    </div>
  );
}

function ToolbarImpl() {
  const store = useStore();

  const addNote = useCallback(() => {
    store.create(cascadeRect(store.getIds().length));
  }, [store]);

  return (
    <header className="toolbar">
      <h1 className="toolbar__title">Sticky Notes</h1>
      <button type="button" className="button" onClick={addNote}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
        New note
      </button>
      <p className="toolbar__hint">Or drag on the board to draw a note of any size.</p>
      <SyncIndicator />
    </header>
  );
}

export const Toolbar = memo(ToolbarImpl);
