# Share the capacity-concurrency amenity types with the client

**Phase**: — · **Deps**: —

## Goal

Remove the duplicated, drift-prone `amenity?.type === 'desk'` check in
`BookingCalendar.jsx` by sourcing it from the same list `functions/index.js` uses to decide
which amenity types allow capacity-based overlap.

## Files

- `src/services/amenities.js` (edited) — add an exported
  `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ['desk']` constant, matching
  `functions/index.js:56`.
- `functions/index.js` (edited) — no behavior change; optionally add a comment noting the
  client copy in `src/services/amenities.js` must be kept in sync (functions code isn't
  bundled into the client, so this can't be a single shared import across the
  `functions/`/`src/` boundary).
- `src/components/BookingCalendar.jsx` (edited) — replace
  `amenity?.type === 'desk' && capacity > 1` (line 448) with
  `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY.includes(amenity?.type) && capacity > 1`.

## Acceptance

- [ ] `BookingCalendar.jsx` no longer hardcodes the literal string `'desk'` for the
      shared-capacity check.
- [ ] `src/services/amenities.js` exports `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY` with
      the same contents as `functions/index.js`'s constant of the same name.
- [ ] NOT: this does not change which amenity types currently allow capacity overlap —
      both lists stay `['desk']`.

## Verify

- `npm run lint` → passes.
- `npm run build` → passes.
- `npm test` → passes (existing `bookingRange.test.js` desk-capacity cases unaffected).
- regression: manually book a desk amenity in `firebase emulators:start` and confirm the
  peak-concurrency grid behavior (available up to `capacity`, booked beyond it) is
  unchanged.

## Notes

`functions/index.js` and `src/services/amenities.js` are separate deployables (Cloud
Functions vs. the client bundle) with no shared import path between them, so this cannot be
a single source of truth — it's two lists that must be kept manually in sync, same as
`REGION` today (see CLAUDE.md's "Region pin, two places"). The fix is about giving the
client its own named constant instead of an inline literal, not eliminating the duplication
entirely.
