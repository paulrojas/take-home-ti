import { useCallback, type PointerEvent, type RefObject } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId, Size } from '../types';
import { clampSize } from '../utils/geometry';
import { beginPointerDrag } from '../utils/pointerDrag';

/** Corner-grip resize for one note: size is written through the ref while dragging, committed on release. */
export function useNoteResize(
  id: NoteId,
  noteRef: RefObject<HTMLElement | null>,
  boardRef: RefObject<HTMLElement | null>,
): (event: PointerEvent<HTMLElement>) => void {
  const store = useStore();

  return useCallback(
    (event) => {
      const el = noteRef.current;
      const board = boardRef.current;
      const { notes, update } = store.getState();
      const start = notes[id];
      if (!el || !board || !start || event.button !== 0) return;

      const bounds = { width: board.clientWidth, height: board.clientHeight };
      let size: Size = { width: start.width, height: start.height };
      const apply = (next: Size): void => {
        el.style.width = `${next.width}px`;
        el.style.height = `${next.height}px`;
      };

      beginPointerDrag(event, {
        onStart() {
          el.classList.add('note--resizing');
        },
        onMove(dx, dy) {
          size = clampSize(start.width + dx, start.height + dy, start, bounds);
          apply(size);
        },
        onEnd(_dx, _dy, _pointer, cancelled) {
          el.classList.remove('note--resizing');
          const final = cancelled ? start : size;
          apply(final);
          update(id, { width: final.width, height: final.height });
        },
      });
    },
    [store, id, noteRef, boardRef],
  );
}
