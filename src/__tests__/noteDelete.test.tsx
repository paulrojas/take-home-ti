import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

function render(): void {
  const sync = new SyncController(store, createMockNotesApi(null), createLocalNotesCache('k', null));
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
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
    render();
    type('unsaved');
    expect(store.getNote(id)!.text).toBe('');
    click(deleteButton());
    expect(dialog()).not.toBeNull();
  });

  it('cancel keeps the note and its text, closes the dialog and refocuses the note', () => {
    render();
    type('keep me');
    click(deleteButton());
    click(cancelButton());

    expect(dialog()).toBeNull();
    expect(store.getNote(id)).toBeDefined();
    expect(container.querySelector('textarea')!.value).toBe('keep me');
    expect(document.activeElement).toBe(container.querySelector('.note'));
  });

  it('focuses Cancel by default so Enter cannot delete', () => {
    render();
    type('keep me');
    click(deleteButton());
    expect(document.activeElement).toBe(cancelButton());
  });

  it('Escape closes the dialog without deleting', () => {
    render();
    type('keep me');
    click(deleteButton());
    act(() => {
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(dialog()).toBeNull();
    expect(store.getNote(id)).toBeDefined();
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
