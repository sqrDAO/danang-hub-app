# Harden the invalidation hook, calendar error state, and lint guard
**Phase**: — · **Deps**: centralize-invalidation-helper

## Goal
Three small follow-ups to the PR #20–#29 React Query cleanup: the shared invalidation
hook returns a fresh closure each render, `UnifiedCalendar` now swallows fetch errors
entirely, and the new lint guard misses the worst form of the bug it was written for.

## Files
- `src/hooks/useInvalidateQueries.js` (edited) — wrap the returned function in
  `useCallback` with `[queryClient]`.
- `src/components/UnifiedCalendar.jsx` (edited) — destructure `error` from the bookings
  and events queries (lines ~96 and ~104) and render an inline error state instead of an
  empty calendar.
- `.eslintrc.cjs` (edited) — widen the `no-restricted-syntax` selector (line ~42) so a
  non-`ObjectExpression` first argument and a zero-argument call both error.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — key for the calendar error message.

## Acceptance
- [ ] `useInvalidateQueries` returns a referentially stable function across renders.
- [ ] A failing bookings fetch in `UnifiedCalendar` renders a visible error message.
- [ ] A failing events fetch in `UnifiedCalendar` renders a visible error message.
- [ ] `queryClient.invalidateQueries()` with no arguments fails lint.
- [ ] `queryClient.invalidateQueries(someVariable)` fails lint.
- [ ] `queryClient.invalidateQueries({ queryKey: ['x'] })` still passes lint.
- [ ] `npm run lint` passes on the existing tree after the selector change.
- [ ] NOT: no behavior change at the nine existing `invalidate(...)` call sites.
- [ ] NOT: do not add `retry`/`refetchOnWindowFocus` overrides while in these files.

## Verify
- `npm run lint && npm run build` → green
- temporarily add `queryClient.invalidateQueries()` to any page → `npm run lint` fails
  with the guard's message; revert
- `npm run dev` → block the Firestore request in devtools and open the calendar; an error
  message renders instead of a blank month
- regression: create a booking → calendar still refreshes via the existing invalidation

## Notes
The hook's unmemoized identity is harmless today — all nine call sites use it inside
mutation `onSuccess`, none in a dependency array. `useCallback` is prophylactic; do not
present it as a bug fix.

The v4 `onError` removed from `UnifiedCalendar` in PR #25 was genuinely dead (v5 ignores
it), so this is a new error surface, not a restored one.
