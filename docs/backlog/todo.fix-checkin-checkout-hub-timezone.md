# Compare check-in/check-out dates in hub time, not browser-local time
**Phase**: — · **Deps**: —

## Goal
`checkIn`/`checkOut` decide "is this the same day as the booking" using
`Date.prototype.toDateString()`, which renders in the browser's local timezone — an admin
operating from a non-`Asia/Ho_Chi_Minh` browser near the hub-day boundary can have a valid
same-day check-in/out incorrectly rejected, or the wrong calendar day's booking incorrectly
allowed.

## Files
- `src/services/bookings.js` (edited) — replace both
  `bookingDate.toDateString() !== today.toDateString()` comparisons (in `checkIn`, line
  225, and `checkOut`, line 241) with `!isSameHubDay(bookingDate, today)`, importing
  `isSameHubDay` from `src/utils/timezone.js`.

## Acceptance
- [ ] `checkIn` and `checkOut` both use `isSameHubDay` from `src/utils/timezone.js`
      instead of `Date.prototype.toDateString()`.
- [ ] A booking starting at 2026-09-15 00:30 Asia/Ho_Chi_Minh (hub day 2026-09-15) can be
      checked in when the server/client instant is 2026-09-14 17:30 UTC — still
      2026-09-14 in UTC and in any browser running US/European local time, but already
      2026-09-15 on the hub calendar.
- [ ] NOT: this does not change the check-in/check-out status transitions themselves or
      any rules-level enforcement — both remain admin-only client-side guards, per
      CLAUDE.md's "all other transitions are admin or scheduler."

## Verify
- `npm run lint` → clean.
- `npm test` → existing `test/timezone.test.js` continues to pass.
- Manual (dev server, browser devtools clock/timezone override): set the browser
  timezone to `America/New_York`, create a booking for "today" in hub time, and confirm
  check-in succeeds even when it's still the previous calendar day in the browser's local
  timezone.
