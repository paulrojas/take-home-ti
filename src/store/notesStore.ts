import { createNoteId, type Note, type NoteChanges, type NoteColor, type NoteId, type Rect } from '../types';

type Listener = () => void;

/**
 * Framework-agnostic note store. Subscriptions are granular so React components re-render only for what
 * they display: one note's record, the list of ids, or (for persistence) any change at all.
 * Notes are immutable; every change replaces the record.
 */
export class NotesStore {
  private readonly notes = new Map<NoteId, Note>();
  private ids: readonly NoteId[] = [];
  private nextZ = 1;
  private version = 0;
  private readonly noteListeners = new Map<NoteId, Set<Listener>>();
  private readonly idListeners = new Set<Listener>();
  private readonly changeListeners = new Set<Listener>();

  constructor(initial: readonly Note[] = []) {
    this.load(initial);
  }

  getNote = (id: NoteId): Note | undefined => this.notes.get(id);

  getIds = (): readonly NoteId[] => this.ids;

  /** Notes in creation order. */
  getAll(): readonly Note[] {
    return Array.from(this.notes.values());
  }

  /** Increases on every mutation; lets async work detect that the store changed under it. */
  getVersion(): number {
    return this.version;
  }

  subscribeNote(id: NoteId, listener: Listener): () => void {
    let listeners = this.noteListeners.get(id);
    if (!listeners) {
      listeners = new Set();
      this.noteListeners.set(id, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.noteListeners.delete(id);
    };
  }

  subscribeIds = (listener: Listener): (() => void) => {
    this.idListeners.add(listener);
    return () => this.idListeners.delete(listener);
  };

  subscribeChanges(listener: Listener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  create(rect: Rect, color: NoteColor = 'yellow'): NoteId {
    const id = createNoteId();
    this.notes.set(id, { ...rect, id, text: '', color, z: this.nextZ++ });
    this.ids = [...this.ids, id];
    this.emitIds();
    this.emitChange();
    return id;
  }

  update(id: NoteId, changes: NoteChanges): void {
    const current = this.notes.get(id);
    if (!current) return;
    const unchanged = (Object.keys(changes) as (keyof NoteChanges)[]).every((key) => current[key] === changes[key]);
    if (unchanged) return;
    this.notes.set(id, { ...current, ...changes });
    this.emitNote(id);
    this.emitChange();
  }

  remove(id: NoteId): void {
    if (!this.notes.delete(id)) return;
    this.ids = this.ids.filter((existing) => existing !== id);
    this.emitNote(id);
    this.emitIds();
    this.emitChange();
  }

  bringToFront(id: NoteId): void {
    const current = this.notes.get(id);
    if (!current || current.z === this.nextZ - 1) return;
    this.update(id, { z: this.nextZ++ });
  }

  /** Replaces all notes, e.g. when hydrating from storage or the API. */
  replaceAll(notes: readonly Note[]): void {
    const previousIds = this.ids;
    this.load(notes);
    previousIds.forEach((id) => this.emitNote(id));
    this.notes.forEach((_, id) => this.emitNote(id));
    this.emitIds();
    this.emitChange();
  }

  private load(notes: readonly Note[]): void {
    this.notes.clear();
    notes.forEach((note) => this.notes.set(note.id, note));
    this.ids = Array.from(this.notes.keys());
    this.nextZ = notes.reduce((max, note) => Math.max(max, note.z), 0) + 1;
  }

  private emitNote(id: NoteId): void {
    this.noteListeners.get(id)?.forEach((listener) => listener());
  }

  private emitIds(): void {
    this.idListeners.forEach((listener) => listener());
  }

  private emitChange(): void {
    this.version += 1;
    this.changeListeners.forEach((listener) => listener());
  }
}
