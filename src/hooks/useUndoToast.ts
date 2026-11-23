import { useEffect, useMemo, useState } from 'react';
import { useNotes } from '../store/useNotes';

export const UNDO_TOAST_MS = 6000;

interface UndoToast {
  readonly visible: boolean;
  /** Spread on the toast: the countdown pauses while the pointer or keyboard focus is on it. */
  readonly hold: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
  };
}

/**
 * The toast shows while something can be undone and its countdown has not run out. Every change to the
 * history (a new deletion, a partial undo) starts a new countdown; emptying it hides the toast at once.
 */
export function useUndoToast(): UndoToast {
  const removals = useNotes((state) => state.removals);
  const pending = useNotes((state) => state.removed.length);
  const [heldKey, setHeldKey] = useState('');
  const [expiredKey, setExpiredKey] = useState('');

  const key = `${removals}:${pending}`;
  const visible = pending > 0 && expiredKey !== key;
  // A hold belongs to one state of the history. The toast can unmount while it is held (Undo clicked), which
  // fires no mouseleave, so a hold from an earlier state must not carry over to the next toast.
  const held = heldKey === key;

  useEffect(() => {
    if (!visible || held) return;
    const timer = setTimeout(() => setExpiredKey(key), UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [visible, held, key]);

  const hold = useMemo(() => {
    const grab = (): void => setHeldKey(key);
    const release = (): void => setHeldKey('');
    return { onMouseEnter: grab, onMouseLeave: release, onFocus: grab, onBlur: release };
  }, [key]);

  return { visible, hold };
}
