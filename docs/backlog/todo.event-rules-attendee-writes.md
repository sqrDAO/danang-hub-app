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
- [ ] A member who is not the organizer can register and unregister themselves (`attendees` write succeeds).
- [ ] A member who is not the organizer can join and leave the waitlist (`waitlist` write succeeds).
- [ ] An update touching `attendees` plus any field other than `waitlist` is denied for non-organizers.
- [ ] An update touching `waitlist` plus any field other than `attendees` is denied for non-organizers.
- [ ] An organizer updating their own event cannot change `status`.
- [ ] A member creating an event with `status: 'approved'` is denied.
- [ ] An admin can still update any field on any event.
- [ ] The rules comment states that field scoping does not restrict *which* uid is written.
- [ ] NOT: no change to the public `allow read: if true` on events.
- [ ] NOT: no capacity enforcement in rules (stays client-side and advisory, as with bookings).
- [ ] NOT: do not claim per-uid enforcement — rules cannot diff array contents (see Notes).

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

**Scope of enforcement, stated plainly.** Firestore rules have no array-diff
primitive: they can see *which fields* a write touches
(`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendees', 'waitlist'])`)
but not *which element* changed inside an array. So this spec enforces field scoping
only. A member can still add or remove another member's uid in `attendees`/`waitlist`.

That residual gap is accepted deliberately: the blast radius is a wrong name on an
attendee list, not privilege escalation — `status`, `capacity`, `date` and
`organizerId` all stay locked. The acceptance criteria above are written to that
enforceable boundary rather than to a per-uid guarantee the rules cannot make, and the
rules comment must say so.

If per-uid enforcement is actually required, the only way to get it is to move
attendee writes behind a callable (`registerForEvent` in `functions/index.js`, checking
`request.auth.uid` server-side) and deny all client `attendees` writes. That is a
larger change with its own spec — do not half-build it here.
