import { useCallback, useEffect, type ChangeEvent, type RefObject } from 'react';
import { useStore, useSync } from '../store/AppContext';
import type { NoteId } from '../types';
import { useDebouncedCallback } from './useDebouncedCallback';

const TEXT_COMMIT_DELAY_MS = 300;

interface NoteTextHandlers {
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly onBlur: () => void;
}

/**
 * Text editing for one note. The textarea is uncontrolled (typing never re-renders), edits reach the store
 * debounced, and pending text is flushed on blur and when the page goes away.
 */
export function useNoteText(id: NoteId, textRef: RefObject<HTMLTextAreaElement>, text: string | undefined): NoteTextHandlers {
  const store = useStore();
  const sync = useSync();
  const commit = useDebouncedCallback((value: string) => store.update(id, { text: value }), TEXT_COMMIT_DELAY_MS);

  // Keep the textarea in line with external changes (e.g. data arriving from the API) unless it is being edited.
  useEffect(() => {
    const area = textRef.current;
    if (area && text !== undefined && area.value !== text && document.activeElement !== area) area.value = text;
  }, [text, textRef]);

  useEffect(() => {
    const flushPending = (): void => {
      commit.flush();
      sync.flush();
    };
    window.addEventListener('pagehide', flushPending);
    return () => window.removeEventListener('pagehide', flushPending);
  }, [commit, sync]);

  const onChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => commit(event.target.value), [commit]);
  const onBlur = useCallback(() => commit.flush(), [commit]);
  return { onChange, onBlur };
}
