# Booking field validation
**Phase**: — · **Deps**: partner-desk-auto-assign, coworking-monthly-hours-limit

## Goal
Tighten which booking fields a member may set, and have the Partner Desk sync bring back only the exact days it wrote. Server-owned marks and plan types then always come from an admin or the server.

## Files
- `firestore.rules` (edited) — member create refuses server and admin fields, `pd_` ids and `partner_` plan groups; owner update allows only `status` and `updatedAt`
- `functions/partnerDesks.js` (edited) — reactivates only the member's own synced day on that desk; reports ids held by other docs as `blocked`
- `functions/index.js` (edited) — a reactivated day is rewritten as planned; blocked ids are logged and counted
- `test/firestore-booking-fields.rules.test.js` (new) — create and update field rules (emulator)
- `test/partnerDesks.test.js` (edited) — blocked and rewritten reactivation cases

## Acceptance
- [ ] A member cannot create a booking carrying `cancelledReason`
- [ ] A member cannot create a booking carrying `rejectionReason`
- [ ] A member cannot create a booking carrying `limitHoursLeft`
- [ ] A member cannot create a booking carrying `limitMonth`
- [ ] A member cannot create a booking carrying `partnerId`
- [ ] A member cannot create a booking carrying `checkInTime` or `checkOutTime`
- [ ] A member cannot create a booking whose id starts with `pd_`
- [ ] A member cannot create a booking whose `planGroupId` starts with `partner_`
- [ ] A member can still create a Fixed Desk day in their own plan group
- [ ] An owner update may change only `status` and `updatedAt`
- [ ] An owner can still cancel their own booking, including a desk plan day
- [ ] Admins can still create bookings at any id with any field
- [ ] The sync reactivates a cancelled day only when it is that member's synced day on that desk
- [ ] A reactivated day is rewritten with the planned hours and partner
- [ ] A doc at a day id that is not that synced day is left untouched
- [ ] Such day ids are logged and counted as `blocked` in the sync log
- [ ] NOT: no change to the admin booking rules
- [ ] NOT: no change to how the sync creates or cancels days

## Verify
- `npm test` → all pass, including "never reactivates a doc at a partner day id that is not that synced day" and "a reactivated day is rewritten with the planned hours and partner"
- `npm run test:rules` → all pass, including `test/firestore-booking-fields.rules.test.js`
- `cd functions && npm run lint` → clean
- regression: `test/firestore-booking-cancel.rules.test.js`, `test/firestore-booking-renewal.rules.test.js`, `test/firestore-partner-desk.rules.test.js`
