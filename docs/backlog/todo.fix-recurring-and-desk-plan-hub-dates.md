# Plan recurring bookings and fixed desk plans on the hub calendar
**Phase**: — · **Deps**: —

## Goal
`createFixedDeskPlan` and `createRecurringBooking` work out dates with `setHours`,
`setDate`, `setMonth` and `getDay`, which all use the browser's timezone, and they parse
`YYYY-MM-DD` date inputs as UTC midnight. So a plan created from outside
`Asia/Ho_Chi_Minh` lands on the wrong hours and days, and a recurrence's "until" date
drops its last day even in the hub zone.

Reproduced on `main`:
- Fixed desk plan from an `America/New_York` browser, start date `2026-10-05` (Mon):
  first booking is Sun 2026-10-04 20:00 hub time instead of Mon 09:00.
- Daily recurrence Mon 2026-10-05 09:00 hub, end date `2026-10-07`, in a hub-zone
  browser: 2 bookings (Oct 5–6). The end date parses as 07:00 hub on Oct 7, so the 09:00
  booking that day is cut off.
- Same recurrence from `America/New_York`: `getDay()` reads Mon 09:00 hub as Sunday, so
  a Mon–Fri `availableDays` filter skips Monday and admits Saturday.

## Files
- `src/utils/recurrence.js` (new) — pure planners, import `./timezone.js` with the
  extension so Node's test runner can load it:
  - `getFixedDeskPlanWindow({ startDate, period })` → `{ start, end }`. Start is 09:00 hub
    on `startDate` (`YYYY-MM-DD`). End is 18:00 hub on that week's Friday (`weekly`) or
    one calendar month minus a day later (`monthly`).
  - `planRecurrenceStarts({ start, frequency, endDate, occurrences, allowedWeekdays,
    isOpen })` → array of start `Date`s. Uses the hub weekday, steps daily/weekly by exact
    24h multiples (the hub has no DST), and steps monthly by hub calendar month at the
    same hub wall time. The end date is inclusive of its whole hub day. `occurrences`
    counts only allowed, open days (current behavior).
- `src/utils/timezone.js` (edited) — add `addHubMonths(date, months)`. Same hub wall
  time, day clamped to the target month's length (Jan 31 + 1 → Feb 28/29).
- `src/services/bookings.js` (edited) — `createFixedDeskPlan` uses
  `getFixedDeskPlanWindow`. `createRecurringBooking` iterates `planRecurrenceStarts`.
  Delete `advanceRecurrenceDate` and `isAllowedWeekday`.
- `test/recurrence.test.js` (new) — the three repros above plus month-end clamping, with
  `process.env.TZ = 'America/New_York'` set at the top like `test/timezone.test.js`.
- `test/timezone.test.js` (edited) — `addHubMonths` cases.

## Acceptance
- [ ] A weekly fixed desk plan starting `2026-10-05`, created from `America/New_York`,
      produces Mon–Fri 2026-10-05..09 bookings, each 09:00–18:00 hub time.
- [ ] A monthly fixed desk plan starting `2026-10-05` ends with the 2026-11-04 booking.
- [ ] A daily recurrence from Mon 2026-10-05 09:00 hub with end date `2026-10-07`
      creates 3 bookings (Oct 5, 6, 7) in both the hub zone and `America/New_York`.
- [ ] With `allowedWeekdays: [1,2,3,4,5]`, a Mon 09:00 hub start is kept and a Saturday
      is skipped, regardless of browser timezone.
- [ ] A monthly recurrence starting Jan 31 lands on Feb 28 (or 29), then Mar 31.
- [ ] Hub closures still skip a date without consuming an occurrence.
- [ ] NOT: changing the 09:00–18:00 desk hours, the Mon–Fri desk weekdays, the
      per-occurrence conflict check, or the booking doc shape (`planGroupId`,
      `recurrencePattern`).
- [ ] NOT: moving recurrence creation server-side or adding rules enforcement.

## Verify
- `npm test` → `test/recurrence.test.js` and `test/timezone.test.js` pass.
- `TZ=Pacific/Auckland npm test` → same result from a zone ahead of the hub.
- `npm run lint && npm run build` → clean, within the `src/**` complexity caps.
- Manual (`npm run dev`, browser timezone overridden to `America/New_York` in devtools):
  create a weekly fixed desk plan, and confirm the bookings list shows Mon–Fri 09:00–18:00.
- regression: in a hub-zone browser, a weekly recurring meeting-room booking with an end
  date includes the end date, and cancelling a fixed desk plan still cancels all its days.

## Notes
`new Date('YYYY-MM-DD')` is UTC midnight, which is 07:00 hub time. Always build hub
instants from date strings with ``parseHubDateTime(`${date}T09:00`)``. Never use
`new Date(dateString)` followed by `setHours`.
