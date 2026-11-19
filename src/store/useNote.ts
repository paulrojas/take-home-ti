import { useCallback, useSyncExternalStore } from 'react';
import type { Note, NoteId } from '../types';
import { useStore } from './AppContext';

/** Subscribes to a single note; other notes changing does not re-render the caller. */
export function useNote(id: NoteId): Note | undefined {
  const store = useStore();
  const subscribe = useCallback((listener: () => void) => store.subscribeNote(id, listener), [store, id]);
  const getSnapshot = useCallback(() => store.getNote(id), [store, id]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
