# Limit coworking desk bookings to 40 hours per month
**Phase**: — · **Deps**: —

## Goal
Each member may book at most 40 hours of ordinary desk time per calendar month, hub time (issue #112). The limit has to hold even though members write bookings straight to Firestore, so the server enforces it, and the booking UI shows what is left and blocks a booking that would go over.

## Files
- `functions/monthlyHours.js` (new) — pure: which bookings count, hours per hub month, check against the limit
- `functions/index.js` (edited) — `autoApproveDeskBooking` cancels an over-limit member booking (`monthly-hours-limit`) before the capacity check; cancellation push copy
- `functions/bookingNotifications.js` (edited) — notice carries `limitHoursLeft`
- `firestore.rules` (edited) — owners cannot change `startTime`, `endTime`, `amenityId`, `memberId` or `limitHoursLeft` on an existing booking
- `src/utils/monthlyHours.js` (new) — client mirror, plus the first month a new booking or series would go over
- `src/services/bookings.js` (edited) — `planRecurringRanges`, the occurrences a series would create, shared with `createRecurringBooking`
- `src/pages/member/Bookings.jsx` (edited) — hours used this month, block over-limit single and recurring bookings before submit
- `src/components/NotificationBell.jsx` (edited) — over-limit cancellation copy
- `src/locales/en.json`, `src/locales/vi.json` (edited) — limit strings
- `test/monthlyHours.test.js` (new) — client and server helpers, parity
- `test/firestore-booking-cancel.rules.test.js` (edited) — locked fields
- `README.md` (edited) — feature line, `autoApproveDeskBooking` row

## Acceptance
- [ ] Counted: bookings on `desk` amenities with no desk `planType`, status pending, approved, checked-in or completed
- [ ] NOT counted: Fixed Desk and Partner Desk days, cancelled bookings, non-desk amenities
- [ ] Hours are split by hub calendar month (Asia/Ho_Chi_Minh)
- [ ] A member-created booking that would take the month over 40h is cancelled server-side with `cancelledReason: 'monthly-hours-limit'` and `limitHoursLeft`
- [ ] The member gets one notification naming the month and how many hours were left in it
- [ ] Of two bookings written at nearly the same moment, only the later one is judged against the other (Firestore create time)
- [ ] A failing limit check fails open: the booking still gets auto-approval or an admin review notice
- [ ] A `fixed-desk` booking must have a `planGroupId` (rules)
- [ ] Admins' own bookings and bookings an admin creates for a member are not limited
- [ ] Admin-created bookings still count toward the member's hours
- [ ] The booking page shows hours used this month out of 40
- [ ] Confirming a single booking that would go over is blocked with the hours left, before anything is written
- [ ] Confirming a recurring series that would go over in any month is blocked, naming that month
- [ ] Owners cannot change a booking's times, desk or member after creation (rules); they can still cancel
- [ ] NOT: no rollover, no partial fit, no paid overage, no per-member allowance setting
- [ ] NOT: no new Cloud Function exports, no composite index

## Verify
- `npm run lint && npm run build` → green; `cd functions && npm run lint` → green
- `npm test` → green, including `test/monthlyHours.test.js`
- `firebase emulators:exec --only firestore "node --test test/firestore-booking-cancel.rules.test.js"` → all pass
- regression: single desk booking auto-approval, Fixed Desk plan registration, Partner Desk sync, member cancel

## Notes
- The client check is a courtesy; the trigger is the guard. There is no transaction: two bookings created together are ordered by create time, so the earlier one keeps its hours. If the client's cached bookings are stale, the member may briefly see "booking created" before the cancellation notice.
- The trigger reads only the booking's month(s), plus a day before, with `memberId ==` + `startTime` range + `orderBy startTime desc`: the member bookings page query, served by the existing `memberId`+`startTime` DESC index.
- Desk plans stay outside the limit. A member can still create a fake one-day "plan", but desk plans never auto-approve, so an admin sees it.
