# Clean up doc gap and dead event-approval code
**Phase**: — · **Deps**: —

## Goal
Two small, independent, zero-risk hygiene items found during the 2026-08-31 review:
README's Cloud Functions table is missing a callable added five weeks ago, and two
unused, unsafe event-approval helpers sit next to the real (`reviewEvent`) flow as a
footgun for a future change.

## Files
- `README.md` (edited) — add `getAmenityBookingRanges` (auth-checked, `functions/index.js:653`)
  to the Cloud Functions table with the same format as the existing entries.
- `src/services/events.js` (edited) — delete `approveEvent`/`rejectEvent` (currently lines
  312-329): confirmed zero callers anywhere in `src/` (admin approval exclusively uses the
  `reviewEvent` callable via `src/services/functions.js`); these bare `updateDoc` calls skip
  the revision check, Event Hall booking creation/cancellation, and notification guarantees
  `reviewEvent` provides.

## Acceptance
- [ ] README's Cloud Functions table includes `getAmenityBookingRanges` with a one-line description matching the table's existing style.
- [ ] `approveEvent` and `rejectEvent` no longer exist in `src/services/events.js`.
- [ ] NOT: does not touch `reviewEvent` or any other currently-used event approval path.

## Verify
- `npm run lint && npm run build` → green.
- `grep -rn "approveEvent\|rejectEvent" src/` → no matches (confirms no caller was missed before deletion).

## Notes
Both items are safe to land together in one small PR — neither has any runtime
dependency on the other.
