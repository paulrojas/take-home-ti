import { useEffect, useMemo, useState } from 'react';

export const UNDO_TOAST_MS = 6000;
/** Newest toasts shown at once; older deletions stay undoable with Ctrl/Cmd+Z. */
export const MAX_VISIBLE_TOASTS = 4;

interface ToastCountdown {
  readonly expired: boolean;
  /** Spread on the toast: the countdown pauses while the pointer or keyboard focus is on it. */
  readonly hold: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
  };
}

/**
 * Lifetime of one toast. The state lives with the toast, so removing it (for example by clicking Undo while
 * the pointer is on it, which fires no mouseleave) discards a held state with it.
 */
export function useToastCountdown(durationMs: number = UNDO_TOAST_MS): ToastCountdown {
  const [held, setHeld] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (held || expired) return;
    const timer = setTimeout(() => setExpired(true), durationMs);
    return () => clearTimeout(timer);
  }, [held, expired, durationMs]);

  const hold = useMemo(() => {
    const grab = (): void => setHeld(true);
    const release = (): void => setHeld(false);
    return { onMouseEnter: grab, onMouseLeave: release, onFocus: grab, onBlur: release };
  }, []);

  return { expired, hold };
}
