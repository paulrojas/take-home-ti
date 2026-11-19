import { describe, expect, it } from 'vitest';
import { createLocalNotesCache, deserializeNotes, parseNotes, serializeNotes } from '../services/persistence';
import { asNoteId, type Note } from '../types';

const note: Note = { id: asNoteId('a'), x: 1, y: 2, width: 200, height: 150, text: 'hi', color: 'pink', z: 3 };

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('persistence', () => {
  it('round-trips notes', () => {
    expect(deserializeNotes(serializeNotes([note]))).toEqual([note]);
  });

  it('drops malformed notes and tolerates garbage', () => {
    expect(parseNotes([note, { ...note, color: 'red' }, { ...note, x: 'nope' }, null, 5])).toEqual([note]);
    expect(parseNotes('nope')).toEqual([]);
    expect(deserializeNotes('{not json')).toEqual([]);
    expect(deserializeNotes(JSON.stringify({ version: 99, notes: [note] }))).toEqual([]);
    expect(deserializeNotes(null)).toEqual([]);
  });

  it('cache survives missing or failing storage', () => {
    expect(createLocalNotesCache('k', null).load()).toEqual([]);
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const cache = createLocalNotesCache('k', throwing);
    expect(cache.load()).toEqual([]);
    expect(() => cache.save([note])).not.toThrow();
  });

  it('cache saves and loads through storage', () => {
    const cache = createLocalNotesCache('k', memoryStorage());
    cache.save([note]);
    expect(cache.load()).toEqual([note]);
  });
});
