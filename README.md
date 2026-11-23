# Sticky Notes

Single-page sticky notes app. TypeScript + React (no component libraries) and plain CSS.

## Run

```bash
npm install
npm run dev        # dev server
npm run build      # type-checks, then writes a single self-contained dist/index.html
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run e2e:install  # once: download Playwright browsers (Chromium, Firefox, Edge)
npm run e2e          # builds, then runs the end-to-end suite in all browsers
```

`dist/index.html` has all JS and CSS inlined, so it also opens directly from disk (`file://`).

## Features

- Create a note: **New note** button, or drag on empty board space to draw one at any position and size
- Move (drag the colored header), resize (bottom-right grip), delete (drag the note so it overlaps the trash zone, or the × button / Delete key)
- Deleting never asks first: a toast offers **Undo** and Ctrl/Cmd+Z restores deleted notes one by one
- Bring to front on click, text editing, six colors (⋯ menu in the header)
- Notes persist to localStorage and sync to a mocked asynchronous REST API (`src/services/notesApi.ts`), with a save status indicator
- Windows smaller than 1024×768 get a warning overlay asking the user to enlarge the window

## Design notes

- **State lives outside React** in a Zustand vanilla store (`src/store/notesStore.ts`) read through selectors: the board re-renders only when notes are added or removed, and each note only when its own record changes.
- **Drag and resize never touch React state.** `src/utils/pointerDrag.ts` runs pointer-captured, `requestAnimationFrame`-throttled drags; components mutate the element's style through refs and commit once on release.
- Handlers are stable (`useCallback`, `memo`); text edits, cache writes, API saves and window-resize checks are debounced.
- Escape cancels a drag in progress.

## Decisions

Architecture decisions are recorded in [`docs/adr`](docs/adr/README.md): Zustand state, delete-with-undo, card-based trash hit-testing, React 19 and ESLint.

## End-to-end tests (Playwright)

`e2e/` drives the **built `dist/index.html` over `file://`** with real mouse and keyboard input in Chromium (Chrome engine), Firefox and Microsoft Edge. It covers every feature in the brief, fast and imprecise pointer movement, isolation between drag/resize/delete, storage-write strategy, persistence/API restore and the minimum-resolution guard.

```bash
npm run e2e                          # all browsers
npx playwright test --project=edge   # one browser (chromium | firefox | edge)
npm run e2e:ui                       # interactive runner
npx playwright show-report           # last HTML report, traces on failure
```

Limits: a green run shows the app works in those engines on the machine that ran it. Edge shares Chromium's engine; Safari/WebKit, other operating systems and older browser versions are not covered. Device presets default to a 1280x720 viewport, which is below the app's 768px minimum height, so the config sets 1280x800 explicitly.
