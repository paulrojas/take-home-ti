import { useEffect, useRef, useState } from 'react';
import { useNotes } from '../store/useNotes';

export const UNDO_TOAST_MS = 6000;

/** True for a few seconds after a deletion, and false again once it is undone or the time is up. */
export function useUndoToast(): boolean {
  const removals = useNotes((state) => state.removals);
  const hasRemoved = useNotes((state) => state.removed.length > 0);
  const [visible, setVisible] = useState(false);
  const seenRemovals = useRef(removals);

  useEffect(() => {
    if (removals === seenRemovals.current) {
      // The last change was an undo (or a reload of the notes), not a deletion.
      setVisible(false);
      return;
    }
    seenRemovals.current = removals;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [removals, hasRemoved]);

  return visible && hasRemoved;
}
