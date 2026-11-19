import { memo, useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useStore, useSync } from '../store/AppContext';
import { useNote } from '../store/useNote';
import type { NoteColor, NoteId, Size } from '../types';
import { clampPosition, clampSize, pointInEdges } from '../utils/geometry';
import { beginPointerDrag } from '../utils/pointerDrag';
import { ColorPicker } from './ColorPicker';

const TEXT_COMMIT_DELAY_MS = 300;

interface NoteProps {
  readonly id: NoteId;
  readonly boardRef: RefObject<HTMLDivElement>;
  readonly trashRef: RefObject<HTMLDivElement>;
}

function translate(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

function isPrimaryPointer(event: PointerEvent<HTMLElement>): boolean {
  return event.button === 0;
}

/**
 * A sticky note. Dragging and resizing write straight to the element's style (no React state) and
 * commit the final geometry to the store once, on release.
 */
function NoteImpl({ id, boardRef, trashRef }: NoteProps) {
  const store = useStore();
  const note = useNote(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmMessageId = useId();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitText = useDebouncedCallback((text: string) => store.update(id, { text }), TEXT_COMMIT_DELAY_MS);

  // Keep the uncontrolled textarea in line with external changes (e.g. data arriving from the API).
  const text = note?.text;
  useEffect(() => {
    const area = textRef.current;
    if (area && text !== undefined && area.value !== text && document.activeElement !== area) area.value = text;
  }, [text]);

  const onRootPointerDown = useCallback(() => store.bringToFront(id), [store, id]);

  const onTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => commitText(event.target.value), [commitText]);
  const onTextBlur = useCallback(() => commitText.flush(), [commitText]);

  const onPickColor = useCallback((color: NoteColor) => store.update(id, { color }), [store, id]);

  // Notes with text ask for confirmation; empty ones are removed right away.
  const requestRemove = useCallback(() => {
    // The textarea is the source of truth: its latest edit may still be waiting on the debounce.
    if (!textRef.current?.value.trim()) {
      store.remove(id);
      return;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmingDelete(true);
  }, [store, id]);
  const cancelRemove = useCallback(() => setConfirmingDelete(false), []);
  const confirmRemove = useCallback(() => store.remove(id), [store, id]);

  // While the dialog is open the content behind it must not be reachable by keyboard or screen reader.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const covered = root.querySelectorAll<HTMLElement>('.note__header, .note__text');
    if (confirmingDelete) {
      covered.forEach((el) => (el.inert = true));
      cancelRef.current?.focus({ preventScroll: true });
      return;
    }
    covered.forEach((el) => (el.inert = false));
    // Inert is lifted first so the element that had focus before the dialog can take it back.
    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }, [confirmingDelete]);

  const onRootKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // Handled here rather than on the dialog: clicking its backdrop focuses the note root instead.
      if (confirmingDelete) {
        if (event.key === 'Escape') cancelRemove();
        return;
      }
      // Only when the note itself is focused, so typing in the textarea never deletes the note.
      if (event.target === event.currentTarget && (event.key === 'Delete' || event.key === 'Backspace')) {
        requestRemove();
      }
    },
    [confirmingDelete, cancelRemove, requestRemove],
  );

  // Text still waiting on its debounce would be lost when the page unloads.
  const sync = useSync();
  useEffect(() => {
    const flushPending = (): void => {
      commitText.flush();
      sync.flush();
    };
    window.addEventListener('pagehide', flushPending);
    return () => window.removeEventListener('pagehide', flushPending);
  }, [commitText, sync]);

  const onHeaderPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = rootRef.current;
      const board = boardRef.current;
      const trash = trashRef.current;
      const start = store.getNote(id);
      if (!el || !board || !trash || !start || !isPrimaryPointer(event)) return;
      if (event.target instanceof Element && event.target.closest('button, [data-nodrag]')) return;

      const bounds = { width: board.clientWidth, height: board.clientHeight };
      const trashEdges = trash.getBoundingClientRect();
      let position = { x: start.x, y: start.y };
      let overTrash = false;

      el.classList.add('note--dragging');

      beginPointerDrag(event, {
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
    [store, id, boardRef, trashRef],
  );

  const onResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = rootRef.current;
      const board = boardRef.current;
      const start = store.getNote(id);
      if (!el || !board || !start || !isPrimaryPointer(event)) return;

      const bounds = { width: board.clientWidth, height: board.clientHeight };
      let size = { width: start.width, height: start.height };
      const apply = (next: Size): void => {
        el.style.width = `${next.width}px`;
        el.style.height = `${next.height}px`;
      };

      el.classList.add('note--resizing');

      beginPointerDrag(event, {
        onMove(dx, dy) {
          size = clampSize(start.width + dx, start.height + dy, start, bounds);
          apply(size);
        },
        onEnd(_dx, _dy, _pointer, cancelled) {
          el.classList.remove('note--resizing');
          const final = cancelled ? start : size;
          apply(final);
          store.update(id, { width: final.width, height: final.height });
        },
      });
    },
    [store, id, boardRef],
  );

  if (!note) return null;

  return (
    <div
      ref={rootRef}
      className={`note note--${note.color}`}
      style={{ transform: translate(note.x, note.y), width: note.width, height: note.height, zIndex: note.z }}
      tabIndex={0}
      onPointerDown={onRootPointerDown}
      onKeyDown={onRootKeyDown}
    >
      <div className="note__header" onPointerDown={onHeaderPointerDown}>
        <ColorPicker current={note.color} onPick={onPickColor} />
        <button type="button" className="icon-button" aria-label="Delete note" data-nodrag onClick={requestRemove}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
      <textarea
        ref={textRef}
        className="note__text"
        defaultValue={note.text}
        placeholder="Take a note..."
        spellCheck={false}
        aria-label="Note text"
        onChange={onTextChange}
        onBlur={onTextBlur}
      />
      <div className="note__resize" onPointerDown={onResizePointerDown} aria-hidden="true" />
      {confirmingDelete && (
        <div className="note__confirm" role="alertdialog" aria-modal="true" aria-describedby={confirmMessageId}>
          <p id={confirmMessageId}>Delete this note?</p>
          <div className="note__confirm-actions">
            <button type="button" className="confirm-button confirm-button--danger" onClick={confirmRemove}>
              Delete
            </button>
            {/* Cancel takes focus so a stray Enter never destroys content. */}
            <button type="button" className="confirm-button" ref={cancelRef} onClick={cancelRemove}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Note = memo(NoteImpl);
