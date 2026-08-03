# Isolate per-recipient failures in event reminder delivery
**Phase**: — · **Deps**: —

## Goal
A push failure for one waitlisted member currently aborts the reminder push for every
member after them in that segment's iteration order, with no retry (the event's 24-25h
reminder window only occurs once). Make one recipient's failure not block the rest.

## Files
- `functions/index.js` (edited) — `deliverReminderSegment` (~line 1217): wrap each
  waitlisted member's `sendPushToMembers` call so a thrown error is caught and logged
  per-recipient instead of stopping the loop; also wrap the earlier
  `Promise.all(docs.map(...))` over `createNotificationIfAbsent` (~line 1219) so one
  member's create failure can't reject the whole segment's in-app notifications.

## Acceptance
- [ ] A `sendPushToMembers` rejection for one waitlisted member does not prevent the
      call from being attempted for the remaining members in that segment.
- [ ] A `createNotificationIfAbsent` rejection for one member (any segment) does not
      prevent the in-app notification from being attempted for the remaining members.
- [ ] Each per-recipient failure is logged with the member id and event id it belongs
      to, distinguishable from a successful send in the function logs.
- [ ] `cd functions && npm run lint` passes.
- [ ] NOT: retrying a failed send within the same run — one attempt per recipient per
      run is enough; the fix is isolation, not retry.

## Verify
- `cd functions && npm run lint` → 0 errors/warnings.
- Emulator check: `cd functions && npm run serve`, seed an `events` doc with `status:
  "approved"`, a `date` ~24.5h out, and a `waitlist` array of 3+ member ids where one
  member's `push_tokens/{uid}` doc holds a malformed/garbage token string likely to be
  rejected by `sendEachForMulticast`; trigger `sendEventReminders` manually via the
  emulator's scheduled-function trigger UI; confirm the other waitlisted members' push
  markers (`push_notifications/event_reminder_{uid}_{eventId}`) end up `status: "sent"`
  despite the bad-token member's failure.
- regression: `npm test` (functions has no test suite — this is emulator-only,
  consistent with repo convention).

## Notes
`sendPushToRecipients` (functions/index.js:691) already releases a recipient's dedupe
marker on a thrown batch error, so a caught-and-logged failure here leaves that member
retriable in principle — but since `sendEventReminders` selects events by a one-time
24-25h date window, there is no next run that will re-select this event. A dropped
recipient this run has no natural catch-up path; that's an accepted gap for this spec
(scope is isolation, not building a retry/backfill mechanism) — call it out in the log
message so it's discoverable if reminder complaints come in.
