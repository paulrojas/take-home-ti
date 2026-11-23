import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockNotesApi, type NotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { createNotesStore, selectAllNotes } from '../store/notesStore';

const rect = { x: 0, y: 0, width: 200, height: 200 };

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('mock notes API', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is asynchronous and persists what was saved', async () => {
    const api = createMockNotesApi(memoryStorage(), { minLatency: 100, maxLatency: 100 });
    const source = createNotesStore();
    source.getState().create(rect);

    let saved = false;
    const pending = api.saveNotes(selectAllNotes(source.getState())).then(() => (saved = true));
    expect(saved).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(saved).toBe(true);

    const fetched = api.fetchNotes();
    await vi.advanceTimersByTimeAsync(100);
    expect(await fetched).toHaveLength(1);
  });
});

describe('SyncController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces saves, reports status and caches locally', async () => {
    const saveNotes = vi.fn<NotesApi['saveNotes']>().mockResolvedValue();
    const api: NotesApi = { fetchNotes: () => Promise.resolve([]), saveNotes };
    const cache = createLocalNotesCache('k', memoryStorage());
    const store = createNotesStore();
    const sync = new SyncController(store, api, cache);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);

    const id = store.getState().create(rect);
    store.getState().update(id, { text: 'a' });
    store.getState().update(id, { text: 'ab' });
    expect(sync.getStatus()).toBe('saving');
    expect(saveNotes).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);
    expect(saveNotes).toHaveBeenCalledTimes(1);
    expect(sync.getStatus()).toBe('saved');
    expect(cache.load()[0]?.text).toBe('ab');
  });

  it('reports an error and can retry', async () => {
    const saveNotes = vi.fn<NotesApi['saveNotes']>().mockRejectedValueOnce(new Error('down')).mockResolvedValue();
    const api: NotesApi = { fetchNotes: () => Promise.resolve([]), saveNotes };
    const store = createNotesStore();
    const sync = new SyncController(store, api, createLocalNotesCache('k', null));
    sync.start();
    await vi.advanceTimersByTimeAsync(0);

    store.getState().create(rect);
    await vi.advanceTimersByTimeAsync(700);
    expect(sync.getStatus()).toBe('error');

    sync.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.getStatus()).toBe('saved');
  });

  it('restores from cache and does not overwrite edits made before the API answers', async () => {
    const storage = memoryStorage();
    const cache = createLocalNotesCache('k', storage);
    const seed = createNotesStore();
    seed.getState().create(rect);
    cache.save(selectAllNotes(seed.getState()));

    let resolveFetch: (value: readonly never[]) => void = () => undefined;
    const api: NotesApi = {
      fetchNotes: () => new Promise((resolve) => (resolveFetch = resolve)),
      saveNotes: () => Promise.resolve(),
    };
    const store = createNotesStore();
    const sync = new SyncController(store, api, cache);
    sync.start();
    expect(store.getState().ids).toHaveLength(1);

    store.getState().create(rect);
    resolveFetch([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().ids).toHaveLength(2);
  });
});
