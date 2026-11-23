import { useEffect, useMemo, useState } from 'react';

export const UNDO_TOAST_MS = 6000;

interface ToastHold {
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

/**
 * Lifetime of one toast: `onExpire` runs once the countdown ends. It pauses while the pointer or keyboard
 * focus is on the toast (spread `hold` on it), and each input is tracked on its own, so leaving with the mouse
 * does not end a hold that focus still has. The state lives with the toast, so removing a held toast (Undo
 * clicked under the pointer, which fires no mouseleave) discards its hold too.
 */
export function useToastCountdown(onExpire: () => void): ToastHold {
  const [pointerOver, setPointerOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = pointerOver || focused;

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(onExpire, UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [held, onExpire]);

  return useMemo(
    () => ({
      onMouseEnter: () => setPointerOver(true),
      onMouseLeave: () => setPointerOver(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    }),
    [],
  );
}
