# Notify members when they're promoted off an event waitlist
**Phase**: — · **Deps**: —

## Goal
A member promoted from an event's waitlist to its attendee list — by the auto-promotion
trigger (someone else cancelled) or an admin's manual promotion — gets an in-app
notification (and push, per the existing pattern) saying they now have a confirmed spot.

## Files
- `functions/index.js` (edited) — in `autoPromoteWaitlist`, compute `newlyPromoted` from
  the trigger's `before`/`after` snapshots unconditionally (before the
  `beforeAttendees <= afterAttendees` early return, which stays to guard the
  *auto-repromotion* transaction only), then `createNotificationIfAbsent` /
  `notifyMemberPush` per uid. A uid counts as promoted only if it entered `attendees`
  **and** left `waitlist` in the same write: `firestore.rules` restricts a member write by
  which *fields* it touches, not which uid or by whom, so a bare `attendees`-only
  `registerForEvent` write naming a still-waitlisted uid would otherwise fire a spoofed
  "you're promoted" notification at an arbitrary member.
  `subjectId` is `${eventId}_${after.updateTime.toMillis()}` (the write's own commit time),
  not bare `eventId`: a member can be re-waitlisted and re-promoted, and a bare key would
  let the first promotion's doc suppress every later one. The separator must be `_`, not
  `:` — `toSafeSubjectId` validates against `/^[A-Za-z0-9_-]{1,128}$/`, so a colon-joined
  id falls back to the literal `"default"` and collapses dedup across all events/members.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — add the promoted-from-waitlist
  notification/push copy (both locales, same change).
- `src/components/NotificationBell.jsx` (edited) — render the new notification type.

## Acceptance
- [x] A member auto-promoted from an event's waitlist (another attendee cancelled,
      capacity opened up) receives exactly one in-app notification.
- [x] A member manually promoted by an admin via `promoteFromWaitlist` also receives
      exactly one in-app notification, with no change to `src/services/events.js`.
- [x] The notification is not duplicated if the underlying Cloud Functions trigger fires
      more than once for the same document write (Cloud Functions triggers are
      at-least-once).
- [x] A member promoted, later removed from the event, re-waitlisted, and promoted again
      receives a second notification for the second promotion — the dedup key does not
      collapse two distinct promotions of the same member into one.
- [x] A member who opted out of push (`preferences.pushNotifications === false`) still
      gets the in-app notification but no push.
- [x] A plain `registerForEvent` write — one that adds a uid to `attendees` without
      removing that same uid from `waitlist` in the same write — does not produce a
      waitlist-promotion notification for that uid.
- [x] NOT: this does not change who gets auto-promoted or in what order — only adds the
      missing notification step to the existing promotion logic.
- [x] NOT: this does not close the underlying `firestore.rules` gap that lets any
      authenticated member write any uid into `attendees`/`waitlist` — only stops that gap
      from being read as a promotion by this new notification logic.

## Verify
- [x] `npm run lint` → clean. `cd functions && npm run lint` → clean.
- [x] `npm run build` → vite production build succeeds, 43 precache entries.
- [x] `npm test` → 108 pass, 2 skipped (Firestore rules tests).
- [x] Emulator (`firebase emulators:exec --project demo-waitlist-promo --only
      firestore,functions`) — 8/8 checks passed: attendee cancels on a capacity-1 event →
      one doc `waitlist_promoted_member-waitlisted_evt-auto_1789527701781` (the trigger
      fires twice in that chain and still yields one); admin-shaped write (`attendees` +
      `waitlist` in one update) → one doc, `src/services/events.js` untouched;
      re-waitlisted then re-promoted → a second distinct doc (`..._evt-manual_1789527690713`
      then `..._1789527713778`); `attendees`-only write naming a still-waitlisted uid →
      zero; push-opted-out recipient → in-app doc plus `Push skipped: no eligible
      recipients` and no `push_notifications` marker; payload carries `eventId` /
      `eventTitle` / `link: /member/events` / `read: false`.
- [x] regression: `node --test test/eventLifecycle.test.js` → 7/7, repromotion unchanged.

## Notes
Converting `promoteFromWaitlist` into a callable was considered and rejected — larger, and
touches every admin call site. Diffing trigger snapshots covers both paths, no client change.

The `newlyPromoted` notify step is wrapped in its own `try`/`catch`, separate from the
promotion transaction's. It runs *before* the `beforeAttendees <= afterAttendees` early
return (by design, so it also sees the admin's manual-promotion write); an unhandled throw
there — a transient Firestore error, not just the swallowed `ALREADY_EXISTS` case — would
otherwise abort the trigger invocation before the real promotion transaction below ever
runs, on the one code path (a member cancelling) this function existed to serve.

At-least-once dedup cannot be forced in the emulator (no way to replay a delivery). It
rests on the deterministic doc id — the commit time is identical across retries of the same
write — plus `createNotificationIfAbsent`'s `.create()` + swallowed `ALREADY_EXISTS`; the
run above confirms the id shape carries that commit time.
