import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Note } from '../components/Note';
import { createMockNotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { AppProvider } from '../store/AppContext';
import { NotesStore } from '../store/notesStore';
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
  cache.save(store.getAll());
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
const dialog = (): HTMLElement | null => container.querySelector('[role="alertdialog"]');
const confirmButton = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('.confirm-button--danger')!;
const cancelButton = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('.confirm-button:not(.confirm-button--danger)')!;
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
  store = new NotesStore();
  id = store.create(rect);
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
  it('removes an empty note without asking', () => {
    render();
    click(deleteButton());
    expect(store.getNote(id)).toBeUndefined();
  });

  it('treats whitespace-only text as empty', () => {
    render();
    type('   \n ');
    click(deleteButton());
    expect(store.getNote(id)).toBeUndefined();
  });

  it('asks for confirmation when the note has text, and keeps it until confirmed', () => {
    render();
    type('keep me');
    click(deleteButton());

    expect(dialog()).not.toBeNull();
    expect(store.getNote(id)).toBeDefined();

    click(confirmButton());
    expect(store.getNote(id)).toBeUndefined();
  });

  it('asks even when the latest text is still waiting on the debounce', () => {
    vi.useFakeTimers();
    render();
    type('unsaved');
    expect(store.getNote(id)!.text).toBe('');
    click(deleteButton());
    expect(dialog()).not.toBeNull();
  });

  it('cancel keeps the note and its text and closes the dialog', () => {
    render();
    type('keep me');
    click(deleteButton());
    click(cancelButton());

    expect(dialog()).toBeNull();
    expect(store.getNote(id)).toBeDefined();
    expect(container.querySelector('textarea')!.value).toBe('keep me');
  });

  it('focuses Cancel by default so Enter cannot delete', () => {
    render();
    type('keep me');
    click(deleteButton());
    expect(document.activeElement).toBe(cancelButton());
  });

  it('Escape closes the dialog without deleting, even when focus is not inside it', () => {
    render();
    type('keep me');
    click(deleteButton());
    const note = container.querySelector<HTMLElement>('.note')!;
    // Clicking the dialog backdrop moves focus to the note root, outside the dialog's own subtree.
    act(() => note.focus());
    act(() => {
      note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(dialog()).toBeNull();
    expect(store.getNote(id)).toBeDefined();
  });

  it('returns focus to the element that had it before the dialog opened', () => {
    render();
    type('keep me');
    act(() => deleteButton().focus());
    click(deleteButton());
    expect(document.activeElement).toBe(cancelButton());

    act(() => {
      cancelButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.activeElement).toBe(deleteButton());
  });
});

describe('Note unload', () => {
  it('commits and caches pending text on pagehide', () => {
    vi.useFakeTimers();
    render();
    type('typed just before closing');
    expect(store.getNote(id)!.text).toBe('');

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(store.getNote(id)!.text).toBe('typed just before closing');
    expect(cache.load()[0]?.text).toBe('typed just before closing');
  });
});

describe('Note Delete key', () => {
  it('goes through the same confirmation when the note is focused', () => {
    render();
    type('keep me');
    const note = container.querySelector<HTMLElement>('.note')!;
    act(() => {
      note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    expect(dialog()).not.toBeNull();
    expect(store.getNote(id)).toBeDefined();
  });

  it('is ignored while typing in the textarea', () => {
    render();
    type('keep me');
    act(() => {
      container.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(dialog()).toBeNull();
    expect(store.getNote(id)).toBeDefined();
  });
});
