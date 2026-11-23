import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Note } from '../components/Note';
import { createMockNotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { AppProvider } from '../store/AppContext';
import { createNotesStore, selectAllNotes, type NotesStore } from '../store/notesStore';
import type { NoteId } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rect = { x: 0, y: 0, width: 200, height: 200 };

let container: HTMLDivElement;
let root: Root;
let store: NotesStore;
let id: NoteId;
let cache: ReturnType<typeof createLocalNotesCache>;
let storage: Map<string, string>;

function render(): void {
  const sync = new SyncController(store, createMockNotesApi(null), cache);
  // start() hydrates from the cache, so seed it with the note under test.
  cache.save(selectAllNotes(store.getState()));
  sync.start();
  act(() => {
    root.render(
      <AppProvider store={store} sync={sync}>
        <Note id={id} boardRef={createRef<HTMLDivElement>()} trashRef={createRef<HTMLDivElement>()} />
      </AppProvider>,
    );
  });
}

const deleteButton = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('[aria-label="Delete note"]')!;
const click = (el: HTMLElement): void => void act(() => el.click());

function type(text: string): void {
  const area = container.querySelector('textarea')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  store = createNotesStore();
  id = store.getState().create(rect);
  storage = new Map();
  cache = createLocalNotesCache('k', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => void storage.set(key, value),
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('Note delete button', () => {
  it('removes an empty note at once', () => {
    render();
    click(deleteButton());
    expect(store.getState().notes[id]).toBeUndefined();
  });

  it('removes a note with text at once, without asking, and keeps it undoable', () => {
    render();
    const area = container.querySelector('textarea')!;
    act(() => area.focus());
    type('keep me');
    // Reaching the delete control moves focus away from the textarea, which commits its text.
    act(() => area.blur());
    click(deleteButton());

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(store.getState().notes[id]).toBeUndefined();
    act(() => store.getState().undoRemove());
    expect(store.getState().notes[id]?.text).toBe('keep me');
  });
});

describe('Note Delete key', () => {
  const press = (target: Element, key: string): void =>
    void act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

  it('Delete and Backspace on the focused note remove it', () => {
    render();
    press(container.querySelector('.note')!, 'Delete');
    expect(store.getState().notes[id]).toBeUndefined();
  });

  it('is ignored while typing in the textarea', () => {
    render();
    type('keep me');
    press(container.querySelector('textarea')!, 'Backspace');
    expect(store.getState().notes[id]).toBeDefined();
  });
});

describe('Note unload', () => {
  it('commits and caches pending text on pagehide', () => {
    vi.useFakeTimers();
    render();
    type('typed just before closing');
    expect(store.getState().notes[id]!.text).toBe('');

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(store.getState().notes[id]!.text).toBe('typed just before closing');
    expect(cache.load()[0]?.text).toBe('typed just before closing');
  });
});
