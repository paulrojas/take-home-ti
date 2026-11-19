import { memo, useCallback, useRef, type RefObject } from 'react';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation';
import { translate, useNoteDrag } from '../hooks/useNoteDrag';
import { useNoteResize } from '../hooks/useNoteResize';
import { useNoteText } from '../hooks/useNoteText';
import { useStore } from '../store/AppContext';
import { useNote } from '../store/useNote';
import type { NoteColor, NoteId } from '../types';
import { ColorPicker } from './ColorPicker';
import { DeleteConfirmation } from './DeleteConfirmation';

interface NoteProps {
  readonly id: NoteId;
  readonly boardRef: RefObject<HTMLDivElement>;
  readonly trashRef: RefObject<HTMLDivElement>;
}

/**
 * A sticky note: markup only. Dragging, resizing, text editing and deletion each live in their own hook
 * and write to the DOM through refs, so none of them re-renders the note while it is in use.
 */
function NoteImpl({ id, boardRef, trashRef }: NoteProps) {
  const store = useStore();
  const note = useNote(id);
  const noteRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const onHeaderPointerDown = useNoteDrag(id, noteRef, boardRef, trashRef);
  const onResizePointerDown = useNoteResize(id, noteRef, boardRef);
  const text = useNoteText(id, textRef, note?.text);
  const deletion = useDeleteConfirmation(id, textRef, [headerRef, textRef]);

  const onPointerDown = useCallback(() => store.bringToFront(id), [store, id]);
  const onPickColor = useCallback((color: NoteColor) => store.update(id, { color }), [store, id]);

  if (!note) return null;

  return (
    <div
      ref={noteRef}
      className={`note note--${note.color}`}
      style={{ transform: translate(note.x, note.y), width: note.width, height: note.height, zIndex: note.z }}
      role="group"
      aria-label="Sticky note"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={deletion.onNoteKeyDown}
    >
      <div className="note__header" data-testid="note-header" ref={headerRef} onPointerDown={onHeaderPointerDown}>
        <ColorPicker current={note.color} onPick={onPickColor} />
        <button type="button" className="icon-button" aria-label="Delete note" onClick={deletion.requestRemove}>
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
        onChange={text.onChange}
        onBlur={text.onBlur}
      />
      <div className="note__resize" data-testid="resize-handle" onPointerDown={onResizePointerDown} aria-hidden="true" />
      {deletion.confirming && (
        <DeleteConfirmation cancelRef={deletion.cancelRef} onConfirm={deletion.confirmRemove} onCancel={deletion.cancelRemove} />
      )}
    </div>
  );
}

export const Note = memo(NoteImpl);
