# Migrate amenity docs still opening at 8 AM to 9 AM
**Phase**: — · **Deps**: —

## Goal
Desk/seat booking still shows 8am–6pm because commit `1b276d5` (Jun 10) changed code defaults to 9am and migrated `bookings`, but never migrated the `amenities` collection — and stored `startHour` overrides the code default in both `BookingCalendar.jsx` and `checkBookingConflicts` (`functions/index.js`). Add a dry-run/apply migration that sets `startHour: 9` on amenity docs still storing an earlier hour.

## Files
- `functions/migrate-amenities-hours.js` (new) — dry-run/apply script; sets `startHour` to 9 on amenities with `startHour < 9`
- `functions/.eslintignore` (edited) — exclude the new migration script, same as the bookings one

## Acceptance
- [ ] Dry run lists each affected amenity (id, name, type, old → new startHour) without writing
- [ ] `--apply` updates only `startHour` and `updatedAt` on affected docs
- [ ] Event-space docs are included only if their stored `startHour` is below 9 (weekend open is 9; weekday 6 PM rule lives in code, not this field)
- [ ] Script uses firebase-admin modular imports (`firebase-admin/app`, `firebase-admin/firestore`) — legacy `admin.firestore()` throws on installed v14
- [ ] NOT: no changes to `endHour`, `availableDays`, `slotDuration`, or any client/functions runtime code

## Verify
- `cd functions && node migrate-amenities-hours.js` → dry-run report of amenities with `startHour < 9`, no writes
- `cd functions && node migrate-amenities-hours.js --apply` → affected docs updated; re-run dry-run reports nothing to do
- Booking calendar for a desk now renders slots from 09:00 (verify in `npm run dev`)
- `npm run lint && npm run build` → green; `cd functions && npm run lint` → green
