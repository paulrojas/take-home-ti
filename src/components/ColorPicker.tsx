import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { NOTE_COLORS, type NoteColor } from '../types';

interface ColorPickerProps {
  readonly current: NoteColor;
  readonly onPick: (color: NoteColor) => void;
}

function ColorPickerImpl({ current, onPick }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    // Click-outside is tracked on the document because some browsers don't focus buttons on click.
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onPick(event.currentTarget.dataset.color as NoteColor);
      setOpen(false);
    },
    [onPick],
  );

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Change color"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className="color-picker__popover" role="menu">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="menuitemradio"
              aria-checked={color === current}
              aria-label={color}
              data-color={color}
              className={`swatch swatch--${color}`}
              onClick={pick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const ColorPicker = memo(ColorPickerImpl);
