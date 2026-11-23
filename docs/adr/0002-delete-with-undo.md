# 0002. Delete immediately, recover with Undo

Status: Accepted. Supersedes the "Delete this note?" confirmation dialog for notes that contain text.

## Context
The dialog protected content, but it blocked the flow, needed focus trapping (`inert`, focus restore), and only covered the X button, so trash drags and the Delete key were inconsistent. Review feedback pointed out that blocking confirmation is the wrong pattern when the action can be reversed.

## Decision
Every deletion (X button, Delete/Backspace on a focused note, drag to trash) removes the note at once and pushes it onto an in-memory history in the store (`removed`, last 20).
- Every deletion gets its own toast, stacked in the top-right corner below the toolbar, newest on top (`UndoToast`). That corner keeps clear of the trash zone at the bottom right. A toast shows "Note deleted" and a preview of the note's text, and its Undo button restores that specific note, whichever deletion it was. The top toast is the one Ctrl/Cmd+Z restores, so the two always agree.
- Each toast has its own 6 second countdown (`useToastCountdown`), paused while the pointer or focus is on it. The state lives with the toast, so removing one while it is held cannot leave a stale hold behind. At most four toasts show; older deletions stay undoable with the shortcut. The region is a polite live region, so assistive technology announces new toasts.
- Ctrl/Cmd+Z restores the most recent deletion, repeatedly (`useUndoShortcut`). The shortcut is ignored in text fields so the browser's own text undo keeps working.
- Restoring puts the note back at its original place in the order. Deleted notes are re-fitted when the window shrinks, so a restored note is always reachable. It keeps the note's id, position, size, colour, text and stacking. Text still waiting on its debounce is already committed: every route to a delete control blurs the textarea first, and blur flushes it, so the restored note matches what the user saw.
- The history is not persisted: a reload starts clean, and the restored or deleted state is what gets saved and synced.

## Consequences
- No modal code, inert handling or focus restoration to maintain; the delete paths share one action.
- Undo is not a general edit history (moves, resizes and text are not covered). That is a deliberate scope limit.
- A note deleted more than 20 deletions ago cannot be recovered.
