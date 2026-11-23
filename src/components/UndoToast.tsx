import { memo, useCallback } from 'react';
import { useUndoToast } from '../hooks/useUndoToast';
import { useStore } from '../store/AppContext';

function UndoToastImpl() {
  const store = useStore();
  const visible = useUndoToast();
  const undo = useCallback(() => store.getState().undoRemove(), [store]);

  return (
    <div className="toast-region" role="status" aria-label="Notifications" aria-live="polite">
      {visible && (
        <div className="toast">
          <span>Note deleted</span>
          <button type="button" className="toast__action" onClick={undo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export const UndoToast = memo(UndoToastImpl);
