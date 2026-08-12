# Allow organizers to edit future events safely
**Phase**: implemented · **Deps**: Firestore emulator for rules verification

## Goal
Let organizers edit their own not-yet-started events while preserving the admin-review,
registration, notification, and Event Hall booking invariants. Pending edits stay pending;
approved or rejected edits become a revisioned pending resubmission.

## Files
- `firestore.rules` (edited) — route organizer content edits through the callable, allow attendee/waitlist writes only on approved events, and block deletion after any approval.
- `functions/eventLifecycle.js` (new) — pure edit validation, transition, revision, booking-window, and notification-ID helpers.
- `functions/index.js` (edited) — add authenticated `editOwnEvent` and admin `reviewEvent` callables; make review/status/participant notifications revision-aware.
- `functions/.eslintrc.js` (edited) — make Functions predeploy lint line-ending agnostic across Windows and CI checkouts.
- `src/services/functions.js` (edited) — callable wrappers that propagate edit/review failures.
- `src/services/events.js` (edited) — initialize revision metadata and retain generic event reads/admin content updates.
- `src/pages/member/Events.jsx` (edited) — shared create/edit form, future-event action guards, resubmit confirmation, and approved-only Upcoming data.
- `src/pages/member/Dashboard.jsx` (edited) — count/render approved upcoming events only.
- `src/pages/admin/Events.jsx` (edited) — revision context plus callable approve/reject with stale/conflict errors.
- `src/pages/admin/Events.css` (edited) — revision/resubmission metadata styling.
- `src/components/NotificationBell.jsx` (edited) — render and route participant `event_revision` notifications.
- `src/locales/en.json` (edited) — English edit, review, error, and notification copy.
- `src/locales/vi.json` (edited) — Vietnamese edit, review, error, and notification copy.
- `test/eventLifecycle.test.js` (new) — unit coverage for policy, normalization, revisions, booking windows, and dedupe IDs.
- `test/firestore-event-edit.rules.test.js` (new) — emulator coverage for organizer, registration-status, protected-field, and delete boundaries.
- `package.json` (edited) — add persistent Firestore rules-test tooling.
- `package-lock.json` (edited) — lock the rules-test dependency.
- `README.md` (edited) — document callables and event revision fields.
- `docs/knowledge/data-flow.md` (edited) — trace edit/resubmit/review, booking cleanup, notification, and rules flows.

## Acceptance
- [ ] An organizer can edit only their own event when both its stored start and proposed start are later than server time.
- [ ] Every organizer edit increments revision; editing a pending event leaves only its status unchanged and sends no duplicate review alert.
- [ ] Editing an approved or rejected event increments revision and changes status to pending.
- [ ] Organizer payloads cannot change identity, status directly, registrations, linked-booking fields, or review/server metadata.
- [ ] Capacity cannot be reduced below the retained attendee count.
- [ ] Approved-event resubmission retains attendees/waitlist, freezes their writes, cancels active `eventId` bookings, and clears linked-booking fields atomically.
- [ ] Admin approval verifies the expected revision; stale or conflicting review leaves the event pending.
- [ ] Approval creates at most one linked booking using event duration plus one-hour setup/teardown and commits it with event approval.
- [ ] Rejection cancels active linked bookings and commits rejection metadata with the event transition.
- [ ] Admin can still reject a future approved event; its booking is cancelled and retained participants are notified.
- [ ] Initial and resubmitted review alerts, organizer results, and participant revision alerts dedupe by event, revision, transition, and recipient.
- [ ] Previously approved pending events cannot be organizer-deleted; never-approved pending requests still can be.
- [ ] Member Upcoming/Dashboard and register/waitlist actions expose approved events only; own non-live records remain in My Event Requests.
- [ ] Future pending, approved, and rejected own-event cards expose localized edit/resubmit UX; started/past cards do not.
- [ ] Legacy events without revision fields behave as revision 1 without a backfill.
- [ ] Admin arbitrary content editing, approved-event registration, reminders, and waitlist promotion regressions remain working.
- [ ] NOT: do not implement an approved-revision draft/change-request collection.
- [ ] NOT: do not claim per-UID attendee-array enforcement or hard booking-overlap locking.
- [ ] NOT: no participant email/push or replaced-banner garbage collection.

## Verify
- `npm run lint` → zero warnings/errors.
- `npm run build` → production build succeeds.
- `npm test` → lifecycle unit tests and existing tests pass.
- `cd functions && npm run lint` → Cloud Functions lint passes.
- `firebase emulators:exec --only firestore "node --test test/firestore-event-edit.rules.test.js"` → organizer edit is denied directly; approved-only registration and `everApproved` delete cases pass.
- `firebase emulators:start` → organizer/member/admin matrix in `plan.organizer-event-edit.md` passes, including linked booking cancellation/recreation, conflict/stale review, notification dedupe, and legacy event behavior.
- regression: public/member/admin event lists, approved registration/unregistration, reminders, and auto waitlist promotion still work.

## Notes
`plan.organizer-event-edit.md` is temporary implementation guidance and is deleted manually after acceptance. Booking conflict detection remains advisory for concurrent competing writes; this PR prevents event/own-booking partial writes but does not add a global slot lock.
