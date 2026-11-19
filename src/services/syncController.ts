import type { NotesStore } from '../store/notesStore';
import { debounce } from '../utils/debounce';
import type { NotesApi } from './notesApi';
import type { NotesCache } from './persistence';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

type Listener = () => void;

const CACHE_DEBOUNCE_MS = 250;
const API_DEBOUNCE_MS = 600;

/**
 * Keeps the store in sync with the local cache and the (mock) REST API. Writes are debounced so a burst
 * of edits produces a single save. The cache is shown instantly on load; the API result wins once it
 * arrives, unless the user already changed something in the meantime.
 */
export class SyncController {
  private status: SyncStatus = 'idle';
  private readonly listeners = new Set<Listener>();
  private saveSequence = 0;
  private applyingRemote = false;
  private started = false;

  private readonly writeCache = debounce(() => this.cache.save(this.store.getAll()), CACHE_DEBOUNCE_MS);
  private readonly pushRemote = debounce(() => void this.save(), API_DEBOUNCE_MS);

  constructor(
    private readonly store: NotesStore,
    private readonly api: NotesApi,
    private readonly cache: NotesCache,
  ) {}

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.started) return;
    this.started = true;

    this.store.replaceAll(this.cache.load());
    this.store.subscribeChanges(this.onStoreChange);
    window.addEventListener('pagehide', this.flush);

    void this.hydrateFromApi();
  }

  retry = (): void => {
    this.pushRemote.cancel();
    void this.save();
  };

  /** Writes pending changes to the cache right away; used when the page is going away. */
  flush = (): void => {
    this.writeCache.flush();
  };

  private onStoreChange = (): void => {
    if (this.applyingRemote) return;
    // Invalidate any in-flight save so its result cannot mark newer edits as saved.
    this.saveSequence += 1;
    this.setStatus('saving');
    this.writeCache();
    this.pushRemote();
  };

  private async hydrateFromApi(): Promise<void> {
    const versionAtStart = this.store.getVersion();
    try {
      const remote = await this.api.fetchNotes();
      if (this.store.getVersion() !== versionAtStart) return;
      this.applyingRemote = true;
      try {
        this.store.replaceAll(remote);
      } finally {
        this.applyingRemote = false;
      }
      this.cache.save(remote);
    } catch {
      // Offline start: keep working from the cache; the next edit will try to sync again.
    }
  }

  private async save(): Promise<void> {
    const sequence = ++this.saveSequence;
    this.setStatus('saving');
    try {
      await this.api.saveNotes(this.store.getAll());
      if (sequence === this.saveSequence) this.setStatus('saved');
    } catch {
      if (sequence === this.saveSequence) this.setStatus('error');
    }
  }

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }
}
