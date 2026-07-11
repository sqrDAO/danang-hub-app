# Auto-approve desk bookings when capacity allows
**Phase**: — · **Deps**: —

## Goal
Regular (non-Fixed-Desk) desk bookings currently sit `pending` until an admin approves them, even when the desk has open capacity for that slot. Auto-approve them server-side at creation time when there's room, so members only wait on a human when the desk is actually contended. Fixed Desk plans and all other amenity types (meeting-room, podcast-room, event-space) keep today's manual-approval behavior.

## Files
- `functions/index.js` (edited) — extract the overlap/capacity math shared by `checkBookingConflicts` and `checkSlotAvailability` into a helper (`computeBookingAvailability` or similar); add a new `onDocumentCreated("bookings/{bookingId}")` trigger that, for a freshly-created `status: 'pending'` booking whose amenity `type === 'desk'` and `planType !== 'fixed-desk'`, re-checks capacity against existing `pending/approved/checked-in` bookings (excluding itself) and updates the doc to `status: 'approved'` when the overlap count is below the amenity's capacity
- `firestore.rules` (edited) — restrict non-admin `create` on `bookings` to `status == 'pending'` (or absent), closing the existing gap where a member could set any status on create; admin create is unaffected

## Acceptance
- [ ] A new desk booking (not part of a fixed-desk plan) with capacity remaining at that time slot is created as `pending` and then flipped to `approved` by the new trigger
- [ ] A new desk booking that would exceed the desk's `capacity` for that time slot stays `pending` for manual admin review
- [ ] Fixed Desk plan occurrences (`planType === 'fixed-desk'`) are untouched by the new trigger and keep requiring admin approval (unless `createdByAdmin`, which already sets `approved` directly)
- [ ] Bookings for `meeting-room`, `podcast-room`, and `event-space` are untouched by the new trigger and keep requiring admin approval
- [ ] A non-admin can no longer create a booking doc with `status` other than `pending`
- [ ] NOT: no change to `checkBookingConflicts`/`checkSlotAvailability` external behavior or return shape
- [ ] NOT: no change to admin-assigned booking flow (`createdByAdmin` / admin `create`)

## Verify
- `cd functions && npm run lint` → green
- `npm run lint && npm run build` → green
- `firebase emulators:start` (or dev + manual Firestore write): create a desk booking as a member with the desk free → doc status becomes `approved` within the trigger's run
- Create two overlapping desk bookings on a capacity-1 desk → second stays `pending`, visible in admin pending queue
- Create a Fixed Desk plan occurrence as a member → stays `pending` as before
- Create a meeting-room booking → stays `pending` as before
- regression: admin approve/reject flow (`src/pages/admin/Bookings.jsx`) still works for whatever remains `pending`
