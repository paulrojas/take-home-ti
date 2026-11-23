# 0002. Delete immediately, recover with Undo

Status: Accepted. Supersedes the "Delete this note?" confirmation dialog for notes that contain text.

## Context
The dialog protected content, but it blocked the flow, needed focus trapping (`inert`, focus restore), and only covered the X button, so trash drags and the Delete key were inconsistent. Review feedback pointed out that blocking confirmation is the wrong pattern when the action can be reversed.

## Decision
Every deletion (X button, Delete/Backspace on a focused note, drag to trash) removes the note at once and pushes it onto an in-memory history in the store (`removed`, last 20).
- A toast "Note deleted - Undo" appears for 6 seconds (`UndoToast`, `useUndoToast`). It is a polite live region, so assistive technology announces it.
- Ctrl/Cmd+Z restores the most recent deletion, repeatedly (`useUndoShortcut`). The shortcut is ignored in text fields so the browser's own text undo keeps working.
- Restoring keeps the note's id, position, size, colour, text and stacking. Text still waiting on its debounce is committed before removal, so the restored note matches what the user saw.
- The history is not persisted: a reload starts clean, and the restored or deleted state is what gets saved and synced.

## Consequences
- No modal code, inert handling or focus restoration to maintain; the delete paths share one action.
- Undo is not a general edit history (moves, resizes and text are not covered). That is a deliberate scope limit.
- A note deleted more than 20 deletions ago cannot be recovered.
