import type { Note } from '../types';
import { createLocalNotesCache } from './persistence';

export interface NotesApi {
  fetchNotes(): Promise<readonly Note[]>;
  saveNotes(notes: readonly Note[]): Promise<void>;
}

export interface MockNotesApiOptions {
  /** Simulated network latency range in milliseconds. */
  readonly minLatency?: number;
  readonly maxLatency?: number;
}

function delay(minLatency: number, maxLatency: number): Promise<void> {
  const ms = minLatency + Math.random() * Math.max(0, maxLatency - minLatency);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asynchronous stand-in for a REST backend (`GET /notes`, `PUT /notes`). The "server" state lives in
 * its own storage key so it survives reloads like a real backend would.
 */
export function createMockNotesApi(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  { minLatency = 150, maxLatency = 450 }: MockNotesApiOptions = {},
): NotesApi {
  const server = createLocalNotesCache('sticky-notes:mock-server', storage);

  return {
    async fetchNotes() {
      await delay(minLatency, maxLatency);
      return server.load();
    },
    async saveNotes(notes) {
      await delay(minLatency, maxLatency);
      server.save(notes);
    },
  };
}
