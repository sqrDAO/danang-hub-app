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
- [ ] A booking starting at 2026-09-15 12:00 Asia/Ho_Chi_Minh can be checked in at
      2026-09-15 08:00 hub time from an `America/New_York` browser, where the two
      instants fall on different local days (Sep 14 21:00 vs Sep 15 01:00) but the same
      hub day.
- [ ] NOT: this does not change the check-in/check-out status transitions themselves or
      any rules-level enforcement — both remain admin-only client-side guards, per
      CLAUDE.md's "all other transitions are admin or scheduler."

## Verify
- `npm run lint` → clean.
- `npm test` → existing `test/timezone.test.js` continues to pass.
- `TZ=America/New_York node --input-type=module -e "import {isSameHubDay} from './src/utils/timezone.js'; const b=new Date('2026-09-15T12:00:00+07:00'), n=new Date('2026-09-15T08:00:00+07:00'); console.log(b.toDateString()===n.toDateString(), isSameHubDay(b,n))"`
  → `false true`.
- Manual (dev server, browser devtools clock/timezone override): set the browser
  timezone to `America/New_York`, create a booking for "today" in hub time, and confirm
  check-in succeeds even when it's still the previous calendar day in the browser's local
  timezone.
