import { createStore, type StoreApi } from 'zustand/vanilla';
import { createNoteId, type Note, type NoteChanges, type NoteColor, type NoteId, type Rect, type Size } from '../types';
import { clampPosition, clampSize } from '../utils/geometry';

/** How many deletions can be undone. */
export const UNDO_LIMIT = 20;

/** A deleted note and the notes that came before it, so undo can put it back in place in any order. */
export interface RemovedNote {
  readonly note: Note;
  /** `ids` ahead of the note at deletion time; the restore goes after the last one that still exists. */
  readonly before: readonly NoteId[];
  /** Increases with every deletion; a stable identity for the toast that offers its undo. */
  readonly seq: number;
}

export interface NotesState {
  /** Immutable records; every change replaces the one note and the map. */
  readonly notes: Readonly<Record<NoteId, Note>>;
  /** Creation order. Its identity changes only when notes are added or removed. */
  readonly ids: readonly NoteId[];
  /** Deleted notes, most recent last. Memory only: never persisted. */
  readonly removed: readonly RemovedNote[];
  readonly create: (rect: Rect, color?: NoteColor) => NoteId;
  readonly update: (id: NoteId, changes: NoteChanges) => void;
  readonly remove: (id: NoteId) => void;
  /** Restores the most recently deleted note with its id, content, stacking and place in the order. */
  readonly undoLast: () => void;
  /** Restores one specific deleted note, whatever order the deletions happened in. */
  readonly undoRemove: (id: NoteId) => void;
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

/** Returns the same object when the note already fits, so unchanged notes keep their identity. */
function fitNote(note: Note, bounds: Size): Note {
  const size = clampSize(note.width, note.height, { x: 0, y: 0 }, bounds);
  const position = clampPosition(note.x, note.y, size, bounds);
  const unchanged =
    position.x === note.x && position.y === note.y && size.width === note.width && size.height === note.height;
  return unchanged ? note : { ...note, ...position, ...size };
}

function highestZ(notes: readonly Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.z), 0);
}

/** Index right after the nearest id of `before` (searched from the end) that is still in `ids`; 0 if none is. */
function insertionIndex(before: readonly NoteId[], ids: readonly NoteId[]): number {
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const at = ids.indexOf(before[i] as NoteId);
    if (at !== -1) return at + 1;
  }
  return 0;
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
  let nextSeq = 1;

  return createStore<NotesState>()((set, get) => {
    const restore = ({ note, before, seq }: RemovedNote): void =>
      set((state) => {
        // Right after the nearest earlier neighbour that is still there, whatever else changed meanwhile.
        const at = insertionIndex(before, state.ids);
        return {
          notes: { ...state.notes, [note.id]: note },
          ids: [...state.ids.slice(0, at), note.id, ...state.ids.slice(at)],
          removed: state.removed.filter((entry) => entry.seq !== seq),
        };
      });

    return {
      notes: indexById(initial),
      ids: initial.map((note) => note.id),
      removed: [],

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
        const before = get().ids.slice(0, get().ids.indexOf(id));
        const seq = nextSeq++;
        set((state) => {
          const { [id]: _removed, ...notes } = state.notes;
          return {
            notes,
            ids: state.ids.filter((existing) => existing !== id),
            removed: [...state.removed, { note, before, seq }].slice(-UNDO_LIMIT),
          };
        });
      },

      undoLast() {
        const { removed } = get();
        const last = removed[removed.length - 1];
        if (last) restore(last);
      },

      undoRemove(id) {
        const entry = get().removed.find((candidate) => candidate.note.id === id);
        if (entry) restore(entry);
      },

      bringToFront(id) {
        const current = get().notes[id];
        if (!current || current.z === nextZ - 1) return;
        get().update(id, { z: nextZ++ });
      },

      constrainTo(bounds) {
        const { notes, removed } = get();
        // One update for the whole board, so a shrinking window causes a single notification and save.
        // Deleted notes are fitted too, so an undo never brings one back outside the board.
        let notesChanged = false;
        let removedChanged = false;
        const fitted: Record<NoteId, Note> = {};
        Object.values(notes).forEach((note) => {
          const next = fitNote(note, bounds);
          if (next !== note) notesChanged = true;
          fitted[note.id] = next;
        });
        const fittedRemoved = removed.map((entry) => {
          const next = fitNote(entry.note, bounds);
          if (next === entry.note) return entry;
          removedChanged = true;
          return { ...entry, note: next };
        });
        // Keep each reference when it did not change: a new `notes` object means "save", history alone does not.
        if (notesChanged || removedChanged) {
          set({ notes: notesChanged ? fitted : notes, removed: removedChanged ? fittedRemoved : removed });
        }
      },

      replaceAll(next) {
        nextZ = Math.max(nextZ, highestZ(next) + 1);
        set({ notes: indexById(next), ids: next.map((note) => note.id), removed: [] });
      },
    };
  });
}
