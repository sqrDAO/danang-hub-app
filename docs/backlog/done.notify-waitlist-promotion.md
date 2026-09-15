# Notify members when they're promoted off an event waitlist
**Phase**: — · **Deps**: —

## Decision required
Two promotion code paths exist and both are silent today: `autoPromoteWaitlist`
(`functions/index.js:2469-2536`, a Cloud Functions trigger — can write notifications
directly) and `promoteFromWaitlist` (`src/services/events.js:436-461`, a client-side
`runTransaction` called by the admin UI — cannot write notifications directly, since
`firestore.rules:158` restricts `notifications` creation to the Admin SDK only). Pick one:

- **Option A (recommended)**: change `autoPromoteWaitlist`'s trigger logic to compute a
  `newlyPromoted` diff (uids present in `after.attendees` but not `before.attendees`,
  present in `before.waitlist`, **and absent from `after.waitlist`**) on *every*
  invocation, not just when `beforeAttendees > afterAttendees`. Since the trigger fires on
  any `events/{eventId}` write, this catches both the auto-promotion transaction's own
  write and the admin's manual `promoteFromWaitlist` write, with no changes needed to the
  client-side function. The `after.waitlist` exclusion is required, not optional: per
  `firestore.rules:112-121`, any authenticated member can write any uid into `attendees`
  via `registerForEvent` (rules check which *fields* changed, not which *uid*, or by
  whom) — a bare `attendees`-only write that names a uid still sitting in `waitlist`
  would otherwise satisfy the two-condition diff and fire a spoofed "you're promoted"
  notification at an arbitrary member. Requiring the uid to also have *left*
  `waitlist` in that same write restricts a match to the exact shape both real promotion
  paths produce (they always mutate `attendees` and `waitlist` together) and excludes
  every single-field client write.
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
  `notifyMemberPush` for each newly-promoted uid. Key the notification's `subjectId` as
  `${eventId}_${event.data.after.updateTime.toMillis()}` (the write's own commit time),
  not bare `eventId` — a member can leave an event and be re-waitlisted and re-promoted
  later, and a bare-`eventId` key would let the first promotion's notification doc
  silently suppress every later one for the same member/event pair. Use `_` as the
  separator, not `:` — `toSafeSubjectId` (`functions/index.js:740`) validates subject ids
  against `SAFE_DOC_ID_PART = /^[A-Za-z0-9_-]{1,128}$/`, which rejects `:`; a colon-joined
  id would silently fall back to the shared literal `"default"` for every promotion,
  collapsing dedup across all events and all members after the first one ever sent.
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
- [ ] A member promoted, later removed from the event, re-waitlisted, and promoted again
      receives a second notification for the second promotion — the dedup key does not
      collapse two distinct promotions of the same member into one.
- [ ] A member who opted out of push (`preferences.pushNotifications === false`) still
      gets the in-app notification but no push.
- [ ] A plain `registerForEvent` write — one that adds a uid to `attendees` without
      removing that same uid from `waitlist` in the same write — does not produce a
      waitlist-promotion notification for that uid.
- [ ] NOT: this does not change who gets auto-promoted or in what order — only adds the
      missing notification step to the existing promotion logic.
- [ ] NOT: this does not close the underlying `firestore.rules` gap that lets any
      authenticated member write any uid into `attendees`/`waitlist` — only stops that gap
      from being read as a promotion by this new notification logic.

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

## Notes
The `newlyPromoted` notify step must be wrapped in its own `try`/`catch`, separate from
the promotion transaction's. It runs *before* the `beforeAttendees <= afterAttendees`
early return (by design, so it also sees the admin's manual-promotion write); an
unhandled throw there — a transient Firestore error, not just the swallowed
`ALREADY_EXISTS` case — would otherwise abort the whole trigger invocation before the
real promotion transaction below ever runs, on the one code path (a member cancelling)
this function existed to serve in the first place.
