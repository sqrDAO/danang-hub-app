# Allow attendee writes and block organizer self-approval in event rules
**Phase**: — · **Deps**: — · **Blocked on**: step 0 below

## Step 0 — diff the deployed ruleset first (blocking)
Do not edit `firestore.rules` until the deployed ruleset has been diffed against git. The
committed rules cannot permit registration, yet registration presumably works in
production — so which is true decides whether this spec is a fix or a reconciliation of
undocumented drift. Quick look: Firebase console → Firestore Database → Rules for project
`danang-hub-app`. Real diff (needs `firebaserules.viewer`):

```bash
TOKEN=$(gcloud auth print-access-token)
RULESET=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/projects/danang-hub-app/releases" \
  | jq -r '.releases[] | select(.name | endswith("cloud.firestore")) | .rulesetName')
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebaserules.googleapis.com/v1/$RULESET" \
  | jq -r '.source.files[].content' > /tmp/deployed.rules
diff -u firestore.rules /tmp/deployed.rules
```

Record the outcome here before continuing:

- **Identical** — registration is genuinely broken in production. Confirm with one real
  member account, then implement below as a bug fix.
- **They differ** — the drift is the headline finding. Note every difference, across all
  collections and not just `events`, then reconcile `firestore.rules` to the intended
  state and treat it as the source of truth from then on.

## Goal
`firestore.rules:95` is the only non-admin update path on `events/{eventId}` and requires
the writer to be the organizer, so registering for someone else's event is denied — while
the same rule's lack of field limits lets an organizer self-approve. Add a narrow
attendee-write path and pin `status` for non-admins.

## Files
- `firestore.rules` (edited) — split the `events` update rule: (a) organizer may
  update own event but may not change `status`, `organizerId`, `approvedAt`,
  `rejectedAt`; (b) any authenticated member may update when the diff touches only
  `attendees`/`waitlist`; (c) create must have `status == 'pending'` unless admin;
  (d) admin unchanged.
- `docs/knowledge/data-flow.md` (edited) — update the `events` rules-table row (~line 189)
  and the register/waitlist bullet (~line 138) to match.

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
- as admin: approve/reject an event → succeeds; organizer gets the notification + email
- regression: `autoPromoteWaitlist` still writes (Admin SDK bypasses rules); event delete
  by organizer and by admin both still work

## Notes
**Scope of enforcement, stated plainly.** Firestore rules have no array-diff primitive:
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` sees *which
fields* a write touches, never *which element* changed inside an array. So this spec
enforces field scoping only — a member can still write another member's uid.

That gap is accepted deliberately: the blast radius is a wrong name on an attendee list,
not privilege escalation — `status`, `capacity`, `date` and `organizerId` stay locked.
Acceptance is written to that enforceable boundary, and the rules comment must say so.
Closing it properly means moving attendee writes behind a callable (`registerForEvent`
checking `request.auth.uid`) and denying client `attendees` writes — its own spec, larger
than this one. Don't half-build it here.
