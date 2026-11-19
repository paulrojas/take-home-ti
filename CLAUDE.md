# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Take-home **Sticky Notes** SPA; the brief is `docs/requirements.md`. Hard constraints: TypeScript + React with **no stock/component libraries**, plain CSS, desktop only (min 1024x768), latest Chrome/Firefox/Edge. Graded on architecture, performance, code quality, static-typing accuracy, usability. Comments: sparse, English only.

## Commands

```bash
npm run dev                        # Vite dev server
npm run build                      # tsc --noEmit && vite build -> single inlined dist/index.html (works from file://)
npm run typecheck                  # app + e2e
npm run e2e                        # build, then Playwright (chromium, firefox, edge) against dist/index.html over file://
npx playwright test --project=chromium e2e/move.spec.ts   # one browser / one spec
npm test                           # vitest run
npx vitest run src/__tests__/notesStore.test.ts   # single test file
npx vitest run -t "brings a note"                 # single test by name
```

## Architecture

- **State is outside React.** `NotesStore` (`src/store/notesStore.ts`) offers granular subscriptions: per note (`useNote`), id list (`Board`), and any-change (persistence). Notes are immutable records; never subscribe broad.
- **Drag/resize/draw bypass React state.** `src/utils/pointerDrag.ts` (`beginPointerDrag`) is the one drag primitive: pointer capture, rAF-throttled `onMove`, Escape cancels. Components mutate `el.style` via refs during the drag and commit once to the store in `onEnd`. When changing this, always re-apply final DOM values in `onEnd` (a no-op store update will not make React rewrite styles you mutated).
- `Note.tsx` is markup only. Behavior lives in hooks: `useNoteDrag` (move + trash delete), `useNoteResize`, `useNoteText` (debounced commit, pagehide flush), `useDeleteConfirmation` (dialog, inert, focus restore). They take refs, never `querySelector`. `beginPointerDrag` allows one drag at a time, so a second pointer cannot start a competing action.
- Trash hit-testing and highlight use cached rects and classList toggles through refs, not state.
- Services are created in `src/main.tsx`, outside React, and provided via `AppContext`. `SyncController` hydrates from the localStorage cache, then the mock async API (`notesApi.ts`); debounced writes to both; exposes save status via `useSyncExternalStore`.
- Untrusted data (storage/API) goes through `parseNotes` in `persistence.ts` (validation, versioned payload).
- Min-resolution guard: `useTooSmallViewport` (debounced) + `ResolutionWarning` overlay; board stays mounted underneath.
- Types: `NoteId` is branded; build ids with `createNoteId`/`asNoteId` only.
- E2E (`e2e/`) loads the **built** `dist/index.html`, so rebuild before running (`npm run e2e` does). Use roles/labels first; `data-testid` only for structural elements (`board`, `trash`, `note-header`, `resize-handle`). Assert geometry with a small tolerance and poll (`expect.poll`, `settledBox`) instead of fixed sleeps. Playwright device presets use 1280x720, which trips the app's resolution guard; keep the explicit viewport in `playwright.config.ts`.
