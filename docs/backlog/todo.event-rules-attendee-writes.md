# Allow attendee writes and block organizer self-approval in event rules
**Phase**: — · **Deps**: —

## Goal
`firestore.rules:95` is the only non-admin update path on `events/{eventId}` and it
requires the writer to be the organizer, so a member registering for someone else's
event should be denied — yet the same rule places no field limits, letting an
organizer set `status: 'approved'` on their own event and skip admin review. Add a
narrow attendee-write path and pin `status` for non-admins.

## Files
- `firestore.rules` (edited) — split the `events` update rule: (a) organizer may
  update own event but may not change `status`, `organizerId`, `approvedAt`,
  `rejectedAt`; (b) any authenticated member may update when the diff touches only
  `attendees`/`waitlist`; (c) create must have `status == 'pending'` unless admin;
  (d) admin unchanged.
- `docs/knowledge/data-flow.md` (edited) — update the `events` row of the rules table
  (line ~189) and the register/waitlist bullet (line ~138) to match.

## Acceptance
- [ ] A member who is not the organizer can add and remove their own uid in `attendees`.
- [ ] A member who is not the organizer can add and remove their own uid in `waitlist`.
- [ ] An update touching `attendees` plus any other field is denied for non-organizers.
- [ ] An organizer updating their own event cannot change `status`.
- [ ] A member creating an event with `status: 'approved'` is denied.
- [ ] An admin can still update any field on any event.
- [ ] NOT: no change to the public `allow read: if true` on events.
- [ ] NOT: no capacity enforcement in rules (stays client-side and advisory, as with bookings).

## Verify
- `firebase emulators:start` → in the emulator UI, signed in as member A, register for
  member B's approved event; write succeeds
- same session: attempt `status: 'approved'` on own pending event → denied
- same session: attempt `createEvent` with `status: 'approved'` → denied
- as admin: approve/reject an event → succeeds; organizer receives the notification + email
- regression: `autoPromoteWaitlist` still writes (Admin SDK bypasses rules); event
  delete by organizer and by admin both still work

## Notes
**Investigate before coding**: the committed rules cannot permit registration, but
registration is presumably working in production — so the deployed ruleset may be
looser than git. Diff the live rules against `firestore.rules` first. If they differ,
that drift is the real finding and this spec's rules become the reconciled source of
truth.

Members may only add/remove **their own** uid — check
`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendees'])`
combined with an `attendees` delta of exactly `request.auth.uid`. Rules cannot diff
array contents directly; the practical form is to allow the `hasOnly` field scope and
accept that a member could add another member's uid to the attendee list. Note that
limit in the rules comment rather than pretending it is closed.
