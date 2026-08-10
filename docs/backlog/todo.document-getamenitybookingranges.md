# Document getAmenityBookingRanges in the Cloud Functions references

**Phase**: — · **Deps**: —

## Goal

Bring README.md and `docs/knowledge/data-flow.md` back in sync with `functions/index.js`
now that `getAmenityBookingRanges` (added in PR #67) is the primary path
`BookingCalendar` uses for cross-member booking occupancy.

## Files

- `README.md` (edited) — add a `getAmenityBookingRanges` row to the Cloud Functions table
  (after `checkSlotAvailability`, around line 223): Callable, "Anonymized booking occupancy
  (start/end/status only) for the calendar grid; members cannot query bookings by amenity
  directly."
- `docs/knowledge/data-flow.md` (edited) — add the same function to §4's Cloud Functions
  wiring table (around line 178), and add one sentence to §5's `bookings` rules-table row
  (around line 190) noting that cross-member occupancy for the calendar now comes from this
  callable rather than a direct Firestore read.

## Acceptance

- [ ] README.md's Cloud Functions table lists `getAmenityBookingRanges` with type
      "Callable".
- [ ] `docs/knowledge/data-flow.md` §4's table lists `getAmenityBookingRanges`.
- [ ] `docs/knowledge/data-flow.md` §5's `bookings` row mentions the callable as the
      source of anonymized cross-member occupancy.
- [ ] NOT: no code changes — this spec only touches documentation.

## Verify

- `npm run lint` → passes (unaffected, but keep green per the Checks gate).
- `npm run build` → passes (unaffected).
- Manual: grep both files for `getAmenityBookingRanges` and confirm a match in each.
