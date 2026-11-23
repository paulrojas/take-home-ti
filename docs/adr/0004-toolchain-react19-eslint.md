# 0004. React 19 and ESLint

Status: Accepted.

## Context
The project was on React 18 and had no linter; static typing was strict but style and hook rules were unchecked.

## Decision
- Upgrade to React 19. Ref props are typed `RefObject<T | null>` to match the new `useRef` typing.
- Add ESLint (flat config, `eslint.config.js`) with `typescript-eslint` type-checked rules and `eslint-plugin-react-hooks`. `npm run lint` covers `src/` and `e2e/`.
- Two targeted disables are allowed and explained inline: the debounced callback reads its latest-function ref only when the timer fires, and the E2E storage spy re-applies the original `setItem` with the right `this`.

## Consequences
- Lint, typecheck and tests are the pre-commit checks (`npm run lint && npm run typecheck && npm test`).
