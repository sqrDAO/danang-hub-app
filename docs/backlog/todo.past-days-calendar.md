# Booking calendar: open on the next open day and mark past days
**Phase**: — · **Deps**: — · **Issue**: #315

## Goal
Late on Friday the booking calendar opens on a week with nothing left to book, and
past slots look the same as closed ones. The calendar should open on the first day
that still has a slot, and past slots and days should read as "past".

## Files
- `docs/backlog/todo.past-days-calendar.md` (new) — this spec.
- `src/utils/bookingRange.js` (edited) — `past` wins in `getBaseSlotStatus`; new `getFirstOpenDay`.
- `src/components/BookingCalendar.jsx` (edited) — initial date from `getFirstOpenDay`; plain header for past days.
- `src/components/BookingCalendar.css` (edited) — grey 45° hatch for `.time-slot.past`.
- `src/styles/globals.css` (edited) — `--color-past-hatch` / `--color-past-border`, dark and light.
- `test/bookingRange.test.js` (edited) — cases for both helpers.

## Acceptance
- [ ] A slot whose start is before now has status `past`, even on a closed day.
- [ ] A slot whose start is before now has status `past`, even outside opening hours.
- [ ] With no `selectedDate`, the calendar opens on the first day from today whose last slot has not started.
- [ ] After the week's last slot has started, the week view opens on the next week.
- [ ] A passed `selectedDate` still decides the opening date.
- [ ] `.time-slot.past` is a 45° hatch in the grey `--color-past-hatch` token.
- [ ] Future closed-day and outside-hours slots stay flat grey (`.unavailable`).
- [ ] Future holiday slots stay red-hatched (`.hub-closed`) with the header label.
- [ ] A day before today has a plain header: no closure label, no `closed-day`, no `unavailable-day`.
- [ ] The mobile time header shows no closure line for a day before today.
- [ ] NOT: the Today button still jumps to today.
- [ ] NOT: no change to booking rules, conflict checks or Cloud Functions.

## Verify
- `npm test` → pass, including the new `bookingRange` cases.
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → book an office amenity: past slots grey-hatched, future
  weekend flat grey, available slots unchanged; both themes; desktop grid and mobile list.
- regression: admin Assign booking calendar opens and selects a range as before.

## Notes
- `getFirstOpenDay` takes a day lookup instead of importing `getDayAvailability`:
  `src/services/amenities.js` imports Firebase, which `node --test` cannot load.
- The initial date is a `useState` initializer, so it is picked once at mount.
