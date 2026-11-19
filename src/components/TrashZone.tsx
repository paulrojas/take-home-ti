import { memo, type RefObject } from 'react';

interface TrashZoneProps {
  readonly innerRef: RefObject<HTMLDivElement>;
}

/** Drop target for deleting notes. Its highlight is toggled by the dragged note through the ref. */
function TrashZoneImpl({ innerRef }: TrashZoneProps) {
  return (
    <div className="trash" data-testid="trash" ref={innerRef} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
      </svg>
      <span>Drop here to delete</span>
    </div>
  );
}

export const TrashZone = memo(TrashZoneImpl);
