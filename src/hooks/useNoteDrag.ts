import { useCallback, type PointerEvent, type RefObject } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId } from '../types';
import { clampPosition, pointInEdges } from '../utils/geometry';
import { beginPointerDrag } from '../utils/pointerDrag';

export function translate(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

/**
 * Move-and-trash interaction for one note. The element is moved through its ref while dragging; the store
 * is touched once, on release, either to commit the position or to delete the note over the trash zone.
 */
export function useNoteDrag(
  id: NoteId,
  noteRef: RefObject<HTMLElement>,
  boardRef: RefObject<HTMLElement>,
  trashRef: RefObject<HTMLElement>,
): (event: PointerEvent<HTMLElement>) => void {
  const store = useStore();

  return useCallback(
    (event) => {
      const el = noteRef.current;
      const board = boardRef.current;
      const trash = trashRef.current;
      const start = store.getNote(id);
      // Only presses on the header itself; its buttons (color, delete) are separate targets.
      if (!el || !board || !trash || !start || event.button !== 0 || event.target !== event.currentTarget) return;

      const bounds = { width: board.clientWidth, height: board.clientHeight };
      const trashEdges = trash.getBoundingClientRect();
      let position = { x: start.x, y: start.y };
      let overTrash = false;

      beginPointerDrag(event, {
        onStart() {
          el.classList.add('note--dragging');
        },
        onMove(dx, dy, pointer) {
          position = clampPosition(start.x + dx, start.y + dy, start, bounds);
          el.style.transform = translate(position.x, position.y);
          const over = pointInEdges(pointer, trashEdges);
          if (over !== overTrash) {
            overTrash = over;
            el.classList.toggle('note--doomed', over);
            trash.classList.toggle('trash--active', over);
          }
        },
        onEnd(_dx, _dy, _pointer, cancelled) {
          el.classList.remove('note--dragging', 'note--doomed');
          trash.classList.remove('trash--active');
          if (!cancelled && overTrash) {
            store.remove(id);
            return;
          }
          const final = cancelled ? start : position;
          el.style.transform = translate(final.x, final.y);
          store.update(id, { x: final.x, y: final.y });
        },
      });
    },
    [store, id, noteRef, boardRef, trashRef],
  );
}
