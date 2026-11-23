import { useCallback } from 'react';
import type { Note, NoteId } from '../types';
import type { NotesState } from './notesStore';
import { useNotes } from './useNotes';

/** Subscribes to a single note; other notes changing does not re-render the caller. */
export function useNote(id: NoteId): Note | undefined {
  return useNotes(useCallback((state: NotesState) => state.notes[id], [id]));
}
