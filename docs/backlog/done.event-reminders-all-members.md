# Implement sendEventReminders as an all-member event reminder
**Phase**: — · **Deps**: —

## Goal
`sendEventReminders` (`functions/index.js:1123-1186`) resolves attendees, filters by
`preferences.eventReminders`, and then only `console.log`s — it never delivers anything.
Implement real delivery (in-app + browser push), and widen the audience from attendees to
**every member**, so members who haven't registered learn about tomorrow's event in time
to sign up or join the waitlist.

## Files
- `functions/index.js` (edited) — rewrite `sendEventReminders`: approved events only,
  segment members into attendee / waitlisted / other, deliver per segment via
  `createNotificationIfAbsent` + `sendPushToMembers` with type `event_reminder`.
- `src/components/NotificationBell.jsx` (edited) — register `event_reminder` in
  `NOTIFICATION_COPY_BY_TYPE` (~line 75) and `NOTIFICATION_FALLBACK_PATH_BY_TYPE`
  (~line 106, → `/member/events`).
- `src/locales/en.json`, `src/locales/vi.json` (edited) — three `notifications.*` title/body
  pairs under the existing `notifications` object, one per segment.
- `README.md` (edited) — Cloud Functions table row (line 233): replace "logs delivery
  details" with the real behavior.
- `docs/knowledge/data-flow.md` (edited) — bullet (line 146) and table row (line 175):
  drop the "log-only delivery stub" wording.

## Acceptance
- [ ] A member already in `attendees` gets reminder copy with no call to register.
- [ ] A member in `waitlist` gets copy naming their 1-based waitlist position.
- [ ] Every other member, while spots remain, gets copy naming spots taken vs capacity and inviting them to join.
- [ ] A member at an event already at capacity is still notified, with waitlist-oriented copy.
- [ ] Full-event copy never claims spots are open, on either channel or in either locale.
- [ ] Members with `preferences.eventReminders === false` get nothing on any channel.
- [ ] Only `status === 'approved'` events produce reminders.
- [ ] Re-running the schedule for the same event delivers nothing a second time.
- [ ] Push copy honours each recipient's `locale`, falling back to `en`.
- [ ] The in-app bell renders `event_reminder` with real copy, not the default fallback.
- [ ] NOT: no email — this is the first all-member broadcast; email deliverability is out of scope.
- [ ] NOT: no new Firestore composite index (CI cannot deploy indexes).
- [ ] NOT: no change to the `preferences.eventReminders` toggle in `src/pages/member/Profile.jsx`.
- [ ] NOT: no change to the 24–25h scheduling window or the hourly cadence.

## Verify
- `cd functions && npm run lint` → exit 0
- `npm run lint && npm run build` → exit 0
- emulator: seed an approved event ~24.5h out, plus members in each of the three segments
  and one with `eventReminders: false`; run the schedule → three distinct in-app
  notifications, none for the opted-out member
- emulator: run the schedule twice → second run creates no new `notifications` docs
- emulator: seed a `pending` and a `rejected` event in the same window → no notifications
- emulator: seed an event with `attendees.length >= capacity` → non-attendees still notified,
  and the notification carries `attendeeCount >= capacity` (the flag both the push builder
  and the bell branch on) — assert the copy, not just that a notification arrived
- i18n parity: `en.json`/`vi.json` key sets identical
- regression: `autoCheckoutExpiredBookings`, `cleanupPushNotificationMarkers` and
  `autoPromoteWaitlist` unchanged

## Notes
Decision (2026-08-02, human): **Option B — implement**, with the audience widened from
attendees to all members. Supersedes the earlier `decide-event-reminders-fate` spec, whose
Option A (delete, matching PR #47's precedent) was rejected.

Dedupe is free: `createNotificationIfAbsent` builds the id `${type}_${uid}_${eventId}` and
`reservePushRecipient` uses the same shape, so one member gets at most one reminder per
event however often the schedule reruns. The 24–25h bounds are inclusive on both ends, so
consecutive hourly runs can overlap on an event; the markers make that — and retries — idempotent.

**Status is filtered in memory, not in the query.** Adding `.where('status','==','approved')`
to the existing date range needs a composite `(status ASC, date ASC)` index — the one in
`firestore.indexes.json` is `(status ASC, date DESC)` and won't serve it. Index deploys are
manual-as-owner (CI lacks `datastore.indexes.*`), so a query-only change would fail in prod
until someone deployed by hand. Events in a one-hour window are 0–2; the filter is free.

`sendPushToMembers` takes one message pair per call and groups recipients by locale
internally, so the attendee and other segments each go out as a single batched call.
Waitlisted members are the exception: `waitlistPosition` differs per recipient, so their
push is sent one call per member.
