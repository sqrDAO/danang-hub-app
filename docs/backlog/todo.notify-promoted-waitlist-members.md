# Notify members promoted off an event waitlist
**Phase**: — · **Deps**: —

## Goal
Neither `autoPromoteWaitlist` (automatic, on a spot opening) nor `promoteFromWaitlist`
(admin-triggered manual promotion) tells the promoted member anything — they become a
confirmed attendee with zero in-app notification, push, or email. Add a notification on
both paths.

## Files
- `functions/index.js` (edited) — `autoPromoteWaitlist` (currently lines 2470-2529): after
  the transaction commits, call `createNotificationIfAbsent` for each promoted member id
  with a new `waitlist_promoted` type, keyed by event id + revision + member id so a
  re-run of the trigger doesn't double-notify; send push via the existing
  `sendPushToMembers` helper alongside it, matching the pattern `deliverReminderSegment`
  already uses.
- `src/services/events.js` (edited) — `promoteFromWaitlist` (currently lines 436-470): since
  this is a client-initiated transaction, it cannot itself write a function-authored
  notification (rules restrict `notifications` writes to functions). Instead, after the
  transaction resolves with `promoted > 0`, call a new small callable (or extend an
  existing one) that fans out the same `waitlist_promoted` notification for the returned
  member ids — do not duplicate the notification-authoring logic in client code.
- `src/components/NotificationBell.jsx` (edited) — render the new `waitlist_promoted`
  notification type (title/body from `notifications.waitlistPromoted*` keys).
- `src/locales/en.json`, `src/locales/vi.json` (edited) — add the new notification copy
  keys in both locales.

## Acceptance
- [ ] A member auto-promoted off a waitlist (another attendee cancels, freeing a spot) receives an in-app notification and a push message within the same trigger run.
- [ ] A member manually promoted by an admin via `/admin/events` receives the same notification.
- [ ] Re-running the same promotion event (trigger re-delivery, or an admin retrying a failed promote) does not create a duplicate notification for an already-notified member.
- [ ] Both `en.json` and `vi.json` contain the new notification copy keys.
- [ ] NOT: does not change promotion order, capacity math, or the existing transactional read-then-write shape of either promotion path.

## Verify
- `npm run lint && npm run build` → green.
- `cd functions && npm run lint` → green.
- `firebase emulators:start`: register an event to capacity plus one waitlisted member, cancel an attendee's booking, confirm the waitlisted member's `notifications` collection gets a new `waitlist_promoted` doc and `NotificationBell` renders it.
- Repeat via the admin manual "Promote from waitlist" action in `/admin/events` and confirm the same notification appears for the promoted member.
- regression: `test/eventLifecycle.test.js` and `npm test` still pass.

## Notes
`createNotificationIfAbsent` (`functions/index.js:757-775`) already gives idempotent
per-subject-id notification creation via `.create()` + swallowed `ALREADY_EXISTS` — reuse
it rather than adding a new dedup mechanism.
