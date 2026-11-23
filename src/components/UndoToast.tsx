import { memo, useCallback, useState } from 'react';
import { useToastCountdown } from '../hooks/useToastCountdown';
import { useStore } from '../store/AppContext';
import type { RemovedNote } from '../store/notesStore';
import { useNotes } from '../store/useNotes';
import type { NoteId } from '../types';

/** Newest toasts shown at once; older deletions stay undoable with Ctrl/Cmd+Z. */
export const MAX_VISIBLE_TOASTS = 4;
const PREVIEW_LENGTH = 60;

interface UndoToastItemProps {
  readonly entry: RemovedNote;
  /** Only the newest deletion is what Ctrl/Cmd+Z restores. */
  readonly isNewest: boolean;
  readonly onUndo: (id: NoteId) => void;
  readonly onExpire: (seq: number) => void;
}

/** One deletion and its own Undo; it goes away by itself after a few seconds unless it is being used. */
function UndoToastItemImpl({ entry, isNewest, onUndo, onExpire }: UndoToastItemProps) {
  const expire = useCallback(() => onExpire(entry.seq), [onExpire, entry.seq]);
  const hold = useToastCountdown(expire);

  // By code point, so an emoji is never cut in half.
  const preview = Array.from(entry.note.text.trim()).slice(0, PREVIEW_LENGTH).join('');
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
        aria-keyshortcuts={isNewest ? 'Control+Z Meta+Z' : undefined}
        onClick={() => onUndo(entry.note.id)}
      >
        Undo
      </button>
    </div>
  );
}

const UndoToastItem = memo(UndoToastItemImpl);

/**
 * Stack of undo toasts, newest first. A toast that expired, or that newer ones pushed out of the window, stays
 * hidden for good: undoing a newer deletion never brings an old toast back.
 */
function UndoToastImpl() {
  const store = useStore();
  const removed = useNotes((state) => state.removed);
  const [expired, setExpired] = useState<ReadonlySet<number>>(new Set());
  // Deletions up to this number were pushed out of the window and no longer get a toast.
  const [pushedOut, setPushedOut] = useState(0);

  const undo = useCallback((id: NoteId) => store.getState().undoRemove(id), [store]);
  const expire = useCallback((seq: number) => setExpired((current) => new Set(current).add(seq)), []);

  const newest = removed[removed.length - 1];
  const candidates = removed.filter((entry) => entry.seq > pushedOut && !expired.has(entry.seq));
  const overflow = candidates[candidates.length - MAX_VISIBLE_TOASTS - 1];
  // Adjusted while rendering, so the cut-off is in place before anything is painted.
  if (overflow) setPushedOut(overflow.seq);
  const shown = candidates.slice(-MAX_VISIBLE_TOASTS).reverse();

  return (
    <div className="toast-region" role="status" aria-label="Notifications" aria-live="polite">
      {shown.map((entry) => (
        <UndoToastItem key={entry.seq} entry={entry} isNewest={entry === newest} onUndo={undo} onExpire={expire} />
      ))}
    </div>
  );
}

export const UndoToast = memo(UndoToastImpl);
