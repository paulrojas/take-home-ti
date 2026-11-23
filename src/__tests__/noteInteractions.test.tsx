import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Note } from '../components/Note';
import { createMockNotesApi } from '../services/notesApi';
import { createLocalNotesCache } from '../services/persistence';
import { SyncController } from '../services/syncController';
import { AppProvider } from '../store/AppContext';
import { createNotesStore, type NotesStore } from '../store/notesStore';
import type { NoteId } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BOARD = { width: 1000, height: 600 };
const TRASH = { left: 800, top: 450, right: 920, bottom: 550 };

let container: HTMLDivElement;
let root: Root;
let store: NotesStore;
let id: NoteId;
let changes: number;

/** jsdom has no PointerEvent; React only reads pointerId, clientX/Y and button from the native event. */
function pointer(target: Element, type: string, x: number, y: number, pointerId = 1): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  act(() => {
    target.dispatchEvent(event);
  });
}

function frame(): void {
  act(() => {
    vi.advanceTimersByTime(20);
  });
}

const note = (): HTMLElement => container.querySelector<HTMLElement>('.note')!;
const header = (): HTMLElement => container.querySelector<HTMLElement>('.note__header')!;
const grip = (): HTMLElement => container.querySelector<HTMLElement>('.note__resize')!;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  store = createNotesStore();
  id = store.getState().create({ x: 100, y: 100, width: 200, height: 200 });
  changes = 0;

  const board = document.createElement('div');
  Object.defineProperty(board, 'clientWidth', { value: BOARD.width });
  Object.defineProperty(board, 'clientHeight', { value: BOARD.height });
  const trash = document.createElement('div');
  trash.getBoundingClientRect = () => ({ ...TRASH, x: TRASH.left, y: TRASH.top, width: 120, height: 100, toJSON: () => ({}) });
  const boardRef = createRef<HTMLDivElement>() as { current: HTMLDivElement | null };
  const trashRef = createRef<HTMLDivElement>() as { current: HTMLDivElement | null };
  boardRef.current = board;
  trashRef.current = trash;

  const sync = new SyncController(store, createMockNotesApi(null), createLocalNotesCache('k', null));
  act(() => {
    root.render(
      <AppProvider store={store} sync={sync}>
        <Note id={id} boardRef={boardRef} trashRef={trashRef} />
      </AppProvider>,
    );
  });
  store.subscribe(() => (changes += 1));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('moving a note', () => {
  it('follows the pointer without touching the store, then commits once on release', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 200, 170);
    frame();

    expect(note().style.transform).toBe('translate3d(150px, 160px, 0)');
    expect(changes).toBe(0);
    expect(note().classList.contains('note--dragging')).toBe(true);

    pointer(header(), 'pointerup', 200, 170);
    expect(changes).toBe(1);
    expect(store.getState().notes[id]).toMatchObject({ x: 150, y: 160, width: 200, height: 200 });
    expect(note().classList.contains('note--dragging')).toBe(false);
  });

  it('keeps tracking when the pointer leaves the note and the board, and clamps to the board', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 5000, -5000);
    pointer(header(), 'pointerup', 5000, -5000);

    expect(store.getState().notes[id]).toMatchObject({ x: BOARD.width - 200, y: 0 });
  });

  it('applies the final position even if the last move was never flushed by a frame', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 170, 130);
    pointer(header(), 'pointerup', 190, 150);

    expect(store.getState().notes[id]).toMatchObject({ x: 140, y: 140 });
  });

  it('Escape cancels and restores the original position', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 400, 300);
    frame();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(note().style.transform).toBe('translate3d(100px, 100px, 0)');
    expect(store.getState().notes[id]).toMatchObject({ x: 100, y: 100 });
    expect(changes).toBe(0);
  });

  it('pressing the header buttons never starts a drag', () => {
    const deleteButton = container.querySelector('[aria-label="Delete note"]')!;
    pointer(deleteButton, 'pointerdown', 150, 110);
    pointer(deleteButton, 'pointermove', 400, 300);
    frame();

    expect(note().classList.contains('note--dragging')).toBe(false);
    expect(changes).toBe(0);
  });

  it('ignores a second pointer while a drag is running', () => {
    pointer(header(), 'pointerdown', 150, 110, 1);
    pointer(grip(), 'pointerdown', 290, 290, 2);
    pointer(grip(), 'pointermove', 400, 400, 2);
    frame();

    expect(note().classList.contains('note--resizing')).toBe(false);
    pointer(header(), 'pointerup', 150, 110, 1);
    expect(store.getState().notes[id]).toMatchObject({ width: 200, height: 200 });
  });
});

describe('deleting by dragging to the trash', () => {
  it('highlights while over the trash and removes the note on release there', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 850, 500);
    frame();
    expect(note().classList.contains('note--doomed')).toBe(true);

    pointer(header(), 'pointerup', 850, 500);
    expect(store.getState().notes[id]).toBeUndefined();
  });

  it('deletes when the card covers the trash even though the pointer is outside it', () => {
    pointer(header(), 'pointerdown', 150, 110);
    // The note ends at x 620-820, y 300-500: its body overlaps the trash, the pointer (670, 310) does not.
    pointer(header(), 'pointermove', 670, 310);
    frame();
    expect(note().classList.contains('note--doomed')).toBe(true);

    pointer(header(), 'pointerup', 670, 310);
    expect(store.getState().notes[id]).toBeUndefined();
  });

  describe('a note that already covers the trash', () => {
    beforeEach(() => {
      act(() => store.getState().update(id, { x: 750, y: 400 }));
    });

    it('is not deleted by a plain click on its header', () => {
      pointer(header(), 'pointerdown', 800, 410);
      pointer(header(), 'pointerup', 800, 410);
      expect(store.getState().notes[id]).toBeDefined();
    });

    it('is not deleted when nudged while still covering the trash', () => {
      pointer(header(), 'pointerdown', 800, 410);
      pointer(header(), 'pointermove', 810, 415);
      frame();
      expect(note().classList.contains('note--doomed')).toBe(false);
      pointer(header(), 'pointerup', 810, 415);
      expect(store.getState().notes[id]).toBeDefined();
    });

    it('is deleted once it has left the trash and is dropped back onto it', () => {
      pointer(header(), 'pointerdown', 800, 410);
      pointer(header(), 'pointermove', 300, 200);
      frame();
      pointer(header(), 'pointermove', 800, 410);
      frame();
      expect(note().classList.contains('note--doomed')).toBe(true);
      pointer(header(), 'pointerup', 800, 410);
      expect(store.getState().notes[id]).toBeUndefined();
    });
  });

  it('keeps the note when the card only touches the trash edge', () => {
    pointer(header(), 'pointerdown', 150, 110);
    // Note x 600-800 and y 250-450 meets the trash corner at exactly (800, 450).
    pointer(header(), 'pointermove', 650, 260);
    frame();
    expect(note().classList.contains('note--doomed')).toBe(false);
    pointer(header(), 'pointerup', 650, 260);
    expect(store.getState().notes[id]).toBeDefined();
  });

  it('keeps the note when released outside the trash, even after passing over it', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 850, 500);
    frame();
    pointer(header(), 'pointermove', 400, 300);
    frame();
    expect(note().classList.contains('note--doomed')).toBe(false);

    pointer(header(), 'pointerup', 400, 300);
    expect(store.getState().notes[id]).toBeDefined();
  });

  it('Escape over the trash cancels without deleting', () => {
    pointer(header(), 'pointerdown', 150, 110);
    pointer(header(), 'pointermove', 850, 500);
    frame();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(store.getState().notes[id]).toMatchObject({ x: 100, y: 100 });
  });
});

describe('resizing a note', () => {
  it('changes only the size, committing once on release', () => {
    pointer(grip(), 'pointerdown', 295, 295);
    pointer(grip(), 'pointermove', 395, 345);
    frame();

    expect(note().style.width).toBe('300px');
    expect(note().style.height).toBe('250px');
    expect(changes).toBe(0);

    pointer(grip(), 'pointerup', 395, 345);
    expect(changes).toBe(1);
    expect(store.getState().notes[id]).toMatchObject({ x: 100, y: 100, width: 300, height: 250 });
  });

  it('enforces the minimum size and the board edge', () => {
    pointer(grip(), 'pointerdown', 295, 295);
    pointer(grip(), 'pointermove', -900, -900);
    pointer(grip(), 'pointerup', -900, -900);
    expect(store.getState().notes[id]).toMatchObject({ width: 120, height: 120 });

    pointer(grip(), 'pointerdown', 195, 195);
    pointer(grip(), 'pointermove', 9000, 9000);
    pointer(grip(), 'pointerup', 9000, 9000);
    expect(store.getState().notes[id]).toMatchObject({ width: BOARD.width - 100, height: BOARD.height - 100 });
  });

  it('never deletes the note, even when released over the trash zone', () => {
    pointer(grip(), 'pointerdown', 295, 295);
    pointer(grip(), 'pointermove', 850, 500);
    pointer(grip(), 'pointerup', 850, 500);

    expect(store.getState().notes[id]).toBeDefined();
    expect(store.getState().notes[id]).toMatchObject({ x: 100, y: 100 });
  });
});

describe('stacking', () => {
  it('pressing anywhere on a note brings it to the front', () => {
    const other = store.getState().create({ x: 500, y: 100, width: 200, height: 200 });
    expect(store.getState().notes[other]!.z).toBeGreaterThan(store.getState().notes[id]!.z);

    pointer(note(), 'pointerdown', 120, 120);
    pointer(note(), 'pointerup', 120, 120);
    expect(store.getState().notes[id]!.z).toBeGreaterThan(store.getState().notes[other]!.z);
  });
});
