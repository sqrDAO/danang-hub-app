# Booking field validation
**Phase**: — · **Deps**: partner-desk-auto-assign, coworking-monthly-hours-limit

## Goal
Tighten which booking fields a member may set, and have the Partner Desk sync bring back only the exact days it wrote. Server-owned marks and plan types then always come from an admin or the server.

## Files
- `firestore.rules` (edited) — member create: no `cancelledReason`, `rejectionReason`, `limitHoursLeft`, `limitMonth`, no `pd_` ids; owner update: `planType` locked
- `functions/partnerDesks.js` (edited) — `isReactivatable` requires the synced day's plan, member, desk and hours
- `test/firestore-booking-fields.rules.test.js` (new) — create and update field rules (emulator)
- `test/partnerDesks.test.js` (edited) — a non-matching doc at a day id is never reactivated

## Acceptance
- [ ] A member cannot create a booking carrying `cancelledReason`
- [ ] A member cannot create a booking carrying `rejectionReason`, `limitHoursLeft` or `limitMonth`
- [ ] A member cannot create a booking whose id starts with `pd_`
- [ ] An owner cannot change `planType` on an existing booking
- [ ] An owner can still cancel their own booking, including a desk plan day
- [ ] Admins can still create bookings at any id with any field
- [ ] The sync reactivates only a doc that is that member's synced day on that desk, at that day's hours
- [ ] A doc at a day id that fails that test is skipped, not reactivated and not overwritten
- [ ] NOT: no change to the admin booking rules
- [ ] NOT: no change to how the sync creates or cancels days

## Verify
- `npm test` → all pass, including "never reactivates a doc at a partner day id that is not that synced day"
- `npm run test:rules` → all pass, including `test/firestore-booking-fields.rules.test.js`
- `cd functions && npm run lint` → clean
- regression: `test/firestore-booking-cancel.rules.test.js`, `test/firestore-booking-renewal.rules.test.js`, `test/firestore-partner-desk.rules.test.js`
