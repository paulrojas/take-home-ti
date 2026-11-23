import { memo, useCallback } from 'react';
import { MAX_VISIBLE_TOASTS, useToastCountdown } from '../hooks/useToastCountdown';
import { useStore } from '../store/AppContext';
import type { RemovedNote } from '../store/notesStore';
import { useNotes } from '../store/useNotes';
import type { NoteId } from '../types';

const PREVIEW_LENGTH = 60;

interface UndoToastItemProps {
  readonly entry: RemovedNote;
  readonly onUndo: (id: NoteId) => void;
}

/** One deletion and its own Undo; it disappears by itself after a few seconds unless it is being used. */
function UndoToastItemImpl({ entry, onUndo }: UndoToastItemProps) {
  const { expired, hold } = useToastCountdown();
  if (expired) return null;

  const preview = entry.note.text.trim().slice(0, PREVIEW_LENGTH);
  return (
    <div className="toast" {...hold}>
      <span className="toast__message">
        Note deleted
        {preview && <span className="toast__preview">{preview}</span>}
      </span>
      <button
        type="button"
        className="toast__action"
        aria-label={preview ? `Undo delete: ${preview}` : 'Undo'}
        aria-keyshortcuts="Control+Z Meta+Z"
        onClick={() => onUndo(entry.note.id)}
      >
        Undo
      </button>
    </div>
  );
}

const UndoToastItem = memo(UndoToastItemImpl);

/** Stack of undo toasts, newest first: the top one is what Ctrl/Cmd+Z restores. */
function UndoToastImpl() {
  const store = useStore();
  const removed = useNotes((state) => state.removed);
  const undo = useCallback((id: NoteId) => store.getState().undoRemove(id), [store]);
  const shown = removed.slice(-MAX_VISIBLE_TOASTS).reverse();

  return (
    <div className="toast-region" role="status" aria-label="Notifications" aria-live="polite">
      {shown.map((entry) => (
        <UndoToastItem key={entry.seq} entry={entry} onUndo={undo} />
      ))}
    </div>
  );
}

export const UndoToast = memo(UndoToastImpl);
