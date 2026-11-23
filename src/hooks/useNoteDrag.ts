import { useCallback, type PointerEvent, type RefObject } from 'react';
import { useStore } from '../store/AppContext';
import type { NoteId } from '../types';
import { clampPosition, rectsOverlap } from '../utils/geometry';
import { beginPointerDrag } from '../utils/pointerDrag';

export function translate(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

/**
 * Move-and-trash interaction for one note. The element is moved through its ref while dragging; the store
 * is touched once, on release, either to commit the position or to delete the note when its card overlaps the
 * trash zone.
 */
export function useNoteDrag(
  id: NoteId,
  noteRef: RefObject<HTMLElement | null>,
  boardRef: RefObject<HTMLElement | null>,
  trashRef: RefObject<HTMLElement | null>,
): (event: PointerEvent<HTMLElement>) => void {
  const store = useStore();

  return useCallback(
    (event) => {
      const el = noteRef.current;
      const board = boardRef.current;
      const trash = trashRef.current;
      const { notes, update, remove } = store.getState();
      const start = notes[id];
      // Only presses on the header itself; its buttons (color, delete) are separate targets.
      if (!el || !board || !trash || !start || event.button !== 0 || event.target !== event.currentTarget) return;

      const bounds = { width: board.clientWidth, height: board.clientHeight };
      const trashEdges = trash.getBoundingClientRect();
      const boardEdges = board.getBoundingClientRect();
      let position = { x: start.x, y: start.y };
      const cardEdges = (at: { x: number; y: number }) => ({
        left: boardEdges.left + at.x,
        top: boardEdges.top + at.y,
        right: boardEdges.left + at.x + start.width,
        bottom: boardEdges.top + at.y + start.height,
      });
      let overTrash = false;
      // A note that already covers the trash (drawn, resized or pushed there) is only a drop target once it
      // has left the zone, so clicking or nudging it never deletes it.
      let armed = !rectsOverlap(cardEdges(start), trashEdges);

      beginPointerDrag(event, {
        onStart() {
          el.classList.add('note--dragging');
        },
        onMove(dx, dy) {
          position = clampPosition(start.x + dx, start.y + dy, start, bounds);
          el.style.transform = translate(position.x, position.y);
          // The card, not the pointer, decides: a note covering the trash is dropped into it.
          const touching = rectsOverlap(cardEdges(position), trashEdges);
          if (!touching) armed = true;
          const over = armed && touching;
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
            remove(id);
            return;
          }
          const final = cancelled ? start : position;
          el.style.transform = translate(final.x, final.y);
          update(id, { x: final.x, y: final.y });
        },
      });
    },
    [store, id, noteRef, boardRef, trashRef],
  );
}
