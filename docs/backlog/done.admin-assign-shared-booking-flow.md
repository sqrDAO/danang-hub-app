# Reuse the member calendar for admin booking assignment
**Phase**: — · **Deps**: booking-range-picker, booking-calendar-availability-read

## Goal
Replace only the standard-booking date/time controls in Admin Assign Booking with the existing `BookingCalendar`. Preserve the legacy admin assignment behavior while making calendar prerequisites, stale selection handling, and the final conflict check explicit.

## Files
- `src/pages/admin/Bookings.jsx` (edited) — render the shared calendar after member and amenity selection, manage its range state, and keep admin assignment privileges.
- `src/services/functions.js` (edited) — expose a fail-closed conflict-check wrapper for this admin flow without changing the legacy member wrapper.
- `src/pages/admin/Bookings.css` (edited) — style Admin-only assignment error feedback.
- `src/locales/en.json` (edited) — add English instructions and conflict feedback.
- `src/locales/vi.json` (edited) — add matching Vietnamese copy.
- `docs/backlog/done.admin-assign-shared-booking-flow.md` (edited) — record the completed narrow scope.

## Acceptance
- [ ] Standard assignment has no free-form booking date, start-time, end-time, or duration controls.
- [ ] Standard assignment renders the existing `BookingCalendar` only after both receiving member and amenity are selected.
- [ ] The calendar supplies the selected start and end times used by the existing create-booking service.
- [ ] Changing the member, amenity, or booking type clears the selected calendar range.
- [ ] Closing or successfully submitting the modal clears all assignment state.
- [ ] The final admin conflict check throws on callable failure and prevents booking creation.
- [ ] A malformed conflict-check response prevents booking creation.
- [ ] A reported conflict prevents booking creation and gives visible feedback.
- [ ] A creation failure does not report itself as an availability-check failure.
- [ ] A valid admin assignment keeps the selected member as recipient and status `approved`.
- [ ] Standard assignment lists only amenities whose `isAvailable` is not `false`.
- [ ] Fixed-desk assignment keeps its legacy date/period flow and lists only available desk amenities.
- [ ] Assignment inputs cannot change while the submission is pending.
- [ ] NOT: Add or change Cloud Functions, Firestore rules, booking persistence, member booking, recurring booking, event booking, availability policy, or `BookingCalendar` behavior.
- [ ] NOT: Claim transaction-level protection against a conflict appearing between the final check and the existing write.

## Verify
- `npm run lint` → passes with no warnings.
- `npm run build` → production build succeeds.
- `npm test` → existing test suite passes unchanged.
- regression: select member + amenity, choose a calendar range, assign, and confirm the approved booking belongs to the selected member.
- regression: change member or amenity after choosing a range and confirm the range is cleared.
- regression: force the conflict callable to fail and confirm no booking is created.
- regression: verify member booking, recurring booking, fixed-desk creation, and event-linked booking behavior are unchanged.

## Notes
`checkBookingConflicts` intentionally fails open for legacy callers. Add a strict sibling for Admin Assign Booking; do not change the shared wrapper's behavior in this task.
