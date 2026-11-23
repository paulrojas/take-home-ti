import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoToast } from '../components/UndoToast';
import { useUndoShortcut } from '../hooks/useUndoShortcut';
import { MAX_VISIBLE_TOASTS, UNDO_TOAST_MS } from '../hooks/useToastCountdown';
import { createMockNotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { AppProvider } from '../store/AppContext';
import { createNotesStore, type NotesStore } from '../store/notesStore';
import type { NoteId } from '../types';

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

const toasts = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('.toast'));
const toast = (): HTMLElement | null => toasts()[0] ?? null;
const undoButton = (index = 0): HTMLButtonElement => toasts()[index]!.querySelector<HTMLButtonElement>('.toast__action')!;

function pressUndo(target: EventTarget = document.body, init: KeyboardEventInit = { ctrlKey: true }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function deleteNote(text = ''): NoteId {
  const id = store.getState().create(rect);
  act(() => {
    store.getState().update(id, { text });
    store.getState().remove(id);
  });
  return id;
}

const advance = (ms: number): void => void act(() => void vi.advanceTimersByTime(ms));
const hover = (el: HTMLElement, type: 'mouseover' | 'mouseout'): void =>
  void act(() => void el.dispatchEvent(new MouseEvent(type, { bubbles: true })));

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

describe('undo toasts', () => {
  it('stay hidden until something is deleted', () => {
    expect(toasts()).toHaveLength(0);
    act(() => void store.getState().create(rect));
    expect(toasts()).toHaveLength(0);
  });

  it('show one toast per deletion, newest first, with a preview of the text', () => {
    deleteNote('first');
    deleteNote('second');
    deleteNote('');

    expect(toasts()).toHaveLength(3);
    expect(toasts()[1]!.textContent).toContain('second');
    expect(toasts()[2]!.textContent).toContain('first');
    expect(toasts()[0]!.querySelector('.toast__preview')).toBeNull();
  });

  it("restore that toast's note and leave the other deletions undoable", () => {
    const first = deleteNote('first');
    const second = deleteNote('second');
    deleteNote('third');

    act(() => undoButton(1).click());

    expect(store.getState().notes[second]?.text).toBe('second');
    expect(store.getState().notes[first]).toBeUndefined();
    expect(toasts()).toHaveLength(2);
    expect(store.getState().removed).toHaveLength(2);
  });

  it('disappear on their own, each after its own countdown', () => {
    deleteNote('old');
    advance(UNDO_TOAST_MS - 1000);
    deleteNote('new');

    advance(1100);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]!.textContent).toContain('new');

    advance(UNDO_TOAST_MS);
    expect(toasts()).toHaveLength(0);
    expect(store.getState().removed).toHaveLength(2);
  });

  it('wait while the pointer is on that toast only, then count down again', () => {
    deleteNote('held');
    deleteNote('free');
    hover(toasts()[1]!, 'mouseover');

    advance(UNDO_TOAST_MS * 3);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]!.textContent).toContain('held');

    hover(toasts()[0]!, 'mouseout');
    advance(UNDO_TOAST_MS + 10);
    expect(toasts()).toHaveLength(0);
  });

  it('do not stay held after Undo removes the toast under the pointer', () => {
    deleteNote();
    hover(toast()!, 'mouseover');
    act(() => undoButton().click());
    expect(toasts()).toHaveLength(0);

    deleteNote();
    advance(UNDO_TOAST_MS + 10);
    expect(toasts()).toHaveLength(0);
  });

  it('show only the newest few; older deletions stay undoable with the shortcut', () => {
    const ids = Array.from({ length: MAX_VISIBLE_TOASTS + 1 }, (_, i) => deleteNote(`note ${i}`));

    expect(toasts()).toHaveLength(MAX_VISIBLE_TOASTS);
    for (let i = 0; i < ids.length; i += 1) pressUndo();
    expect(store.getState().ids).toHaveLength(ids.length);
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
