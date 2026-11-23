import { useStore as useZustandStore } from 'zustand';
import type { NoteId } from '../types';
import { useStore } from './AppContext';
import type { NotesState } from './notesStore';

/** Subscribes to a slice of the notes state; the component re-renders only when the selected value changes. */
export function useNotes<T>(selector: (state: NotesState) => T): T {
  return useZustandStore(useStore(), selector);
}

export const selectIds = (state: NotesState): readonly NoteId[] => state.ids;
