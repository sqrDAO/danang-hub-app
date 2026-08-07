# Booking calendar availability read

**Phase**: — · **Deps**: —

## Goal
Members cannot create bookings: `BookingCalendar` lists bookings by `amenityId`, but
`firestore.rules` only lets a non-admin read bookings where `memberId == uid`, so the
query is denied and the calendar renders its error panel instead of the time grid.
Serve the calendar's occupancy from a callable that returns anonymized busy ranges.

## Files
- `firestore.rules` (edited) — stopgap: allow any signed-in user to read bookings; reverted in the same spec once the callable ships
- `functions/index.js` (edited) — new `getAmenityBookingRanges` callable
- `firestore.indexes.json` (edited) — composite index for `amenityId + status + startTime`
- `src/services/functions.js` (edited) — client wrapper; throws on error, never fails open
- `src/components/BookingCalendar.jsx` (edited) — query the callable instead of `getBookings`

## Acceptance
- [ ] A non-admin member sees the booking time grid and can create a booking
- [ ] `getAmenityBookingRanges` requires auth and returns only `startTime`, `endTime`, `status`
- [ ] The callable rejects a requested window wider than 60 days
- [ ] The callable returns only `pending`, `approved`, and `checked-in` bookings
- [ ] The calendar's occupied/full slots match what an admin sees for the same amenity and week
- [ ] The calendar still shows the error panel with retry when the callable fails
- [ ] The calendar's queryKey stays prefixed with `'bookings'` so `invalidate('bookings')` still refreshes it
- [ ] `firestore.rules` ends this spec with the bookings read rule back to owner-or-admin
- [ ] NOT: `memberId`, booking ids, or any other booking field reach a member client
- [ ] NOT: the calendar treats a failed availability read as "everything free"

## Verify
- `npm run lint` → clean
- `npm run build` → succeeds
- `cd functions && npm run lint` → clean
- `npm test` → all pass
- `firebase emulators:start` → sign in as a non-admin, open `/bookings`, pick an amenity:
  grid renders, an existing booking by another member shows the slot as occupied,
  and submitting creates the booking
- regression: admin `/admin/bookings` list, member `/dashboard` upcoming bookings,
  `/calendar` (UnifiedCalendar) for both roles, shared-desk capacity display

## Notes
Deploy order is load-bearing — the stopgap rule is what is keeping prod working:
1. deploy the stopgap `firestore.rules` immediately (unblocks members now)
2. `firebase deploy --only firestore:indexes` — **locally, as owner**; CI never deploys indexes
3. `firebase deploy --only functions:getAmenityBookingRanges` — **locally, as owner**; the CI
   service account cannot set IAM on a first-of-kind function deploy
4. merge the PR (CI ships hosting + rules, reverting the stopgap)

Merging before step 3 re-breaks booking for every member: the rule revert would land while
the callable is still absent.

Keep the window semantics the client already uses — filter on `startTime` within the range.
`BookingCalendar` pads the week by −7/+15 days, which covers bookings that start just outside
the visible week.

The `checkBookingConflicts` wrapper in `src/services/functions.js` swallows errors and returns
`{hasConflicts: false}`. The new wrapper must NOT copy that: fail-open here is the exact
double-booking hole `fb16ca0` closed.
