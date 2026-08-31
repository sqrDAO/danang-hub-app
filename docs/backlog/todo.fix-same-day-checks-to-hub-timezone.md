# Fix same-day checks to use Hub timezone, not browser-local
**Phase**: — · **Deps**: —

## Goal
Three call sites compare "is this booking today" using `Date.prototype.toDateString()` or
a browser-local midnight, instead of the codebase's own Asia/Ho_Chi_Minh helpers. Any
device whose clock/timezone differs from Vietnam gets wrong same-day results for hours
around the Vietnam day boundary — Check In/Check Out gating, the admin "hide past
bookings" filter, and a member's own Upcoming/Dashboard split are all affected.

## Files
- `src/services/bookings.js` (edited) — `checkIn`/`checkOut` (currently lines 218-248) and
  the helper at line 305: replace `bookingDate.toDateString() !== today.toDateString()`
  with `!isSameHubDay(bookingDate, new Date())` from `src/utils/timezone.js`.
- `src/pages/admin/Bookings.jsx` (edited) — `getTodayStart` (currently lines 58-62) and
  `isSameDayAsBooking` (currently lines 79-84): use `getHubStartOfDay`/`isSameHubDay` from
  `src/utils/timezone.js` instead of local `setHours(0,0,0,0)` / `toDateString()`.
- `src/pages/member/Dashboard.jsx` (edited) — `getTodayStart` (currently lines 31-36): same
  swap to the shared hub-timezone helper.

## Acceptance
- [ ] `checkIn`/`checkOut` compare booking date to "today" using hub-day equality, not the browser's local calendar day.
- [ ] The admin Bookings "hide past bookings" default filter and Check In/Check Out button gating use the same hub-day comparison.
- [ ] The member Dashboard's upcoming-vs-past booking split uses the same hub-day comparison.
- [ ] A booking starting at 00:30 Asia/Ho_Chi_Minh time is treated as "today" by all three call sites regardless of the testing device's local timezone.
- [ ] NOT: does not change `src/pages/admin/Dashboard.jsx`'s existing correct hub-timezone computation (used as the reference implementation here).

## Verify
- `npm run lint && npm run build` → green.
- `npm test` → green (add/extend a `test/timezone.test.js` case if the shared helper doesn't already cover a same-day comparison at the day boundary).
- Manually verify with the OS/browser timezone set to `America/Los_Angeles` (13-14h behind Vietnam): a booking starting at 08:00 Vietnam time today shows as checkable-in and appears in "Upcoming"/not hidden as past, both immediately before and after Vietnam midnight.
- regression: existing Check In/Check Out flow and admin booking list filtering behave unchanged when the testing device's timezone is already Asia/Ho_Chi_Minh.

## Notes
`src/utils/timezone.js` already exports `isSameHubDay`/`getHubStartOfDay` (or equivalent —
confirm exact names before wiring in) for exactly this purpose; `src/pages/admin/Dashboard.jsx:268-269`
is a working reference for the `Intl`/`toLocaleDateString` pattern if the named helpers
need extending to cover these three call sites' exact needs.
