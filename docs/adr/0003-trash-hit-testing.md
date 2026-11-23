# 0003. Trash hit-testing uses the note card

Status: Accepted. Replaces pointer-position hit-testing.

## Context
The trash check only asked whether the pointer was inside the trash zone. A large note could cover the trash while the pointer stayed on its header outside the zone, so the note looked dropped but was kept.

## Decision
While dragging, the note's rectangle (clamped position plus size, shifted by the board's viewport offset) is tested against the trash rectangle with `rectsOverlap` (`src/utils/geometry.ts`). Any shared area counts; edges that only touch do not.
- The highlight (`note--doomed`, `trash--active`) and the delete on release read the same boolean, so what the user sees is what happens.
- Both rectangles are measured once when the drag starts, so no layout reads happen per move. Escape still cancels and keeps the note.
- Resize and draw never delete; only a move can.

## Consequences
- Dropping a big note that merely overlaps the trash deletes it. Undo (ADR 0002) makes that recoverable, which is why the most forgiving rule is acceptable.
