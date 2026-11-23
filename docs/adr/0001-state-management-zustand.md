# 0001. Zustand for note state

Status: Accepted. Supersedes the first design, a hand-written `NotesStore` class with manual pub/sub.

## Context
Dragging, resizing and typing must not re-render the board or other notes. The first version solved this with a custom store (per-note, id-list and any-change subscriptions plus a version counter). Review feedback called it over-engineering: it re-implements what a small, proven library already does, and every contributor has to learn bespoke code.

## Decision
Use Zustand's vanilla `createStore` (`src/store/notesStore.ts`).
- The store still lives outside React, so services (`SyncController`) and unit tests use it without rendering anything.
- State is `{ notes: Record<NoteId, Note>, ids, removed, removals }` plus actions (`create`, `update`, `remove`, `undoRemove`, `bringToFront`, `constrainTo`, `replaceAll`). Notes stay immutable records.
- Components subscribe through selectors (`useNotes`): a note reads `state.notes[id]`, the board reads `state.ids`. A selector result is compared by reference, so editing note A leaves note B and the board untouched, and `ids` keeps its identity until a note is added or removed.
- `SyncController` subscribes once and reacts only when `state.notes` changes, so undo history alone never triggers a save. "Did the store change while the API call was in flight" is a reference comparison of `notes`, which replaces the old version counter.

## Consequences
- About 130 lines of subscription code disappear; one small dependency is added.
- Drag, resize and draw still bypass React state entirely (DOM through refs, one store write on release), so the performance model is unchanged.
- The "no component libraries" rule in the brief concerns UI components; a state helper does not conflict with it.
