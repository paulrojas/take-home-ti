# Sticky Notes

Single-page sticky notes app. TypeScript + React (no component libraries) and plain CSS.

## Run

```bash
npm install
npm run dev        # dev server
npm run build      # type-checks, then writes a single self-contained dist/index.html
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
```

`dist/index.html` has all JS and CSS inlined, so it also opens directly from disk (`file://`).

## Features

- Create a note: **New note** button, or drag on empty board space to draw one at any position and size
- Move (drag the colored header), resize (bottom-right grip), delete (drag onto the trash zone, or the × button / Delete key)
- Bring to front on click, text editing, six colors (⋯ menu in the header)
- Notes persist to localStorage and sync to a mocked asynchronous REST API (`src/services/notesApi.ts`), with a save status indicator
- Windows smaller than 1024×768 get a warning overlay asking the user to enlarge the window

## Design notes

- **State lives outside React** (`src/store/notesStore.ts`) with granular subscriptions: the board re-renders only when notes are added or removed, and each note only when its own record changes.
- **Drag and resize never touch React state.** `src/utils/pointerDrag.ts` runs pointer-captured, `requestAnimationFrame`-throttled drags; components mutate the element's style through refs and commit once on release.
- Handlers are stable (`useCallback`, `memo`); text edits, cache writes, API saves and window-resize checks are debounced.
- Escape cancels a drag in progress.
