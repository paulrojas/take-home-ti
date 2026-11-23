import { createStore, type StoreApi } from 'zustand/vanilla';
import { createNoteId, type Note, type NoteChanges, type NoteColor, type NoteId, type Rect, type Size } from '../types';
import { clampPosition, clampSize } from '../utils/geometry';

/** How many deletions can be undone. */
export const UNDO_LIMIT = 20;

export interface NotesState {
  /** Immutable records; every change replaces the one note and the map. */
  readonly notes: Readonly<Record<NoteId, Note>>;
  /** Creation order. Its identity changes only when notes are added or removed. */
  readonly ids: readonly NoteId[];
  /** Deleted notes, most recent last. Memory only: never persisted. */
  readonly removed: readonly Note[];
  /** Counts deletions, so the UI can tell a new deletion from an undo. */
  readonly removals: number;
  readonly create: (rect: Rect, color?: NoteColor) => NoteId;
  readonly update: (id: NoteId, changes: NoteChanges) => void;
  readonly remove: (id: NoteId) => void;
  /** Restores the most recently deleted note with its original id, content and stacking. */
  readonly undoRemove: () => void;
  readonly bringToFront: (id: NoteId) => void;
  /** Pulls notes that no longer fit (e.g. after the window shrank) back inside the bounds. */
  readonly constrainTo: (bounds: Size) => void;
  /** Replaces all notes, e.g. when hydrating from storage or the API. */
  readonly replaceAll: (notes: readonly Note[]) => void;
}

export type NotesStore = StoreApi<NotesState>;

function indexById(notes: readonly Note[]): Record<NoteId, Note> {
  const index: Record<NoteId, Note> = {};
  notes.forEach((note) => (index[note.id] = note));
  return index;
}

function highestZ(notes: readonly Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.z), 0);
}

/** Notes in creation order. */
export function selectAllNotes({ ids, notes }: NotesState): readonly Note[] {
  return ids.flatMap((id) => notes[id] ?? []);
}

/**
 * Vanilla Zustand store, created outside React so services and tests can use it directly. Components
 * subscribe through selectors (one note, or the id list), which keeps re-renders granular.
 */
export function createNotesStore(initial: readonly Note[] = []): NotesStore {
  // Monotonic, so a note restored by undo never ties with a newer one.
  let nextZ = highestZ(initial) + 1;

  return createStore<NotesState>()((set, get) => ({
    notes: indexById(initial),
    ids: initial.map((note) => note.id),
    removed: [],
    removals: 0,

    create(rect, color = 'yellow') {
      const id = createNoteId();
      const note: Note = { ...rect, id, text: '', color, z: nextZ++ };
      set((state) => ({ notes: { ...state.notes, [id]: note }, ids: [...state.ids, id] }));
      return id;
    },

    update(id, changes) {
      const current = get().notes[id];
      if (!current) return;
      const unchanged = (Object.keys(changes) as (keyof NoteChanges)[]).every((key) => current[key] === changes[key]);
      if (unchanged) return;
      set((state) => ({ notes: { ...state.notes, [id]: { ...current, ...changes } } }));
    },

    remove(id) {
      const note = get().notes[id];
      if (!note) return;
      set((state) => {
        const { [id]: _removed, ...notes } = state.notes;
        return {
          notes,
          ids: state.ids.filter((existing) => existing !== id),
          removed: [...state.removed, note].slice(-UNDO_LIMIT),
          removals: state.removals + 1,
        };
      });
    },

    undoRemove() {
      const { removed } = get();
      const note = removed[removed.length - 1];
      if (!note) return;
      set((state) => ({
        notes: { ...state.notes, [note.id]: note },
        ids: [...state.ids, note.id],
        removed: removed.slice(0, -1),
      }));
    },

    bringToFront(id) {
      const current = get().notes[id];
      if (!current || current.z === nextZ - 1) return;
      get().update(id, { z: nextZ++ });
    },

    constrainTo(bounds) {
      const { notes, ids, update } = get();
      ids.forEach((id) => {
        const note = notes[id];
        if (!note) return;
        const size = clampSize(note.width, note.height, { x: 0, y: 0 }, bounds);
        update(id, { ...clampPosition(note.x, note.y, size, bounds), ...size });
      });
    },

    replaceAll(next) {
      nextZ = Math.max(nextZ, highestZ(next) + 1);
      set({ notes: indexById(next), ids: next.map((note) => note.id), removed: [] });
    },
  }));
}
