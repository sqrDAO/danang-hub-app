# Don't double-send event reminder push notifications
**Phase**: — · **Deps**: —

## Goal
`deliverReminderSegment` sends push to every member in a segment regardless of whether their
in-app notification was actually newly created. Combined with `sendEventReminders`'s
boundary-inclusive hourly window, an event can be processed by two consecutive runs and affected
members get the push twice. Only push members whose in-app notification was newly created.

## Files
- `functions/index.js` (edited) — in `deliverReminderSegment` (~line 1546), filter the push
  recipients (`docs` passed to `sendPushToMembers`) down to the subset whose corresponding
  `createNotificationIfAbsent` call returned a created document, instead of pushing to the full
  segment unconditionally.

## Acceptance
- [ ] A member whose `event_reminder` notification already exists for a given `(eventId,
      segment-implied type)` does not receive a push on a re-run for the same event.
- [ ] A member newly notified in-app still receives the push, unchanged from current behavior.
- [ ] The waitlisted per-member push loop and the attendee/other batch push both respect the
      same created-only filtering.
- [ ] `cd functions && npm run lint` passes.
- [ ] NOT: do not change the in-app dedupe key or `createNotificationIfAbsent`'s semantics.

## Verify
- `cd functions && npm run lint` → passes.
- `firebase emulators:start`, manually invoke the `sendEventReminders` logic twice in a row
  (e.g. via a temporary local script or the Functions shell) against the same approved event with
  a `date` in the reminder window → second run sends no push to already-notified members, only
  the in-app notification's `read`/idempotency state is checked (no duplicate document either).

## Notes
`created` is already computed as `const created = await Promise.all(docs.map(doc =>
createNotificationIfAbsent(...)))` (~line 1553) — `createNotificationIfAbsent` presumably
resolves to the created doc or `null`/`false` on an existing one; confirm its exact return shape
before writing the filter (`deliverReminderSegment`'s final line does
`created.filter(Boolean).length`, which is evidence it already distinguishes "created" from
"already existed"). Zip `docs` against `created` by index to build the push-eligible subset.
