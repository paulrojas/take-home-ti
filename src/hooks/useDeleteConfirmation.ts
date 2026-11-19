import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId } from '../types';

interface DeleteConfirmation {
  readonly confirming: boolean;
  readonly cancelRef: RefObject<HTMLButtonElement>;
  readonly requestRemove: () => void;
  readonly cancelRemove: () => void;
  readonly confirmRemove: () => void;
  /** Note-level keyboard shortcuts: Escape closes the dialog, Delete/Backspace on the note starts deletion. */
  readonly onNoteKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Delete flow for one note: notes with text ask first, empty ones go away at once. While the dialog is open
 * the covered elements are inert, and focus returns to where it was when the dialog closes.
 */
export function useDeleteConfirmation(
  id: NoteId,
  textRef: RefObject<HTMLTextAreaElement>,
  covered: readonly RefObject<HTMLElement>[],
): DeleteConfirmation {
  const store = useStore();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // The refs are stable; keeping the array in a ref lets the effect depend only on `confirming`.
  const coveredRef = useRef(covered);

  const requestRemove = useCallback(() => {
    // The textarea is the source of truth: its latest edit may still be waiting on the debounce.
    if (!textRef.current?.value.trim()) {
      store.remove(id);
      return;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirming(true);
  }, [store, id, textRef]);
  const cancelRemove = useCallback(() => setConfirming(false), []);
  const confirmRemove = useCallback(() => store.remove(id), [store, id]);

  useEffect(() => {
    const elements = coveredRef.current.map((ref) => ref.current).filter((el): el is HTMLElement => el !== null);
    if (confirming) {
      elements.forEach((el) => (el.inert = true));
      cancelRef.current?.focus({ preventScroll: true });
      return;
    }
    elements.forEach((el) => (el.inert = false));
    // Inert is lifted first so the element that had focus before the dialog can take it back.
    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }, [confirming]);

  const onNoteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Handled on the note rather than the dialog: clicking the dialog backdrop focuses the note instead.
      if (confirming) {
        if (event.key === 'Escape') cancelRemove();
        return;
      }
      // Only when the note itself is focused, so typing in the textarea never deletes the note.
      if (event.target === event.currentTarget && (event.key === 'Delete' || event.key === 'Backspace')) {
        requestRemove();
      }
    },
    [confirming, cancelRemove, requestRemove],
  );

  return { confirming, cancelRef, requestRemove, cancelRemove, confirmRemove, onNoteKeyDown };
}
