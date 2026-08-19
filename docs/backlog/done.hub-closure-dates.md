# Hub closure dates block bookings and events
**Phase**: — · **Deps**: —

## Goal
The Hub is closed 31 Aug – 2 Sep 2026 for Vietnam's Independence Day, but nothing in the app models a full-day closure — availability is weekday + hour only. Add a declarative closure list that blocks new bookings and events on closed days and surfaces already-booked ones to admins.

## Files
- `src/utils/hubClosures.js` (new) — `HUB_CLOSURES` list plus `getHubClosure`/`isHubClosed`/`getUpcomingHubClosures`/`rangeOverlapsClosure`, all on hub calendar days.
- `functions/hubClosures.js` (new) — CommonJS mirror of the same list for server-side checks.
- `functions/index.js` (edited) — `checkBookingConflicts` rejects and `checkSlotAvailability` refuses closed days.
- `functions/eventLifecycle.js` (edited) — `getEventSpaceValidationError` rejects closed days.
- `src/components/BookingCalendar.jsx`, `src/components/BookingCalendar.css` (edited) — closed days are unselectable in the week grid and the mobile date carousel, and labelled as closed.
- `src/components/HubClosureNotice.jsx`, `src/components/HubClosureNotice.css` (new) — shared banner listing upcoming closures.
- `src/services/bookings.js` (edited) — recurring bookings and fixed desk plans skip closed days.
- `src/services/amenities.js` (edited) — `validateEventSpaceTime` returns a closure error key; hour checks extracted to helpers to stay under the complexity cap.
- `src/pages/member/Bookings.jsx` (edited) — closure notice banner above the amenity list.
- `src/pages/admin/Bookings.jsx`, `src/pages/admin/Bookings.css` (edited) — closure banner + per-row badge on bookings that fall in a closure.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — closure strings in both locales.
- `test/hubClosures.test.js` (new) — boundary coverage for the closure helpers.
- `README.md` (edited) — one feature-list line for hub closures.

## Acceptance
- [ ] `HUB_CLOSURES` contains `2026-08-31` → `2026-09-02` labelled as Independence Day, inclusive of both endpoints.
- [ ] The week calendar renders 31 Aug, 1 Sep and 2 Sep 2026 with every cell unavailable and unclickable.
- [ ] The mobile date carousel disables those three dates.
- [ ] `checkBookingConflicts` throws `invalid-argument` for a start time on a closed day.
- [ ] `checkSlotAvailability` returns `available: false` with a closure reason for a closed day.
- [ ] `createFixedDeskPlan` spanning 31 Aug creates no booking for 31 Aug, 1 Sep or 2 Sep.
- [ ] Skipping a closed day does not consume a recurring booking's occurrence count.
- [ ] `getEventSpaceValidationError` rejects an event starting on a closed day.
- [ ] The member bookings page shows the upcoming closure with its date range.
- [ ] The admin bookings page badges existing bookings that fall inside a closure.
- [ ] Both `en.json` and `vi.json` carry every new key.
- [ ] A test fails if `src/utils/hubClosures.js` and `functions/hubClosures.js` disagree.
- [ ] NOT: no existing booking is cancelled, deleted, or mutated by this change.
- [ ] NOT: no new Firestore collection, security rule, or admin CRUD screen.

## Verify
- `npm run lint` → passes with zero warnings.
- `npm run build` → succeeds.
- `cd functions && npm run lint` → passes.
- `npm test` → all tests pass, including `test/hubClosures.test.js`. `test/firestore-event-edit.rules.test.js` fails without the Firestore emulator, on this branch and on `main` alike.
- `npm run dev` → open a desk amenity's booking calendar, navigate to the week of 31 Aug 2026: the three days are greyed out and unclickable; 3 Sep is bookable.
- regression: book a normal weekday slot end-to-end; create a weekly recurring booking crossing the closure; confirm a Saturday is still unavailable for office amenities.

## Notes
- The closure list is pinned in two places (`src/utils/hubClosures.js` and `functions/hubClosures.js`) for the same reason `REGION` is — the client is ESM, functions are CommonJS. They must be edited together.
- Server checks stay advisory, matching `checkBookingConflicts`: `firestore.rules` is not changed, so the calendar remains the primary guard.
- Closed-day skipping in `createRecurringBooking` mirrors the existing `isAllowedWeekday` skip, which advances the date without incrementing `count`.
