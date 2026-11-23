import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoToast } from '../components/UndoToast';
import { useUndoShortcut } from '../hooks/useUndoShortcut';
import { UNDO_TOAST_MS } from '../hooks/useUndoToast';
import { createMockNotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { AppProvider } from '../store/AppContext';
import { createNotesStore, type NotesStore } from '../store/notesStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rect = { x: 0, y: 0, width: 200, height: 200 };

function Harness() {
  useUndoShortcut();
  return (
    <>
      <UndoToast />
      <textarea />
    </>
  );
}

let container: HTMLDivElement;
let root: Root;
let store: NotesStore;

const toast = (): HTMLElement | null => container.querySelector('.toast');
const undoButton = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('.toast__action')!;

function pressUndo(target: EventTarget = document.body, init: KeyboardEventInit = { ctrlKey: true }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function deleteNote(): void {
  act(() => store.getState().remove(store.getState().create(rect)));
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  store = createNotesStore();
  const sync = new SyncController(store, createMockNotesApi(null), createLocalNotesCache('k', null));
  act(() => {
    root.render(
      <AppProvider store={store} sync={sync}>
        <Harness />
      </AppProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('undo toast', () => {
  it('stays hidden until something is deleted', () => {
    expect(toast()).toBeNull();
    act(() => void store.getState().create(rect));
    expect(toast()).toBeNull();
  });

  it('appears after a deletion and restores the note through its button', () => {
    deleteNote();
    expect(toast()?.textContent).toContain('Note deleted');

    act(() => undoButton().click());

    expect(store.getState().ids).toHaveLength(1);
    expect(toast()).toBeNull();
  });

  it('disappears on its own after a few seconds, but the deletion stays undoable', () => {
    deleteNote();
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS + 10));

    expect(toast()).toBeNull();
    expect(store.getState().removed).toHaveLength(1);
  });

  it('waits while the pointer or focus is on the toast, then counts down again', () => {
    deleteNote();
    act(() => void toast()!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS * 3));
    expect(toast()).not.toBeNull();

    act(() => void toast()!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS + 10));
    expect(toast()).toBeNull();
  });

  it('comes back with a fresh countdown after a partial undo while more can be undone', () => {
    deleteNote();
    deleteNote();
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS + 10));
    expect(toast()).toBeNull();

    act(() => store.getState().undoRemove());
    expect(toast()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS - 100));
    expect(toast()).not.toBeNull();
  });

  it('restarts the countdown on a new deletion', () => {
    deleteNote();
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS - 1000));
    deleteNote();
    act(() => void vi.advanceTimersByTime(UNDO_TOAST_MS - 1000));
    expect(toast()).not.toBeNull();
  });
});

describe('undo shortcut', () => {
  it.each([
    ['Ctrl+Z', { ctrlKey: true }],
    ['Cmd+Z', { metaKey: true }],
  ])('%s restores the last deleted note', (_label, init) => {
    deleteNote();
    const event = pressUndo(document.body, init);
    expect(store.getState().ids).toHaveLength(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('undoes several deletions one by one', () => {
    deleteNote();
    deleteNote();
    pressUndo();
    pressUndo();
    expect(store.getState().ids).toHaveLength(2);
  });

  it('leaves the browser text undo alone while typing', () => {
    deleteNote();
    const event = pressUndo(container.querySelector('textarea')!);
    expect(store.getState().ids).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('works on layouts where the key is not a Latin z', () => {
    deleteNote();
    pressUndo(document.body, { ctrlKey: true, key: 'я', code: 'KeyZ' });
    expect(store.getState().ids).toHaveLength(1);
  });

  it('ignores a held key, so auto-repeat cannot unwind the history', () => {
    deleteNote();
    pressUndo(document.body, { ctrlKey: true, repeat: true });
    expect(store.getState().ids).toHaveLength(0);
  });

  it('ignores plain Z, Ctrl+Shift+Z and an empty history', () => {
    pressUndo(document.body, {});
    deleteNote();
    pressUndo(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    pressUndo(document.body, {});
    expect(store.getState().ids).toHaveLength(0);
  });
});
