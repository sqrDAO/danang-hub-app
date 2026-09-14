# Notify members when they're promoted off an event waitlist
**Phase**: — · **Deps**: —

## Decision required
Two promotion code paths exist and both are silent today: `autoPromoteWaitlist`
(`functions/index.js:2469-2536`, a Cloud Functions trigger — can write notifications
directly) and `promoteFromWaitlist` (`src/services/events.js:436-461`, a client-side
`runTransaction` called by the admin UI — cannot write notifications directly, since
`firestore.rules:158` restricts `notifications` creation to the Admin SDK only). Pick one:

- **Option A (recommended)**: change `autoPromoteWaitlist`'s trigger logic to compute a
  `newlyPromoted` diff (attendees present in `after` but not `before`, and present in
  `before.waitlist`) on *every* invocation, not just when `beforeAttendees > afterAttendees`.
  Since the trigger fires on any `events/{eventId}` write, this catches both the
  auto-promotion transaction's own write and the admin's manual `promoteFromWaitlist`
  write, with no changes needed to the client-side function.
- **Option B**: convert `promoteFromWaitlist` into a Cloud Function callable (mirroring
  `reviewEvent`), so both promotion paths funnel through server code that can notify
  directly. Larger change — touches `src/services/functions.js` and every admin call site.

This spec is written for **Option A**.

## Goal
A member promoted from an event's waitlist to its attendee list — whether by the
auto-promotion trigger (someone else cancelled) or an admin's manual promotion — gets an
in-app notification (and push, per the existing pattern) telling them they now have a
confirmed spot.

## Files
- `functions/index.js` (edited) — in `autoPromoteWaitlist`, compute `newlyPromoted` from
  the trigger's `before`/`after` snapshots unconditionally (before the
  `beforeAttendees <= afterAttendees` early return, which stays in place to guard the
  *auto-repromotion* transaction only), and call `createNotificationIfAbsent` /
  `sendPushToMembers` for each newly-promoted uid, keyed to prevent duplicate sends across
  the function's at-least-once retry semantics.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — add the promoted-from-waitlist
  notification/push copy (both locales, same change).
- `src/components/NotificationBell.jsx` (edited) — render the new notification type.

## Acceptance
- [ ] A member auto-promoted from an event's waitlist (another attendee cancelled,
      capacity opened up) receives exactly one in-app notification.
- [ ] A member manually promoted by an admin via `promoteFromWaitlist` also receives
      exactly one in-app notification, with no change to `src/services/events.js`.
- [ ] The notification is not duplicated if the underlying Cloud Functions trigger fires
      more than once for the same document write (Cloud Functions triggers are
      at-least-once).
- [ ] A member who opted out of push (`preferences.pushNotifications === false`) still
      gets the in-app notification but no push.
- [ ] NOT: this does not change who gets auto-promoted or in what order — only adds the
      missing notification step to the existing promotion logic.

## Verify
- `npm run lint && cd functions && npm run lint` → both clean.
- `npm test` → existing tests pass.
- Emulator: create an event at capacity with one waitlisted member; cancel an attendee's
  registration → the waitlisted member's `notifications` collection gains exactly one new
  doc within the trigger's run.
- Emulator: as an admin, call `promoteFromWaitlist` directly on a waitlisted member →
  same one-notification outcome.
- regression: re-run `test/eventLifecycle.test.js` to confirm the existing
  auto-repromotion capacity/order logic is unchanged.
