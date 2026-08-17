# Centralize the client's shared-desk capacity check
**Phase**: — · **Deps**: —

## Goal
`BookingCalendar.jsx` hardcodes `amenity?.type === 'desk' && capacity > 1` to decide whether an
amenity allows overlapping bookings, duplicating the server's canonical
`AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ["desk"]` (`functions/index.js:60`) with no shared
source. They agree today; keep the client-side copy in one place so a future addition to the
server list doesn't silently miss the client.

## Files
- `src/services/amenities.js` (edited) — export `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = new
  Set(['desk'])`, alongside the existing amenity-type defaults already in this file.
- `src/components/BookingCalendar.jsx` (edited) — import it and replace the inline
  `amenity?.type === 'desk'` check (~line 500) with
  `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY.has(amenity?.type)`.
- `functions/index.js` (edited) — add a one-line comment above its own
  `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY` (line 60) noting that
  `src/services/amenities.js` mirrors this list and must be updated in the same change.

## Acceptance
- [ ] `BookingCalendar.jsx`'s shared-desk check reads from the new exported constant, not an
      inline string comparison.
- [ ] Booking calendar rendering for desks (capacity > 1) and all other amenity types is
      unchanged (visual/behavioral no-op for this change).
- [ ] `functions/index.js`'s constant has a comment pointing at `src/services/amenities.js`.
- [ ] `npm run lint && npm run build` pass.
- [ ] NOT: do not attempt to import the constant across the `functions/`/`src/` package boundary
      — they are separate deploy targets; this is a cross-reference by comment, not a shared
      module.

## Verify
- `npm run lint` → passes.
- `npm run build` → passes.
- `npm run dev`, open the booking calendar for a desk amenity with capacity > 1 and for a
  single-occupancy amenity → overlap/greyed-out behavior identical to before the change.
