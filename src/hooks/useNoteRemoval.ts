import { useCallback, type KeyboardEvent, type RefObject } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId } from '../types';

interface NoteRemoval {
  readonly remove: () => void;
  /** Delete/Backspace on the focused note removes it. */
  readonly onNoteKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Removes a note at once; the deletion stays undoable. The textarea is the source of truth, so text still
 * waiting on its debounce is committed first and an undo brings back exactly what was on screen.
 */
export function useNoteRemoval(id: NoteId, textRef: RefObject<HTMLTextAreaElement | null>): NoteRemoval {
  const store = useStore();

  const remove = useCallback(() => {
    const { update, remove: removeNote } = store.getState();
    const text = textRef.current?.value;
    if (text !== undefined) update(id, { text });
    removeNote(id);
  }, [store, id, textRef]);

  const onNoteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Only when the note itself is focused, so typing in the textarea never deletes the note.
      if (event.target === event.currentTarget && (event.key === 'Delete' || event.key === 'Backspace')) remove();
    },
    [remove],
  );

  return { remove, onNoteKeyDown };
}
