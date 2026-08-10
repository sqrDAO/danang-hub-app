# Restore or retire per-amenity slotDuration

**Phase**: — · **Deps**: —

## Decision required

`BookingCalendar.jsx` now always draws a 30-minute grid
(`CALENDAR_CELL_MINUTES = 30`, `src/components/BookingCalendar.jsx:33`), ignoring
`amenity.slotDuration` entirely. That field is still admin-facing and persisted
(`src/pages/admin/Amenities.jsx:368-373,430`, displayed at `:206`), and event-space
amenities default it to 60 minutes (`EVENT_SPACE_AVAILABILITY.slotDuration`,
`src/services/amenities.js:60`). Pick one:

- **A — Restore it.** Size `CALENDAR_CELL_MINUTES` from `availability.slotDuration` per
  amenity, so a 60-minute-slot amenity shows an hourly grid and a member can only select
  slot-duration-aligned ranges.
- **B — Retire it.** Remove `slotDuration` from the admin form, the amenity schema
  defaults, and the amenity card display, since free-form 30-minute-granularity range
  booking has replaced the old fixed-slot model. Add a one-time note in
  `docs/knowledge/data-flow.md` that booking granularity is now a fixed 30-minute grid,
  not admin-configurable.

This spec is written for **Option A** (the config field already exists and admins may be
relying on it); swap in Option B's file list if the human picks retirement instead.

## Goal

Make the booking calendar's cell granularity match each amenity's configured
`slotDuration` again, so an admin's hourly-slot setting for the event space actually
constrains what members can select.

## Files

- `src/components/BookingCalendar.jsx` (edited) — derive per-amenity cell duration from
  `availability.slotDuration` instead of the fixed `CALENDAR_CELL_MINUTES = 30`; thread it
  through `getTimeCells`, `getHourGroups`, and anywhere `CALENDAR_CELL_MINUTES` is used for
  grid sizing or CSS custom properties.
- `src/utils/bookingRange.js` (edited, if range-alignment logic needs to reject a
  candidate range that doesn't start/end on a `slotDuration` boundary) — otherwise
  unchanged if a 30-minute desk and a 60-minute event-space amenity can each just use
  their own uniform cell size with no boundary-alignment rule beyond that.
- `test/bookingRange.test.js` (edited) — add a case with `slotDuration: 60` proving the
  grid does not offer a 30-minute selection for that amenity.

## Acceptance

- [ ] An amenity with `slotDuration: 60` renders hour-sized calendar cells, not 30-minute
      cells.
- [ ] An amenity with `slotDuration: 30` (the desk default) renders 30-minute cells,
      matching current behavior.
- [ ] A member cannot submit a range shorter than the amenity's `slotDuration`.
- [ ] NOT: this changes the anonymized-occupancy shape returned by
      `getAmenityBookingRanges` — that callable is unaffected.

## Verify

- `npm run lint` → passes.
- `npm run build` → passes.
- `npm test` → passes, including the new `slotDuration: 60` case.
- Manual: in `firebase emulators:start`, set an amenity's `slotDuration` to 60, open its
  booking calendar, and confirm the grid shows hour cells only.
- regression: `test/bookingRange.test.js`'s existing desk-capacity and past-cell cases
  still pass unchanged.

## Notes

If the human picks Option B (retire the field) instead, replace the Files/Acceptance/Verify
above with: removing the `slotDuration` form control and schema default, updating
`adminAmenities.slot`-keyed i18n strings (both locales) or removing them if unused
elsewhere, and adding the data-flow.md note described in the Decision section. Do not ship
a partial state where the admin UI still offers the control but the calendar silently
ignores it, as it does today.
