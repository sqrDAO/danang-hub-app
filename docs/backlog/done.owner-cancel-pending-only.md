# Owners cancel only pending bookings, except desk-plan days
**Phase**: — · **Deps**: —

## Goal
Policy: once a booking is approved, the member can't cancel it, and its hours count toward the 40h monthly desk limit (#150). `firestore.rules` lets an owner set `cancelled` from any status, so a direct Firestore write can cancel an approved single booking and win the hours back; restrict owner cancels to `pending`, keeping the desk-plan cancels the app already offers. The same rule also lets an owner delete `status`, which takes the booking out of the limit count the same way; close that too.

## Files
- `firestore.rules` (edited) — the owner update rule allows `cancelled` only from `pending`, or from `approved` on a `fixed-desk` / `partner-desk` day, and requires `status` to stay present
- `test/firestore-booking-cancel.rules.test.js` (edited) — the existing owner-cancel cases seed `pending`; new cases below
- `docs/knowledge/data-flow.md` (edited) — the `bookings` rules row

## Acceptance
- [ ] An owner can cancel their own `pending` booking
- [ ] An owner cannot cancel their own `approved` single booking
- [ ] An owner cannot cancel their own `checked-in` booking
- [ ] An owner cannot cancel their own `completed` booking
- [ ] An owner can cancel an `approved` day of their own `fixed-desk` plan (Cancel Plan)
- [ ] An owner can cancel their own `approved` `partner-desk` day (Cancel day)
- [ ] An owner cannot cancel a `checked-in` `fixed-desk` day
- [ ] An owner cannot cancel an `approved` single booking that carries a `planGroupId` but no desk `planType`
- [ ] An owner can still update `updatedAt` alone without changing status
- [ ] An owner cannot remove `status` from their own `approved` booking
- [ ] An admin can cancel an `approved` booking
- [ ] NOT: a cancel button for approved single bookings in the member UI
- [ ] NOT: changes to `cancelFixedDeskPlan`, renewals, or the monthly-hours count

## Verify
- `npm run test:rules` → green, including the new cases in `test/firestore-booking-cancel.rules.test.js`
- `npm run lint && npm run build && npm test` → green
- regression: `test/firestore-booking-fields.rules.test.js`, `test/firestore-partner-desk.rules.test.js`, `test/firestore-booking-renewal.rules.test.js` stay green
- post-deploy (human): Bookings page → Cancel on a pending booking works; Cancel Plan on a Fixed Desk plan with approved days works; Cancel day on an approved Partner Desk day works

## Notes
- The exception keys on `planType`, not `planGroupId`. The create rule accepts any well-formed `planGroupId` on a single booking, so a `planGroupId` exception would reopen the bypass. Owners can't change `planType` after create, members can't create `partner-desk` days, and `fixed-desk` days always go to an admin.
- Both desk-plan types sit outside the 40h limit (`DESK_PLAN_TYPES` in `src/utils/monthlyHours.js` and `functions/monthlyHours.js`), so allowing their approved days to be cancelled gives no hours back.
- `cancelFixedDeskPlan` cancels `pending` and `approved` days only (`src/services/bookings.js`). `renewFixedDeskPlan` only creates days; renewal approve/reject are admin writes.
- Owner delete stays `pending`-only, unchanged.
- `request.resource.data` is the document after the write, so the old `!('status' in request.resource.data)` branch matched only a write that deleted `status`. The limit counts by status (`COUNTED_STATUSES` in `functions/monthlyHours.js`), so a status-less booking counted zero hours. Every booking is written with a status, so requiring it breaks no app path.
