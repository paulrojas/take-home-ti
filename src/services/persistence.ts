import { asNoteId, isNoteColor, type Note } from '../types';

export const STORAGE_VERSION = 1;

interface StoredPayload {
  readonly version: number;
  readonly notes: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseNote(value: unknown): Note | null {
  if (!isRecord(value)) return null;
  const { id, x, y, width, height, text, color, z } = value;
  if (
    typeof id !== 'string' ||
    id === '' ||
    // Notes are indexed by id in a plain object, so this key would hit the prototype instead.
    id === '__proto__' ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isFiniteNumber(z) ||
    typeof text !== 'string' ||
    !isNoteColor(color)
  ) {
    return null;
  }
  return { id: asNoteId(id), x, y, width, height, text, color, z };
}

/** Validates untrusted data (storage, network): drops malformed notes and keeps the last of any duplicated id. */
export function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, Note>();
  value.forEach((item) => {
    const note = parseNote(item);
    if (note) byId.set(note.id, note);
  });
  return Array.from(byId.values());
}

export function serializeNotes(notes: readonly Note[]): string {
  const payload: StoredPayload = { version: STORAGE_VERSION, notes };
  return JSON.stringify(payload);
}

export function deserializeNotes(raw: string | null): Note[] {
  if (raw === null) return [];
  try {
    const payload: unknown = JSON.parse(raw);
    if (!isRecord(payload) || payload.version !== STORAGE_VERSION) return [];
    return parseNotes(payload.notes);
  } catch {
    return [];
  }
}

export interface NotesCache {
  load(): Note[];
  save(notes: readonly Note[]): void;
}

/** Storage can be missing or throw (quota, privacy modes), so failures degrade to "no cache". */
export function createLocalNotesCache(key: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null): NotesCache {
  return {
    load() {
      try {
        return deserializeNotes(storage?.getItem(key) ?? null);
      } catch {
        return [];
      }
    },
    save(notes) {
      try {
        storage?.setItem(key, serializeNotes(notes));
      } catch {
        // Persistence is best-effort.
      }
    },
  };
}
