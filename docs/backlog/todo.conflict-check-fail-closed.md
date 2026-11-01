# Fail the booking conflict check closed
**Phase**: — · **Deps**: —

## Goal
`checkBookingConflicts` is the only overlap check (`firestore.rules` has none), yet its
member wrapper and the recurring path turn any failure into "no conflict", so a failed
check books the slot anyway (issue #133). Make every caller fail closed, keep the
server's deliberate rejections distinguishable, and warm the function like #131 did.

## Files
- `functions/index.js` (edited) — `checkBookingConflicts` rejects a missing `amenityId` or
  invalid dates with `invalid-argument` before any Firestore read; its `catch` rethrows
  an `HttpsError` instead of rewriting it to `internal`.
- `src/services/functions.js` (edited) — one throwing `checkBookingConflicts` (the old
  `checkBookingConflictsStrict` body); add `warmBookingConflictCheck()`.
- `src/services/bookings.js` (edited) — `createRecurringBooking` checks every day before
  writing any; a day rejected with `invalid-argument` is skipped, any other error throws.
- `src/pages/member/Bookings.jsx` (edited) — warm the callable on mount; an
  `invalid-argument` rejection shows `toast.slotNoLongerAvailable`, other errors
  `memberBookings.conflictCheckFailed`.
- `src/pages/admin/Bookings.jsx`, `src/pages/admin/RenewalsPanel.jsx` (edited) — import
  the renamed wrapper.
- `CLAUDE.md`, `docs/knowledge/data-flow.md`, `src/components/BookingCalendar.jsx`
  (edited) — drop "returns no-conflict on error".

## Acceptance
- [ ] `src/services/functions.js` has no code path returning `hasConflicts: false` from a `catch`.
- [ ] A failed check on a single member booking shows "Could not verify availability" and creates no booking.
- [ ] A failed check on a recurring booking, fixed desk plan or renewal request creates no booking.
- [ ] A recurring day the server rejects with `invalid-argument` is skipped and the rest are booked.
- [ ] An "outside available days/hours" rejection reaches the client as `invalid-argument`.
- [ ] Opening /member/bookings sends one `checkBookingConflicts` request that is rejected with `invalid-argument`.
- [ ] That warm-up request writes no "Error checking booking conflicts" log line.
- [ ] In local dev mode (`LOCAL_DEV_MODE`) no warm-up request is sent.
- [ ] NOT: no change to how overlaps, hours or capacity are computed.
- [ ] NOT: no `minInstances`, no region change, no overlap check in `firestore.rules`.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `cd functions && npm run lint` → exit 0
- `npm run dev` against real Firebase, open /member/bookings, DevTools Network →
  `checkBookingConflicts` and `getAmenityBookingRanges` both answered 400 `invalid-argument`
- same page, DevTools offline, pick a slot, Continue → "Could not verify availability",
  stays on step 1; same for a weekly recurring booking at confirm → no booking created
- regression: a normal single booking, recurring booking and fixed desk plan still book;
  admin assign and renewal approval still work

## Notes
Checking every recurring day before writing any means a failed check leaves no half
series behind; a retry would otherwise see the member's own new days as taken (or, on
a shared desk, book them a second seat). Renewal approval (`isRenewalDayFree`) already
treats `invalid-argument` as a lost day; the server `catch` fix makes that true for
changed `availableDays`, not just closures.
