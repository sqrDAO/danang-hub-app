# Re-validate selected-range cells against live availability

**Phase**: — · **Deps**: —

## Goal

Stop the booking calendar from showing an already-selected range as valid once a cell
inside it becomes unavailable (e.g. someone else's booking lands mid-selection after a
refetch). The final `checkBookingConflicts` call still blocks the actual booking, so this
is a display-correctness fix, not an access-control one.

## Files

- `src/utils/bookingRange.js` (edited) — in `getSelectedCellState`, the `range-start`
  (lines 76-77), `range-end` (lines 80-84), and `range-selected` (lines 91-92) branches
  must check `cell.baseStatus === 'available'` before returning a selected/highlighted
  status; a cell whose `baseStatus` is no longer `available` should render as
  `range-blocked` (or clear the selection, per Acceptance below) instead.
- `test/bookingRange.test.js` (edited) — add a regression case: build a selection spanning
  3+ cells, flip one interior cell's `baseStatus` to `'booked'` after the selection is
  made, and assert `getCellState` no longer reports a selected status for any cell in that
  range.

## Acceptance

- [ ] A cell with `baseStatus !== 'available'` never returns `range-start`, `range-end`,
      `range-selected`, or `range-single` from `getCellState`, even when it falls inside
      the current `[startMs, endMs)` selection.
- [ ] The existing single-cell and multi-cell selection tests in
      `test/bookingRange.test.js` still pass unchanged (no behavior change for a
      selection where every cell stays available).
- [ ] NOT: this does not change `checkBookingConflicts`'s fail-open behavior or any
      network call — it is a pure function fix in `bookingRange.js`.

## Verify

- `npm run lint` → passes.
- `npm test` → passes, including the new stale-selection regression case.
- `npm run build` → passes.
- regression: existing `getCellState`/`getSelectedCellState` tests for `range-start`,
  `range-end`, `range-selected`, `range-single`, and `range-blocked` (candidate-extension
  path) all still pass.

## Notes

`getCandidateState`/`getUnhighlightedCandidateState` (used for the "extend an existing
selection" cells beyond the current end) already call `isRangeAvailable`, which does check
`baseStatus` — use the same pattern rather than inventing a new one. Decide during
implementation whether an interior cell going unavailable should downgrade just that cell's
display (partial `range-blocked` overlay) or clear the whole selection back to empty; either
is acceptable as long as the calendar never paints a range containing an unavailable cell as
a valid, submittable selection.
