import { useCallback, type KeyboardEvent } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId } from '../types';

interface NoteRemoval {
  readonly remove: () => void;
  /** Delete/Backspace on the focused note removes it. */
  readonly onNoteKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Removes a note at once; the deletion stays undoable. Text still waiting on its debounce is already committed:
 * reaching any delete control blurs the textarea, which flushes it.
 */
export function useNoteRemoval(id: NoteId): NoteRemoval {
  const store = useStore();

  const remove = useCallback(() => {
    store.getState().remove(id);
  }, [store, id]);

  const onNoteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Only when the note itself is focused, so typing in the textarea never deletes the note.
      if (event.target === event.currentTarget && (event.key === 'Delete' || event.key === 'Backspace')) remove();
    },
    [remove],
  );

  return { remove, onNoteKeyDown };
}
