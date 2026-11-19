import { memo, useCallback, useRef, useSyncExternalStore, type PointerEvent } from 'react';
import { useStore } from '../store/AppContext';
import { DRAW_THRESHOLD, fitNoteRect, normalizeRect } from '../utils/geometry';
import { beginPointerDrag } from '../utils/pointerDrag';
import { Note } from './Note';
import { TrashZone } from './TrashZone';

/**
 * Subscribes only to the list of note ids, so it re-renders when notes are added or removed and never
 * while they are edited, moved or resized.
 */
function BoardImpl() {
  const store = useStore();
  const ids = useSyncExternalStore(store.subscribeIds, store.getIds);
  const boardRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const board = boardRef.current;
      const ghost = ghostRef.current;
      // Only drags that start on empty board space draw a note.
      if (!board || !ghost || event.target !== event.currentTarget || event.button !== 0) return;

      const bounds = board.getBoundingClientRect();
      const origin = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      let drawn = normalizeRect(origin, origin);

      beginPointerDrag(event, {
        onMove(dx, dy) {
          drawn = normalizeRect(origin, { x: origin.x + dx, y: origin.y + dy });
          ghost.style.transform = `translate3d(${drawn.x}px, ${drawn.y}px, 0)`;
          ghost.style.width = `${drawn.width}px`;
          ghost.style.height = `${drawn.height}px`;
          ghost.hidden = Math.max(drawn.width, drawn.height) < DRAW_THRESHOLD;
        },
        onEnd(_dx, _dy, _pointer, cancelled) {
          ghost.hidden = true;
          if (cancelled || Math.max(drawn.width, drawn.height) < DRAW_THRESHOLD) return;
          store.create(fitNoteRect(drawn, { width: board.clientWidth, height: board.clientHeight }));
        },
      });
    },
    [store],
  );

  return (
    <div className="board" ref={boardRef} onPointerDown={onPointerDown}>
      {ids.map((id) => (
        <Note key={id} id={id} boardRef={boardRef} trashRef={trashRef} />
      ))}
      <div className="ghost" ref={ghostRef} hidden />
      <TrashZone innerRef={trashRef} />
    </div>
  );
}

export const Board = memo(BoardImpl);
